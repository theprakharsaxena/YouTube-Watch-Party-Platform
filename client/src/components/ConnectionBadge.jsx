import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const LABELS = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Offline',
};

export default function ConnectionBadge({ status }) {
  const Icon = status === 'connected' ? Wifi : status === 'disconnected' ? WifiOff : Loader2;
  return (
    <span className={`conn-badge conn-badge--${status}`} role="status" aria-label={`Connection: ${LABELS[status]}`}>
      <Icon size={14} className={status === 'connected' || status === 'disconnected' ? '' : 'spin'} aria-hidden="true" />
      <span className="conn-badge__label">{LABELS[status]}</span>
    </span>
  );
}

