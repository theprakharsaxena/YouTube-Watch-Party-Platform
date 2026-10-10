const REACTIONS = ['🔥', '❤️', '😂', '👏', '🍿', '🤯', '🚀', '💯'];

export default function ReactionPicker({ onSendReaction, disabled = false }) {
  return (
    <div
      className={`reaction-picker${disabled ? ' reaction-picker--disabled' : ''}`}
      role="toolbar"
      aria-label="Quick reactions"
      title={disabled ? 'Log in to send reactions' : undefined}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-picker__btn"
          aria-label={`React ${emoji}`}
          disabled={disabled}
          title={disabled ? 'Log in to send reactions' : `React ${emoji}`}
          onClick={() => !disabled && onSendReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
