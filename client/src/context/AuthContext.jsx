import { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'sidelight_auth_token';
const USER_KEY = 'sidelight_auth_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const saveAuth = (tokenVal, userVal) => {
    setToken(tokenVal);
    setUser(userVal);
    if (tokenVal) localStorage.setItem(TOKEN_KEY, tokenVal);
    else localStorage.removeItem(TOKEN_KEY);
    if (userVal) localStorage.setItem(USER_KEY, JSON.stringify(userVal));
    else localStorage.removeItem(USER_KEY);
    try {
      getSocket().auth = { token: tokenVal || undefined };
    } catch {
      /* socket not initialized yet */
    }
  };

  const login = async ({ username, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    saveAuth(data.token, data.user);
    return data.user;
  };

  const register = async ({ username, password }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    saveAuth(data.token, data.user);
    return data.user;
  };

  const guestLogin = async (displayName) => {
    const res = await fetch('/api/auth/guest', {
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
