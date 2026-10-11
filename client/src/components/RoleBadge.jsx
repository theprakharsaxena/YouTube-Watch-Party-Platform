import { Crown, ShieldCheck, UserCheck, Eye } from 'lucide-react';
import { ROLE_LABELS } from '../utils/formatters.js';

const ICONS = { host: Crown, moderator: ShieldCheck, participant: UserCheck, viewer: Eye };

export default function RoleBadge({ role }) {
  const Icon = ICONS[role] ?? Eye;
  return (
    <span className={`role-badge role-badge--${role}`}>
      <Icon size={12} aria-hidden="true" />
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

