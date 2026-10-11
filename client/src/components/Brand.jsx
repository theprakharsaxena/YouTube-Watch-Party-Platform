import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.png';

export function BrandMark({ size = 32, className = '' }) {
  return (
    <img
      src={logoUrl}
      alt="WatchAlong logo"
      width={size}
      height={size}
      className={`brand-mark ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        filter: 'drop-shadow(0 2px 6px rgba(239, 68, 68, 0.25))',
      }}
    />
  );
}

export default function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="WatchAlong home">
      <BrandMark size={32} />
      <span className="brand__word">WatchAlong</span>
    </Link>
  );
}
