import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RoomStore } from './roomManager.js';
import { Room } from './Room.js';

export class PersistentRoomStore extends RoomStore {
  #filePath;
  #dirty = false;
  #saveTimer = null;

  constructor({ filePath = resolve(process.cwd(), 'data/rooms.json') } = {}) {
    super();
    this.#filePath = filePath;
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (existsSync(this.#filePath)) {
        const raw = readFileSync(this.#filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const roomData of data) {
            const room = Room.fromJSON(roomData);
            super.set(room);
          }
        }
      }
    } catch (err) {

    }
  }

  saveToDiskSync() {
    try {
      const dir = dirname(this.#filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = this.all().map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
      writeFileSync(this.#filePath, JSON.stringify(data, null, 2), 'utf8');
      this.#dirty = false;
    } catch {

    }
  }

  scheduleSave() {
    if (this.#saveTimer) return;
    this.#dirty = true;
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      if (this.#dirty) {
        this.saveToDiskSync();
      }
    }, 500);
  }

  set(room) {
    super.set(room);
    this.scheduleSave();
  }

  delete(roomId) {
    const deleted = super.delete(roomId);
    if (deleted) {
      this.scheduleSave();
    }
    return deleted;
  }
}

