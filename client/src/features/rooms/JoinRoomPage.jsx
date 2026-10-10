import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import FormShell from '../../components/FormShell.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { fetchRoomInfo } from '../../services/api.js';
import { parseRoomInput } from '../../utils/formatters.js';

/** Step 1 of joining: paste a code or invite link; we verify the room exists before moving on. */
export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const code = parseRoomInput(value);
    if (!code) {
      setError('Paste an invite link or a 10-character room code.');
      return;
    }
    setBusy(true);
    try {
      await fetchRoomInfo(code);
      navigate(`/r/${code}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormShell title="Join a room" lead="Paste the invite link you were sent, or type the room code.">
      <form onSubmit={handleSubmit} noValidate className="form-stack">
        <Field
          label="Invite link or room code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          autoComplete="off"
          autoFocus
          spellCheck={false}
          placeholder="ABCDE-FGHJK"
        />
        <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={busy}>
          {busy ? 'Checking room…' : 'Continue'}
        </Button>
      </form>
    </FormShell>
  );
}
