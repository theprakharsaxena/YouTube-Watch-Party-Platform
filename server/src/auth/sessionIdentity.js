import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function newParticipantId() {
  return randomUUID().slice(0, 8);
}

export function newReconnectToken() {
  return randomBytes(24).toString('base64url');
}

export function tokensMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

