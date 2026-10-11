import { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';
import { SERVER_URL } from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'sidelight_auth_token';
const USER_KEY = 'sidelight_auth_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Clean out legacy username-only records
      if (parsed && !parsed.displayName && parsed.username) {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 && !cancelled) {
            saveAuth(null, null);
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.user) {
          setUser(data.user);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAuth = (tokenVal, userVal) => {
    setToken(tokenVal);
    setUser(userVal);
    if (tokenVal) localStorage.setItem(TOKEN_KEY, tokenVal);
    else localStorage.removeItem(TOKEN_KEY);
    if (userVal) localStorage.setItem(USER_KEY, JSON.stringify(userVal));
    else localStorage.removeItem(USER_KEY);
    try {
      const sock = getSocket();
      sock.auth = { token: tokenVal || undefined };
      if (!tokenVal && sock.connected) {
        sock.disconnect();
      } else if (tokenVal && !sock.connected) {
        sock.connect();
      }
    } catch {
      /* socket not initialized yet */
    }
  };

  const login = async ({ email, password }) => {
    const res = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    saveAuth(data.token, data.user);
    return data.user;
  };

  const register = async ({ email, password, displayName }) => {
    const res = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    saveAuth(data.token, data.user);
    return data.user;
  };

  const guestLogin = async (displayName) => {
    const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Guest session failed');
    saveAuth(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    saveAuth(null, null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(user && !user.isGuest),
        isGuest: Boolean(user?.isGuest),
        login,
        register,
        guestLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
