import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

// Lightweight session identity (NOT an account system).
// Each seat gets a server-generated participantId plus a secret reconnect token.
// The token only proves "I am the same browser session that took this seat";
// it never grants a role by itself - roles are always read from room state.

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
