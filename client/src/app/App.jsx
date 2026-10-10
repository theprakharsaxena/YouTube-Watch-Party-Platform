import { ToastProvider } from '../components/Toast.jsx';
import { RoomProvider } from '../hooks/useRoom.jsx';
import AppRoutes from './router.jsx';

export default function App() {
  return (
    <ToastProvider>
      <RoomProvider>
        <AppRoutes />
      </RoomProvider>
    </ToastProvider>
  );
}
