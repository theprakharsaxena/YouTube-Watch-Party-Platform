import { Link, Route, Routes } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import LandingPage from '../features/landing/LandingPage.jsx';
import CreateRoomPage from '../features/rooms/CreateRoomPage.jsx';
import JoinRoomPage from '../features/rooms/JoinRoomPage.jsx';
import RoomPage from '../features/rooms/RoomPage.jsx';
import FormShell from '../components/FormShell.jsx';

function NotFound() {
  return (
    <FormShell title="Page not found">
      <div className="status-card">
        <SearchX size={28} aria-hidden="true" className="status-card__icon" />
        <p>That page does not exist.</p>
        <Link className="btn btn--primary btn--md" to="/">Back to start</Link>
      </div>
    </FormShell>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<CreateRoomPage />} />
      <Route path="/join" element={<JoinRoomPage />} />
      <Route path="/r/:roomId" element={<RoomPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
