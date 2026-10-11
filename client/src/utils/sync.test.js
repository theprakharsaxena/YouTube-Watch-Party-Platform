import { describe, expect, it } from 'vitest';
import { SYNC_CONFIG, decideDriftAction, expectedPosition } from './sync.js';

const base = { moderatePending: false, sinceLastSeekMs: 60_000 };

describe('decideDriftAction', () => {
  it('leaves small drift alone', () => {
    expect(decideDriftAction({ ...base, drift: 0.4 })).toEqual({ action: 'none', moderatePending: false });
    expect(decideDriftAction({ ...base, drift: -0.7 })).toEqual({ action: 'none', moderatePending: false });
  });

  it('waits for moderate drift to persist before seeking', () => {
    const first = decideDriftAction({ ...base, drift: 1.4 });
    expect(first).toEqual({ action: 'none', moderatePending: true });
    const second = decideDriftAction({ ...base, drift: 1.5, moderatePending: first.moderatePending });
    expect(second).toEqual({ action: 'seek', moderatePending: false });
  });

  it('seeks immediately on large drift in either direction', () => {
    expect(decideDriftAction({ ...base, drift: SYNC_CONFIG.hardSeekAt + 1 }).action).toBe('seek');
    expect(decideDriftAction({ ...base, drift: -(SYNC_CONFIG.hardSeekAt + 1) }).action).toBe('seek');
  });

  it('respects the cooldown so it never fights the buffer', () => {
    const result = decideDriftAction({ drift: 10, moderatePending: false, sinceLastSeekMs: 500 });
    expect(result.action).toBe('none');
  });

  it('resets the pending flag when drift recovers', () => {
    expect(decideDriftAction({ ...base, drift: 0.1, moderatePending: true }).moderatePending).toBe(false);
  });
});

describe('expectedPosition', () => {
  it('extrapolates while playing', () => {
    expect(expectedPosition({ status: 'playing', position: 20 }, 1_000, 4_500)).toBe(23.5);
  });
  it('is fixed while paused', () => {
    expect(expectedPosition({ status: 'paused', position: 20 }, 1_000, 9_000)).toBe(20);
  });
  it('never goes backwards if clocks are odd', () => {
    expect(expectedPosition({ status: 'playing', position: 5 }, 5_000, 1_000)).toBe(5);
  });
});

