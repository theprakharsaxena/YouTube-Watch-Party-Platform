import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function FormShell({ title, lead, children, footer }) {
  return (
    <div className="shell">
      <header className="shell__header">
        <Brand />
      </header>
      <main className="shell__main">
        <div className="form-card">
          <h1 className="form-card__title">{title}</h1>
          {lead && <p className="form-card__lead">{lead}</p>}
          {children}
        </div>
        {footer ?? (
          <p className="shell__foot">
            <Link to="/">Back to start</Link>
          </p>
        )}
      </main>
    </div>
  );
}

