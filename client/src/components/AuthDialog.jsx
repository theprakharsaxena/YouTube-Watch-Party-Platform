import { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, User, UserPlus } from 'lucide-react';
import Dialog from './Dialog.jsx';
import Button from './Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';

export default function AuthDialog({ open, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === 'register' && !displayName.trim()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        const u = await login({ email: email.trim(), password });
        toast.success(`Welcome back, ${u.displayName}!`);
      } else {
        const u = await register({ email: email.trim(), password, displayName: displayName.trim() });
        toast.success(`Account created! Welcome, ${u.displayName}!`);
      }
      onClose();
      onAuthSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Log in to Sidelight' : 'Create an Account'}
      description="Save your watch party identity and sign in before hosting or joining rooms."
      labelledBy="auth-dialog-title"
    >
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
          onClick={() => setMode('login')}
        >
          Log In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
          onClick={() => setMode('register')}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-stack auth-form">
        {mode === 'register' && (
          <label className="field">
            <span className="field__label">Display Name</span>
            <div className="auth-input-box">
              <User size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="e.g. Prakhar Saxena"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                maxLength={32}
                autoFocus
              />
            </div>
          </label>
        )}

        <label className="field">
          <span className="field__label">Email</span>
          <div className="auth-input-box">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="e.g. prakhar@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <div className="auth-input-box">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              className="auth-input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
        </label>

        <div className="dialog__actions" style={{ marginTop: '8px' }}>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading} icon={mode === 'login' ? LogIn : UserPlus}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.85rem', color: 'var(--ivory-mute)' }}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                className="link-btn"
                style={{ background: 'transparent', border: 0, color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setMode('register')}
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                style={{ background: 'transparent', border: 0, color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setMode('login')}
              >
                Log in
              </button>
            </span>
          )}
        </div>
      </form>
    </Dialog>
  );
}
