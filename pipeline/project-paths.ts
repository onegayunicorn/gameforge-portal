import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve a path supplied by a game project configuration without allowing it to
 * leave the project root, including through an existing symlink.
 *
 * The lexical check protects paths that do not exist yet (notably entry files),
 * while the realpath check protects existing files/directories reached through a
 * symlink. Windows absolute paths are rejected even when validation runs on a
 * POSIX host.
 */
export function resolveProjectPath(root: string, value: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new Error(`${field} must be a non-empty path without NUL bytes`);
  }
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error(`${field} must be relative to the project root: ${value}`);
  }

  const projectRoot = path.resolve(root);
  const resolved = path.resolve(projectRoot, value);
  if (!isWithin(projectRoot, resolved)) {
    throw new Error(`${field} escapes the project root: ${value}`);
  }

  // Existing symlinks must also remain within the canonical project root.
  if (fs.existsSync(resolved)) {
    const realRoot = fs.realpathSync.native(projectRoot);
    const realResolved = fs.realpathSync.native(resolved);
    if (!isWithin(realRoot, realResolved)) {
      throw new Error(`${field} resolves through a symlink outside the project root: ${value}`);
    }
  }

  return resolved;
}

export function isWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
