/**
 * Floating synchronized emoji reaction particles drifting up over the video stage.
 */
export default function ReactionOverlay({ reactions }) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="reaction-overlay" aria-hidden="true">
      {reactions.map((r) => (
        <span
          key={r.key}
          className="reaction-particle"
          style={{ left: `${r.left}%` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
