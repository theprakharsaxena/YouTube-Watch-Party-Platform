import { ToastProvider } from '../components/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { RoomProvider } from '../hooks/useRoom.jsx';
import AppRoutes from './router.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RoomProvider>
          <AppRoutes />
        </RoomProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

