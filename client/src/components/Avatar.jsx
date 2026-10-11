import { initials } from '../utils/formatters.js';

const TINTS = ['#f2a65a', '#ef7b6a', '#d9b88f', '#e4c07a', '#c98b7a', '#9fb4a1'];

function tintFor(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export default function Avatar({ name, size = 32, dimmed = false }) {
  return (
    <span
      className={`avatar${dimmed ? ' avatar--dimmed' : ''}`}
      style={{ '--avatar-size': `${size}px`, '--avatar-tint': tintFor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

