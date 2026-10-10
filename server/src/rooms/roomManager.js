import { randomInt } from 'node:crypto';
import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH } from './roomValidation.js';

/**
 * In-memory room store. This is the only module that knows rooms live in a Map,
 * so a MongoDB-backed store could replace it without touching room/playback logic.
 * Limitation: a server restart drops every room.
 */
export class RoomStore {
  #rooms = new Map();

  get(roomId) {
    return this.#rooms.get(roomId);
  }

  set(room) {
    this.#rooms.set(room.id, room);
  }

  delete(roomId) {
    return this.#rooms.delete(roomId);
  }

  get size() {
    return this.#rooms.size;
  }

  all() {
    return [...this.#rooms.values()];
  }

  /** ~50 bits of CSPRNG entropy, collision-checked against live rooms. */
  generateUniqueId() {
    for (;;) {
      let id = '';
      for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
        id += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
      }
      if (!this.#rooms.has(id)) return id;
    }
  }
}
