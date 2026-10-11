import { describe, expect, it } from 'vitest';
import { extractVideoId, validateVideoInput } from './youtube.js';
import { formatRoomCode, formatTime, parseRoomInput } from './formatters.js';

const ID = 'dQw4w9WgXcQ';

describe('extractVideoId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&list=PL1&t=30`],
    [`https://youtu.be/${ID}?si=xyz`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`youtube.com/watch?v=${ID}`],
    [`  ${ID}  `],
  ])('accepts %s', (input) => {
    expect(extractVideoId(input)).toBe(ID);
  });

  it.each([[''], ['hello'], ['https://vimeo.com/123'], ['https://youtube.com.evil.io/watch?v=' + ID], ['javascript:alert(1)'], ['https://youtube.com/watch?v=short']])(
    'rejects %j',
    (input) => {
      expect(extractVideoId(input)).toBeNull();
    },
  );
});

describe('validateVideoInput', () => {
  it('allows empty only when optional', () => {
    expect(validateVideoInput('')).toBe('');
    expect(validateVideoInput('', { required: true })).toMatch(/Paste/);
  });
  it('flags bad links', () => {
    expect(validateVideoInput('nope')).toMatch(/not a supported/);
  });
});

describe('formatters', () => {
  it('formats time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });
  it('round-trips room codes and parses invite links', () => {
    expect(formatRoomCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(parseRoomInput('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(parseRoomInput('https://example.com/r/ABCDE-FGHJK?x=1')).toBe('ABCDEFGHJK');
    expect(parseRoomInput('too-short')).toBeNull();
    expect(parseRoomInput('0OIL0OIL0O')).toBeNull();
  });
});

