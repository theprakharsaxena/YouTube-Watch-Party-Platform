import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError, ErrorCodes } from '../utils/errors.js';

export class AuthService {
  #users = new Map(); // username.toLowerCase() -> { id, username, salt, hash, createdAt }
  #tokens = new Map(); // token -> { userId, username, isGuest, expiresAt }
  #filePath;

  constructor({ filePath = resolve(process.cwd(), 'data/users.json') } = {}) {
    this.#filePath = filePath;
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (existsSync(this.#filePath)) {
        const raw = readFileSync(this.#filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const u of data) {
            this.#users.set(u.username.toLowerCase(), u);
          }
        }
      }
    } catch {
      /* ignore cold start */
    }
  }

  saveToDisk() {
    try {
      const dir = dirname(this.#filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.#filePath, JSON.stringify([...this.#users.values()], null, 2), 'utf8');
    } catch {
      /* ignore */
    }
  }

  #hashPassword(password, salt) {
    return scryptSync(password, salt, 64).toString('hex');
  }

  register({ username, password }) {
    if (!username || typeof username !== 'string') {
      throw new AppError(ErrorCodes.INVALID_NAME, 'Enter a username.');
    }
    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(cleanUser)) {
      throw new AppError(ErrorCodes.INVALID_NAME, 'Username must be 3-24 alphanumeric characters.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Password must be at least 6 characters.');
    }

    const key = cleanUser.toLowerCase();
    if (this.#users.has(key)) {
      throw new AppError(ErrorCodes.INVALID_NAME, 'That username is already taken.');
    }

    const salt = randomBytes(16).toString('hex');
    const hash = this.#hashPassword(password, salt);
    const id = 'u_' + randomBytes(8).toString('hex');
    const user = { id, username: cleanUser, salt, hash, createdAt: Date.now() };

    this.#users.set(key, user);
    this.saveToDisk();

    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, { userId: id, username: cleanUser, isGuest: false, expiresAt: Date.now() + 30 * 86400000 });
    return { token, user: { id, username: cleanUser, isGuest: false } };
  }

  login({ username, password }) {
    if (!username || !password) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Username and password are required.');
    }
    const key = ('' + username).trim().toLowerCase();
    const user = this.#users.get(key);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Invalid username or password.');
    }

    const checkHash = this.#hashPassword(password, user.salt);
    const a = Buffer.from(checkHash, 'utf8');
    const b = Buffer.from(user.hash, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Invalid username or password.');
    }

    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, { userId: user.id, username: user.username, isGuest: false, expiresAt: Date.now() + 30 * 86400000 });
    return { token, user: { id: user.id, username: user.username, isGuest: false } };
  }

  guestLogin({ displayName }) {
    const clean = (displayName || 'Guest').trim().slice(0, 24);
    const id = 'g_' + randomBytes(6).toString('hex');
    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, { userId: id, username: clean, isGuest: true, expiresAt: Date.now() + 86400000 });
    return { token, user: { id, username: clean, isGuest: true } };
  }

  verifyToken(token) {
    if (!token) return null;
    const session = this.#tokens.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) this.#tokens.delete(token);
      return null;
    }
    return { id: session.userId, username: session.username, isGuest: session.isGuest };
  }
}
