import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal dialog with focus restoration, Escape key dismissal,
 * and backdrop-click handling that integrates seamlessly beneath high-priority toasts.
 */
export default function Dialog({ open, onClose, title, description, children, footer, labelledBy = 'dialog-title' }) {
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Lock body scroll while dialog is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(); // click on the backdrop
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={description ? `${labelledBy}-desc` : undefined}
      >
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 id={labelledBy} className="dialog__title">{title}</h2>
            <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {description && <p id={`${labelledBy}-desc`} className="dialog__description">{description}</p>}
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      </div>
    </div>
  );
}
