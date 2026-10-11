import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useState, useEffect } from 'react';
import AuthDialog from './AuthDialog.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from './Toast.jsx';

function Wrapper({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}

function RerenderingParent() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + 1);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <Wrapper>
      <AuthDialog open={open} onClose={() => setOpen(false)} />
    </Wrapper>
  );
}

describe('AuthDialog focus retention', () => {
  it('keeps focus on password field when parent re-renders rapidly', async () => {
    const user = userEvent.setup();
    render(<RerenderingParent />);

    const passwordInput = screen.getByPlaceholderText(/at least 6 characters/i);
    await user.click(passwordInput);

    expect(document.activeElement).toBe(passwordInput);

    // Wait 120ms to allow parent re-renders
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });

    console.log('Active element after wait (login password):', document.activeElement.tagName, document.activeElement.name);
    expect(document.activeElement).toBe(passwordInput);
  });

  it('keeps focus on display name and password in sign up mode when parent re-renders rapidly', async () => {
    const user = userEvent.setup();
    render(<RerenderingParent />);

    // Switch to Sign Up tab
    const signUpTab = screen.getByRole('tab', { name: /sign up/i });
    await user.click(signUpTab);

    // Focus display name
    const displayNameInput = screen.getByPlaceholderText(/e\.g\. prakhar saxena/i);
    await user.click(displayNameInput);
    expect(document.activeElement).toBe(displayNameInput);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });

    console.log('Active element after wait (signup display name):', document.activeElement.tagName, document.activeElement.name);
    expect(document.activeElement).toBe(displayNameInput);

    // Focus password
    const passwordInput = screen.getByPlaceholderText(/at least 6 characters/i);
    await user.click(passwordInput);
    expect(document.activeElement).toBe(passwordInput);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });

    console.log('Active element after wait (signup password):', document.activeElement.tagName, document.activeElement.name);
    expect(document.activeElement).toBe(passwordInput);
  });
});
