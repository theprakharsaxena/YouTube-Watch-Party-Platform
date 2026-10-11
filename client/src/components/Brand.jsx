import { Link } from 'react-router-dom';

export function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="WatchAlong" className="brand-mark">
      <rect x="1.4" y="1.4" width="29.2" height="29.2" rx="8.6" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.4" />
      <path d="M13.5 9.5v13l9.5-6.5z" fill="var(--amber)" />
      <path d="M8 11.5v9" stroke="var(--coral)" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

export default function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="WatchAlong home">
      <BrandMark />
      <span className="brand__word">WatchAlong</span>
    </Link>
  );
}
