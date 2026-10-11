import { Pause, Play, Lock } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';

const SAMPLE = [
  { name: 'Hana', role: 'host' },
  { name: 'Ines', role: 'moderator' },
  { name: 'Theo', role: 'participant' },
];

export default function RoomPreview() {
  return (
    <figure className="preview" aria-label="Illustration of a WatchAlong watch room">
      <div className="preview__window">
        <div className="preview__bar">
          <span className="preview__code">ROOM · K7QX2-M9WTA</span>
          <span className="conn-badge conn-badge--connected"><span className="conn-badge__label">Connected</span></span>
        </div>
        <div className="preview__body">
          <div className="preview__stage">
            <div className="preview__screen" aria-hidden="true">
              <span className="preview__glow" />
              <span className="preview__play"><Play size={22} /></span>
            </div>
            <div className="preview__row">
              <span className="status-pill status-pill--playing"><span className="status-pill__dot" />Playing for everyone</span>
              <span className="sync-note sync-note--synced">In step with the room</span>
            </div>
            <div className="preview__transport" aria-hidden="true">
              <span className="play-btn play-btn--static"><Pause size={16} /></span>
              <span className="scrubber scrubber--readonly" style={{ '--progress': '38%' }} />
            </div>
          </div>
          <ul className="preview__rail" aria-hidden="true">
            {SAMPLE.map((p) => (
              <li key={p.name} className="person">
                <Avatar name={p.name} size={28} />
                <div className="person__text">
                  <span className="person__name">{p.name}</span>
                  <RoleBadge role={p.role} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="preview__caption">
        <Lock size={13} aria-hidden="true" /> Participants watch; the host and moderators hold the remote.
      </figcaption>
    </figure>
  );
}

