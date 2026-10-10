import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from './ChatPanel.jsx';
import ReactionPicker from '../reactions/ReactionPicker.jsx';

describe('ChatPanel component', () => {
  it('renders messages and allows sending a message', async () => {
    const onSendMessage = vi.fn();
    const messages = [
      { id: '1', senderId: 'u1', senderName: 'Alice', senderRole: 'host', text: 'Welcome everyone!', timestamp: 1000 },
      { id: '2', senderId: 'me', senderName: 'Bob', senderRole: 'participant', text: 'Hey Alice!', timestamp: 2000 },
    ];

    render(<ChatPanel messages={messages} meId="me" onSendMessage={onSendMessage} />);

    expect(screen.getByText('Welcome everyone!')).toBeInTheDocument();
    expect(screen.getByText('Hey Alice!')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/send a message/i);
    await userEvent.type(input, 'Loving the video!{enter}');

    expect(onSendMessage).toHaveBeenCalledWith('Loving the video!');
  });

  it('disables chat input and send button for viewers instead of hiding them', () => {
    const onSendMessage = vi.fn();
    render(<ChatPanel messages={[]} meId="viewer-1" onSendMessage={onSendMessage} isViewer={true} />);

    const input = screen.getByPlaceholderText(/log in to join the chat/i);
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toBeDisabled();

    expect(screen.getByText(/viewers can read messages/i)).toBeInTheDocument();
  });
});

describe('ReactionPicker component', () => {
  it('triggers onSendReaction when emoji is clicked', async () => {
    const onSendReaction = vi.fn();
    render(<ReactionPicker onSendReaction={onSendReaction} />);

    const fireBtn = screen.getByRole('button', { name: /react 🔥/i });
    expect(fireBtn).toBeInTheDocument();

    await userEvent.click(fireBtn);
    expect(onSendReaction).toHaveBeenCalledWith('🔥');
  });

  it('disables reaction buttons when disabled is true instead of hiding them', async () => {
    const onSendReaction = vi.fn();
    render(<ReactionPicker onSendReaction={onSendReaction} disabled={true} />);

    const fireBtn = screen.getByRole('button', { name: /react 🔥/i });
    expect(fireBtn).toBeInTheDocument();
    expect(fireBtn).toBeDisabled();

    await userEvent.click(fireBtn);
    expect(onSendReaction).not.toHaveBeenCalled();
  });
});
