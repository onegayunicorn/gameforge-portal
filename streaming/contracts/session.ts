/**
 * Contract for the GameForge cloud-streaming service (design stage - nothing implements this yet).
 *
 * Pinning the session lifecycle and the wire shapes first means the control plane, the GPU node
 * agent and the browser client can be built independently against one definition. See
 * docs/streaming/ARCHITECTURE.md for how the pieces fit together.
 *
 * Values marked "proposed" are starting points to be tuned with measurements from the Phase 0
 * spike, not facts.
 */

/* ------------------------------------------------------------------ lifecycle */

export const SESSION_STATES = [
  'requested',     // accepted by the API, not yet placed
  'queued',        // valid request, no capacity right now
  'allocating',    // a GPU node has been chosen and is being reserved
  'starting',      // session container and streaming server are booting
  'ready',         // up and waiting for the player to connect
  'streaming',     // a player is connected and receiving video
  'reconnecting',  // the player dropped; the session is held for a grace period
  'ending',        // tearing down (player left, limit reached, or cancelled)
  'ended',         // resources reclaimed
  'failed',        // could not start, or lost the node; resources reclaimed
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

/** Every legal move. Anything not listed here is a bug in the caller, not a state to tolerate. */
const TRANSITIONS: Readonly<Record<SessionState, readonly SessionState[]>> = {
  requested: ['queued', 'allocating', 'ending', 'failed'],
  queued: ['allocating', 'ending', 'failed'],
  // Back to queued when the reserved node refuses or disappears and another can be tried.
  allocating: ['starting', 'queued', 'ending', 'failed'],
  starting: ['ready', 'ending', 'failed'],
  ready: ['streaming', 'ending', 'failed'],
  streaming: ['reconnecting', 'ending', 'failed'],
  reconnecting: ['streaming', 'ending', 'failed'],
  ending: ['ended', 'failed'],
  ended: [],
  failed: [],
};

export const TERMINAL_STATES: ReadonlySet<SessionState> = new Set<SessionState>(['ended', 'failed']);

export function canTransition(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SessionState, to: SessionState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal session transition: ${from} -> ${to}`);
  }
}

export function nextStates(from: SessionState): readonly SessionState[] {
  return TRANSITIONS[from];
}

/** Proposed defaults. Every limit exists so that a forgotten session cannot hold a GPU forever. */
export const SESSION_LIMITS = {
  /** Give up waiting for capacity. */
  queueTimeoutMs: 120_000,
  /** Container pull/boot to `ready`. */
  startTimeoutMs: 90_000,
  /** `ready` with no player connecting. */
  readyIdleMs: 60_000,
  /** How long a dropped player may take to come back before the session is ended. */
  reconnectGraceMs: 45_000,
  /** No keyboard, pointer or gamepad input from a connected player. */
  inputIdleMs: 600_000,
  /** Hard cap per session, per user tier. */
  maxSessionMs: 4 * 60 * 60 * 1000,
} as const;

/* ------------------------------------------------------------------ control-plane REST */

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'vp9';

/** POST /v1/sessions */
export interface CreateSessionRequest {
  gameId: string;
  /** Preferred region; the orchestrator may pick another and says which in the response. */
  region?: string;
  client: {
    maxWidth: number;
    maxHeight: number;
    maxBitrateKbps: number;
    /** Codecs the client can decode in hardware, best first. */
    codecs: readonly VideoCodec[];
    gamepad: boolean;
    touch: boolean;
  };
}

export type SessionErrorCode =
  | 'auth_required'
  | 'quota_exceeded'
  | 'game_not_streamable'
  | 'no_capacity'
  | 'region_unavailable'
  | 'start_timeout'
  | 'node_lost'
  | 'session_expired';

export interface IceServer {
  urls: readonly string[];
  /** Ephemeral, per-session TURN credentials; never long-lived. */
  username?: string;
  credential?: string;
}

export interface ConnectInfo {
  /** wss:// endpoint of the signaling relay in the session's region. */
  signalingUrl: string;
  /** Single-use, short-lived, bound to this session and this user. */
  ticket: string;
  ticketExpiresAt: string;
  iceServers: readonly IceServer[];
}

/** GET /v1/sessions/{id}, also the body of the POST response. */
export interface SessionView {
  id: string;
  gameId: string;
  state: SessionState;
  region: string;
  /** Present only while `queued`. */
  queuePosition?: number;
  createdAt: string;
  /** The hard deadline implied by `SESSION_LIMITS.maxSessionMs`. */
  expiresAt: string;
  /** Present only in `ready`, `streaming` and `reconnecting`. */
  connect?: ConnectInfo;
  failure?: { code: SessionErrorCode; message: string };
}

/* ------------------------------------------------------------------ signaling (WebSocket, JSON) */

export type ClientSignal =
  | { type: 'hello'; v: 1; ticket: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: 'bye' };

export type ServerSignal =
  | { type: 'welcome'; v: 1; sessionId: string }
  | { type: 'offer'; sdp: string }
  | { type: 'ice'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: 'error'; code: SessionErrorCode | 'bad_ticket' | 'bad_message'; message: string }
  | { type: 'bye'; reason: 'player_left' | 'idle' | 'limit' | 'node_lost' | 'operator' };

/* ------------------------------------------------------------------ input (unordered, unreliable data channel) */

interface InputBase {
  /** Increasing per connection, so the server can drop stale or reordered events. */
  seq: number;
  /** Client monotonic clock in ms; used for latency measurement, never trusted for ordering. */
  t: number;
}

export type InputEvent =
  | (InputBase & { kind: 'key'; code: string; down: boolean })
  | (InputBase & { kind: 'pointer'; dx: number; dy: number; buttons: number })
  | (InputBase & { kind: 'wheel'; dx: number; dy: number })
  | (InputBase & { kind: 'pad'; index: number; buttons: number; axes: readonly number[] });

/* ------------------------------------------------------------------ quality reports (client -> service, ~1 Hz) */

export interface QosReport {
  sessionId: string;
  rttMs: number;
  jitterMs: number;
  packetsLost: number;
  bitrateKbps: number;
  fps: number;
  width: number;
  height: number;
  decodeMsP95: number;
  framesDropped: number;
}
