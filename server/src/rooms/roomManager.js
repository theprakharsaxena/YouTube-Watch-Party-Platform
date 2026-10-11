import { randomInt } from 'node:crypto';
import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH } from './roomValidation.js';

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

