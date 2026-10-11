
export const SYNC_CONFIG = {

  ignoreBelow: 0.75,

  hardSeekAt: 2.5,

  seekCooldownMs: 4000,

  checkIntervalMs: 2000,

  commandSeekTolerance: 0.35,

  autoplayGraceMs: 1800,
};

export function decideDriftAction({ drift, moderatePending, sinceLastSeekMs }, config = SYNC_CONFIG) {
  const size = Math.abs(drift);
  if (size < config.ignoreBelow) return { action: 'none', moderatePending: false };
  if (sinceLastSeekMs < config.seekCooldownMs) return { action: 'none', moderatePending };
  if (size >= config.hardSeekAt) return { action: 'seek', moderatePending: false };

  if (moderatePending) return { action: 'seek', moderatePending: false };
  return { action: 'none', moderatePending: true };
}

export function expectedPosition(playback, receivedAt, now = Date.now()) {
  if (!playback) return 0;
  if (playback.status !== 'playing') return playback.position;
  return playback.position + Math.max(0, now - receivedAt) / 1000;
}

