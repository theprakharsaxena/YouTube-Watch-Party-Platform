import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Dialog({ open, onClose, title, description, children, footer, labelledBy = 'dialog-title' }) {
  const previousFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  const dialogRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    if (document.activeElement && (!dialogRef.current || !dialogRef.current.contains(document.activeElement))) {
      previousFocus.current = document.activeElement;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (
        previousFocus.current instanceof HTMLElement &&
        (!dialogRef.current || !dialogRef.current.contains(previousFocus.current))
      ) {
        previousFocus.current.focus();
      }
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
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
    </div>,
    document.body,
  );
}

