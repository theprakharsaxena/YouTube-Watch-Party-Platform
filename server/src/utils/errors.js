
export const ErrorCodes = {
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INVALID_NAME: 'INVALID_NAME',
  INVALID_VIDEO: 'INVALID_VIDEO',
  INVALID_POSITION: 'INVALID_POSITION',
  INVALID_ROLE: 'INVALID_ROLE',
  INVALID_ROOM: 'INVALID_ROOM',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCOUNT_REQUIRED: 'ACCOUNT_REQUIRED',
  REMOVED_FROM_ROOM: 'REMOVED_FROM_ROOM',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  INVALID_TARGET: 'INVALID_TARGET',
  NO_VIDEO: 'NO_VIDEO',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_REPLACED: 'SESSION_REPLACED',
  INTERNAL: 'INTERNAL',
};

export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function toClientError(error, event) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, event };
  }
  return { code: ErrorCodes.INTERNAL, message: 'Something went wrong on the server.', event };
}

