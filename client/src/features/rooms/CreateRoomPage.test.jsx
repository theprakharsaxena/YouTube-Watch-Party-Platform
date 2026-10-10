import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/Toast.jsx';
import CreateRoomPage from './CreateRoomPage.jsx';

const mockNavigate = vi.fn();
const mockCreateRoom = vi.fn().mockResolvedValue({ roomId: 'test-room-1' });
let mockAuth = { user: null, isAuthenticated: false };

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useRoom.jsx', () => ({
  useRoom: () => ({
    createRoom: mockCreateRoom,
  }),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}));

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <CreateRoomPage />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe('CreateRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables and locks display name when user is authenticated', () => {
    mockAuth = {
      isAuthenticated: true,
      user: { id: 'u1', email: 'alex@example.com', displayName: 'Alex Morgan' },
    };

    renderPage();

    expect(screen.getByText(/Hosting as/i)).toBeInTheDocument();
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Your display name/i);
    expect(nameInput).toHaveValue('Alex Morgan');
    expect(nameInput).toBeDisabled();
    expect(nameInput).toHaveAttribute('readonly');
    expect(screen.getByText(/Your account display name is used as your host display name/i)).toBeInTheDocument();
  });

  it('submits with authenticated display name when creating room', async () => {
    mockAuth = {
      isAuthenticated: true,
      user: { id: 'u1', email: 'alex@example.com', displayName: 'Alex Morgan' },
    };

    renderPage();

    const submitBtn = screen.getByRole('button', { name: /Create room/i });
    fireEvent.click(submitBtn);

    expect(mockCreateRoom).toHaveBeenCalledWith({
      displayName: 'Alex Morgan',
      videoUrl: '',
    });
  });

  it('shows account requirement notice when user is not authenticated', () => {
    mockAuth = {
      isAuthenticated: false,
      user: null,
    };

    renderPage();

    expect(screen.getByText(/Hosting requires a free account/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Your display name/i);
    expect(nameInput).not.toBeDisabled();
  });
});
