import { describe, expect, it } from 'vitest';
import {
  SESSION_LIMITS,
  SESSION_STATES,
  TERMINAL_STATES,
  assertTransition,
  canTransition,
  nextStates,
  type SessionState,
} from '../../../streaming/contracts/session';

/** Every state reachable by following legal transitions from `from`. */
function reachable(from: SessionState): Set<SessionState> {
  const seen = new Set<SessionState>([from]);
  const stack: SessionState[] = [from];
  while (stack.length > 0) {
    const current = stack.pop() as SessionState;
    for (const next of nextStates(current)) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

describe('streaming session lifecycle', () => {
  it('can reach every state from `requested`', () => {
    expect([...reachable('requested')].sort()).toEqual([...SESSION_STATES].sort());
  });

  it('terminal states have no way out', () => {
    for (const state of TERMINAL_STATES) expect(nextStates(state)).toEqual([]);
  });

  it('never lets a live session get stuck: every non-terminal state can reach a terminal one', () => {
    for (const state of SESSION_STATES) {
      if (TERMINAL_STATES.has(state)) continue;
      const ends = [...reachable(state)].some((candidate) => TERMINAL_STATES.has(candidate));
      expect(ends, `${state} cannot reach ended or failed`).toBe(true);
    }
  });

  it('never allows a state to transition to itself', () => {
    for (const state of SESSION_STATES) expect(canTransition(state, state)).toBe(false);
  });

  it('lets a session in any live state be cancelled or fail, so a GPU is never held by an unreachable state', () => {
    for (const state of SESSION_STATES) {
      if (TERMINAL_STATES.has(state) || state === 'ending') continue;
      expect(canTransition(state, 'failed'), `${state} -> failed`).toBe(true);
      expect(canTransition(state, 'ending'), `${state} -> ending`).toBe(true);
    }
  });

  it('follows the happy path and the reconnect loop', () => {
    const path: SessionState[] = ['requested', 'allocating', 'starting', 'ready', 'streaming', 'reconnecting', 'streaming', 'ending', 'ended'];
    for (let i = 1; i < path.length; i += 1) {
      expect(canTransition(path[i - 1] as SessionState, path[i] as SessionState), `${path[i - 1]} -> ${path[i]}`).toBe(true);
    }
  });

  it('rejects moves that would skip or reverse the lifecycle', () => {
    const illegal: Array<[SessionState, SessionState]> = [
      ['requested', 'streaming'],
      ['starting', 'streaming'],
      ['ready', 'queued'],
      ['streaming', 'queued'],
      ['streaming', 'ready'],
      ['ended', 'streaming'],
      ['failed', 'requested'],
      ['ending', 'streaming'],
    ];
    for (const [from, to] of illegal) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(`Illegal session transition: ${from} -> ${to}`);
    }
  });

  it('keeps every timeout positive and the reconnect grace shorter than the session cap', () => {
    for (const [name, value] of Object.entries(SESSION_LIMITS)) expect(value, name).toBeGreaterThan(0);
    expect(SESSION_LIMITS.reconnectGraceMs).toBeLessThan(SESSION_LIMITS.maxSessionMs);
  });
});
