const REACTIONS = ['🔥', '❤️', '😂', '👏', '🍿', '🤯', '🚀', '💯'];

export default function ReactionPicker({ onSendReaction }) {
  return (
    <div className="reaction-picker" role="toolbar" aria-label="Quick reactions">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-picker__btn"
          aria-label={`React ${emoji}`}
          onClick={() => onSendReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
