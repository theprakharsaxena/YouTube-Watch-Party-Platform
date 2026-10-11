import { useState } from 'react';
import { ArrowRight, Check, Crown, Eye, Link2, RefreshCw, ShieldCheck, Minus, User, UserCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import InteractiveRoomPreview from './InteractiveRoomPreview.jsx';
import InteractiveCanvas from './InteractiveCanvas.jsx';
import InteractiveSyncFlow from './InteractiveSyncFlow.jsx';
import AuthDialog from '../../components/AuthDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const PERMISSIONS = [
  { action: 'Requires login / registered account', host: true, moderator: true, participant: true, viewer: false },
  { action: 'Watch in sync', host: true, moderator: true, participant: true, viewer: true },
  { action: 'Play, pause and seek', host: true, moderator: true, participant: false, viewer: false },
  { action: 'Change the video directly', host: true, moderator: true, participant: false, viewer: false },
  { action: 'Request video change (with approval)', host: true, moderator: true, participant: true, viewer: false },
  { action: 'Promote moderators & viewers', host: true, moderator: false, participant: false, viewer: false },
  { action: 'Remove participants & transfer host', host: true, moderator: false, participant: false, viewer: false },
];

function Mark({ on }) {
  return on ? (
    <Check size={16} aria-label="Allowed" className="perm-yes" />
  ) : (
    <Minus size={16} aria-label="Not allowed" className="perm-no" />
  );
}

export default function LandingPage() {
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="landing">

      <InteractiveCanvas />

      <div className="landing__hero-fold">
        <header className="landing__nav">
          <Brand />
          <nav aria-label="Primary" className="landing__nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#roles">Roles</a>
            <Link to="/join" className="btn btn--ghost btn--sm landing__nav-join">Join a room</Link>
            {user && !user.isGuest ? (
              <div className="landing__nav-user">
                <span className="landing__nav-username">
                  <User size={14} aria-hidden="true" />
                  <span className="landing__nav-name">{user.displayName}</span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm landing__nav-logout" onClick={logout}>
                  Log out
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--secondary btn--sm landing__nav-auth" onClick={() => setAuthOpen(true)}>
                <span className="landing__nav-auth-long">Log in / Register</span>
                <span className="landing__nav-auth-short">Log in</span>
              </button>
            )}
          </nav>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              <span>A shared cinema for small groups</span>
            </p>
            <h1 id="hero-title" className="hero__title">
              One video.<br />
              <em>Everyone in sync.</em>
            </h1>
            <p className="hero__lead">
              Open a room, send the link, and watch YouTube together from separate places. The host
              controls the remote; everyone else just presses nothing and watches.
            </p>
            <div className="hero__actions">
              <Link to="/create" className="btn btn--primary btn--lg" id="start-party">
                Start a watch party <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/join" className="btn btn--secondary btn--lg" id="join-room">Join a room</Link>
            </div>
            <p className="hero__fine">No account needed. Pick a name and you're in.</p>
          </div>
          <div className="hero__preview">
            <InteractiveRoomPreview />
          </div>
        </section>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      <main>

        <section id="how-it-works" className="section" aria-labelledby="how-title">
          <h2 id="how-title" className="section__title">How the sync works</h2>
          <p className="section__lead">
            Real-time lockstep playback powered by central server clock synchronization.
          </p>
          <InteractiveSyncFlow />
          <ol className="steps">
            <li>
              <span className="steps__icon"><Link2 size={18} aria-hidden="true" /></span>
              <h3>The server holds the truth</h3>
              <p>The room's video, play state and position live on the server. Nobody's browser is the source of truth.</p>
            </li>
            <li>
              <span className="steps__icon"><RefreshCw size={18} aria-hidden="true" /></span>
              <h3>Everyone applies the same update</h3>
              <p>A play, pause or seek is checked, saved, then broadcast. Late joiners get the current position straight away.</p>
            </li>
            <li>
              <span className="steps__icon"><Eye size={18} aria-hidden="true" /></span>
              <h3>Small drift is left alone</h3>
              <p>Your player only jumps when it has genuinely fallen behind. It's close, not frame-perfect: buffering and networks vary.</p>
            </li>
          </ol>
        </section>

        <section id="roles" className="section" aria-labelledby="roles-title">
          <h2 id="roles-title" className="section__title">Who can do what</h2>
          <p className="section__lead">
            Permissions are enforced on the server, not just hidden in the interface.
          </p>
          <div className="perm-table-wrap">
            <table className="perm-table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Action</span></th>
                  <th scope="col"><Crown size={14} aria-hidden="true" /> Host</th>
                  <th scope="col"><ShieldCheck size={14} aria-hidden="true" /> Moderator</th>
                  <th scope="col"><UserCheck size={14} aria-hidden="true" /> Participant</th>
                  <th scope="col"><Eye size={14} aria-hidden="true" /> Viewer</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row) => (
                  <tr key={row.action}>
                    <th scope="row">{row.action}</th>
                    <td><Mark on={row.host} /></td>
                    <td><Mark on={row.moderator} /></td>
                    <td><Mark on={row.participant} /></td>
                    <td><Mark on={row.viewer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <Brand />
        <p>
          Rooms live in server memory and end when everyone leaves. Names are lightweight session
          identities, not verified accounts.
        </p>
      </footer>
    </div>
  );
}

