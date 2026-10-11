import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, User, UserPlus } from 'lucide-react';
import Dialog from './Dialog.jsx';
import Button from './Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';

export default function AuthDialog({ open, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login');
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

  const displayNameRef = useRef(null);
  const emailRef = useRef(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
        if (mode === 'register') {
          displayNameRef.current?.focus();
        } else {
          emailRef.current?.focus();
        }
      }
    }
    prevOpenRef.current = open;
  }, [open, mode]);

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setTimeout(() => {
      if (newMode === 'register') {
        displayNameRef.current?.focus();
      } else {
        emailRef.current?.focus();
      }
    }, 0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Log in to WatchAlong' : 'Create an Account'}
      description="Save your watch party identity and sign in before hosting or joining rooms."
      labelledBy="auth-dialog-title"
    >
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
          onClick={() => handleSwitchMode('login')}
        >
          Log In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
          onClick={() => handleSwitchMode('register')}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-stack auth-form">
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="auth-display-name" className="field__label">Display Name</label>
            <div className="auth-input-box">
              <User size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                ref={displayNameRef}
                id="auth-display-name"
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="e.g. Prakhar Saxena"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                maxLength={32}
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="auth-email" className="field__label">Email</label>
          <div className="auth-input-box">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="e.g. prakhar@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="auth-password" className="field__label">Password</label>
          <div className="auth-input-box">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="auth-password"
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
        </div>

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
                onClick={() => handleSwitchMode('register')}
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
                onClick={() => handleSwitchMode('login')}
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

