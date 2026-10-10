import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError, ErrorCodes } from '../utils/errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  #users = new Map(); // email.toLowerCase() -> { id, email, displayName, salt, hash, createdAt }
  #tokens = new Map(); // token -> { userId, email, displayName, isGuest, expiresAt }
  #filePath;
  #tokensFilePath;

  constructor({
    filePath = resolve(process.cwd(), 'data/users.json'),
    tokensFilePath = null,
  } = {}) {
    this.#filePath = filePath;
    this.#tokensFilePath = tokensFilePath || resolve(dirname(filePath), 'tokens.json');
    this.loadFromDisk();
    this.loadTokensFromDisk();
  }

  loadFromDisk() {
    try {
      if (existsSync(this.#filePath)) {
        const raw = readFileSync(this.#filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const u of data) {
            if (u.email) {
              this.#users.set(u.email.toLowerCase(), u);
            }
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

  isRegisteredDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') return false;
    const target = displayName.replace(/\s+/g, ' ').trim().toLowerCase();
    for (const u of this.#users.values()) {
      if (u.displayName && u.displayName.toLowerCase() === target) return true;
    }
    return false;
  }

  // Alias for backward compatibility if invoked by external callers
  isRegisteredUsername(name) {
    return this.isRegisteredDisplayName(name);
  }

  loadTokensFromDisk() {
    try {
      if (existsSync(this.#tokensFilePath)) {
        const raw = readFileSync(this.#tokensFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const now = Date.now();
          for (const item of data) {
            if (item.token && item.expiresAt > now) {
              this.#tokens.set(item.token, {
                userId: item.userId,
                email: item.email || null,
                displayName: item.displayName || 'Guest',
                isGuest: Boolean(item.isGuest),
                expiresAt: item.expiresAt,
              });
            }
          }
        }
      }
    } catch {
      /* ignore cold start */
    }
  }

  saveTokensToDisk() {
    try {
      const dir = dirname(this.#tokensFilePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const list = [];
      const now = Date.now();
      for (const [token, session] of this.#tokens.entries()) {
        if (session.expiresAt > now) {
          list.push({ token, ...session });
        }
      }
      writeFileSync(this.#tokensFilePath, JSON.stringify(list, null, 2), 'utf8');
    } catch {
      /* ignore */
    }
  }

  #hashPassword(password, salt) {
    return scryptSync(password, salt, 64).toString('hex');
  }

  register({ email, password, displayName }) {
    if (!email || typeof email !== 'string') {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Enter an email address.');
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Enter a valid email address.');
    }

    if (!displayName || typeof displayName !== 'string') {
      throw new AppError(ErrorCodes.INVALID_NAME, 'Enter a display name.');
    }
    const cleanName = displayName.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanName.length < 2 || cleanName.length > 32) {
      throw new AppError(ErrorCodes.INVALID_NAME, 'Display name must be between 2 and 32 characters.');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Password must be at least 6 characters.');
    }

    if (this.#users.has(cleanEmail)) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'An account with this email already exists.');
    }

    const salt = randomBytes(16).toString('hex');
    const hash = this.#hashPassword(password, salt);
    const id = 'u_' + randomBytes(8).toString('hex');
    const user = { id, email: cleanEmail, displayName: cleanName, salt, hash, createdAt: Date.now() };

    this.#users.set(cleanEmail, user);
    this.saveToDisk();

    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, {
      userId: id,
      email: cleanEmail,
      displayName: cleanName,
      isGuest: false,
      expiresAt: Date.now() + 30 * 86400000,
    });
    this.saveTokensToDisk();
    return { token, user: { id, email: cleanEmail, displayName: cleanName, isGuest: false } };
  }

  login({ email, password }) {
    if (!email || !password) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Email and password are required.');
    }
    const key = ('' + email).trim().toLowerCase();
    const user = this.#users.get(key);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Invalid email or password.');
    }

    const checkHash = this.#hashPassword(password, user.salt);
    const a = Buffer.from(checkHash, 'utf8');
    const b = Buffer.from(user.hash, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Invalid email or password.');
    }

    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      isGuest: false,
      expiresAt: Date.now() + 30 * 86400000,
    });
    this.saveTokensToDisk();
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, isGuest: false } };
  }

  guestLogin({ displayName }) {
    const clean = (displayName || 'Viewer').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Viewer';
    const id = 'g_' + randomBytes(6).toString('hex');
    const token = randomBytes(32).toString('hex');
    this.#tokens.set(token, {
      userId: id,
      email: null,
      displayName: clean,
      isGuest: true,
      expiresAt: Date.now() + 86400000,
    });
    this.saveTokensToDisk();
    return { token, user: { id, email: null, displayName: clean, isGuest: true } };
  }

  verifyToken(token) {
    if (!token) return null;
    const session = this.#tokens.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) {
        this.#tokens.delete(token);
        this.saveTokensToDisk();
      }
      return null;
    }
    return {
      id: session.userId,
      email: session.email ?? null,
      displayName: session.displayName,
      isGuest: session.isGuest,
    };
  }
}
