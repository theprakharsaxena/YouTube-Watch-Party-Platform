// Single place to tune how aggressively a client chases the authoritative position.
export const SYNC_CONFIG = {
  /** Drift (seconds) below which we leave the player alone. */
  ignoreBelow: 0.75,
  /** Drift at/above which we seek immediately. Between ignoreBelow and this we need two consecutive checks. */
  hardSeekAt: 2.5,
  /** Minimum gap between corrective seeks, so we never fight YouTube's buffering. */
  seekCooldownMs: 4000,
  /** How often the drift check runs while playing. */
  checkIntervalMs: 2000,
  /** On an explicit play/pause/seek command we re-seek only if off by more than this. */
  commandSeekTolerance: 0.35,
  /** How long after asking to play we wait before concluding autoplay was blocked. */
  autoplayGraceMs: 1800,
};

/**
 * Decide what to do about drift between this client's player and the room's
 * authoritative position. Pure function so it is unit-tested without a player.
 *
 * @param {object} input
 * @param {number} input.drift         player position minus expected position (seconds; + = ahead)
 * @param {boolean} input.moderatePending a moderate drift was already seen on the previous check
 * @param {number} input.sinceLastSeekMs  ms since this client last corrected itself
 * @returns {{ action: 'none'|'seek', moderatePending: boolean }}
 */
export function decideDriftAction({ drift, moderatePending, sinceLastSeekMs }, config = SYNC_CONFIG) {
  const size = Math.abs(drift);
  if (size < config.ignoreBelow) return { action: 'none', moderatePending: false };
  if (sinceLastSeekMs < config.seekCooldownMs) return { action: 'none', moderatePending };
  if (size >= config.hardSeekAt) return { action: 'seek', moderatePending: false };
  // Moderate drift: only correct if it persists, which filters out transient buffering jitter.
  if (moderatePending) return { action: 'seek', moderatePending: false };
  return { action: 'none', moderatePending: true };
}

/** Where the room "is" right now, given the last snapshot and when we received it. */
export function expectedPosition(playback, receivedAt, now = Date.now()) {
  if (!playback) return 0;
  if (playback.status !== 'playing') return playback.position;
  return playback.position + Math.max(0, now - receivedAt) / 1000;
}
