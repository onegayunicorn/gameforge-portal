import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function digest(token) {
  return createHash("sha256").update(token).digest();
}

function tokenKey(token) {
  if (typeof token !== "string" || token.length < 32) return null;
  return digest(token);
}

function sameDigest(left, right) {
  return left && right && left.length === right.length && timingSafeEqual(left, right);
}

/** A local session store. Only SHA-256 digests of bearer tokens are persisted. */
export function createSessionStore({ filename = ":memory:", ttlMs = 8 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError("ttlMs must be a positive safe integer");
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash BLOB PRIMARY KEY,
      subject TEXT NOT NULL,
      scopes TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
  `);
  const insert = db.prepare("INSERT INTO sessions (token_hash, subject, scopes, created_at, expires_at) VALUES (?, ?, ?, ?, ?)");
  const select = db.prepare("SELECT subject, scopes, created_at, expires_at, revoked_at FROM sessions WHERE token_hash = ?");
  const revoke = db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL");
  const purge = db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL");

  return Object.freeze({
    create({ subject, scopes = [] } = {}) {
      if (typeof subject !== "string" || subject.trim() === "") throw new TypeError("subject is required");
      if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string" || scope.trim() === "")) throw new TypeError("scopes must be strings");
      const issuedAt = now();
      const token = randomBytes(32).toString("base64url");
      insert.run(digest(token), subject, JSON.stringify([...new Set(scopes)]), issuedAt, issuedAt + ttlMs);
      return Object.freeze({ token, subject, scopes: [...new Set(scopes)], createdAt: issuedAt, expiresAt: issuedAt + ttlMs });
    },
    get(token) {
      const key = tokenKey(token);
      if (!key) return null;
      const row = select.get(key);
      if (!row || row.revoked_at !== null || row.expires_at <= now()) return null;
      return Object.freeze({ subject: row.subject, scopes: JSON.parse(row.scopes), createdAt: row.created_at, expiresAt: row.expires_at });
    },
    revoke(token) {
      const key = tokenKey(token);
      return key ? revoke.run(now(), key).changes > 0 : false;
    },
    purge() {
      return Number(purge.run(now()).changes);
    },
    close() {
      db.close();
    },
  });
}

export function hashSessionToken(token) {
  const key = tokenKey(token);
  return key ? Buffer.from(key) : null;
}

export { sameDigest };
