import { AppError, ErrorCodes } from '../utils/errors.js';

export const Roles = Object.freeze({
  HOST: 'host',
  MODERATOR: 'moderator',
  PARTICIPANT: 'participant',
});

export const Actions = Object.freeze({
  CONTROL_PLAYBACK: 'control_playback',
  CHANGE_VIDEO: 'change_video',
  MANAGE_ROLES: 'manage_roles',
  REMOVE_PARTICIPANT: 'remove_participant',
});

// The single source of truth for "who may do what".
const PERMISSIONS = {
  [Actions.CONTROL_PLAYBACK]: [Roles.HOST, Roles.MODERATOR],
  [Actions.CHANGE_VIDEO]: [Roles.HOST, Roles.MODERATOR],
  [Actions.MANAGE_ROLES]: [Roles.HOST],
  [Actions.REMOVE_PARTICIPANT]: [Roles.HOST],
};

const DENIAL_MESSAGES = {
  [Actions.CONTROL_PLAYBACK]: 'Only the host or a moderator can control playback.',
  [Actions.CHANGE_VIDEO]: 'Only the host or a moderator can change the video.',
  [Actions.MANAGE_ROLES]: 'Only the host can change roles.',
  [Actions.REMOVE_PARTICIPANT]: 'Only the host can remove participants.',
};

export function can(role, action) {
  return (PERMISSIONS[action] ?? []).includes(role);
}

/** Throws FORBIDDEN unless the participant's *server-held* role allows the action. */
export function assertCan(participant, action) {
  if (!can(participant.role, action)) {
    throw new AppError(ErrorCodes.FORBIDDEN, DENIAL_MESSAGES[action] ?? 'You are not allowed to do that.');
  }
}
