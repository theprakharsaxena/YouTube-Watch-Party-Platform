import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RoomStore } from './roomManager.js';
import { Room } from './Room.js';

export class SqliteRoomStore extends RoomStore {
  #db;

  constructor({
    dbPath = existsSync(resolve(process.cwd(), 'data/sidelight.db')) && !existsSync(resolve(process.cwd(), 'data/watchalong.db'))
      ? resolve(process.cwd(), 'data/sidelight.db')
      : resolve(process.cwd(), 'data/watchalong.db'),
  } = {}) {
    super();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.#db = new DatabaseSync(dbPath);
    this.#initSchema();
    this.#loadRooms();
  }

  #initSchema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        host_id TEXT,
        created_at INTEGER,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  #loadRooms() {
    const query = this.#db.prepare('SELECT id, data FROM rooms');
    const rows = query.all();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data);
        const room = Room.fromJSON(parsed);
        super.set(room);
      } catch {

      }
    }
  }

  set(room) {
    super.set(room);
    const data = typeof room.toJSON === 'function' ? JSON.stringify(room.toJSON()) : JSON.stringify(room);
    const stmt = this.#db.prepare(`
      INSERT INTO rooms (id, host_id, created_at, data, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        host_id = excluded.host_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(room.id, room.hostId || '', room.createdAt || Date.now(), data, Date.now());
  }

  delete(roomId) {
    const deleted = super.delete(roomId);
    const stmt = this.#db.prepare('DELETE FROM rooms WHERE id = ?');
    stmt.run(roomId);
    return deleted;
  }
}

