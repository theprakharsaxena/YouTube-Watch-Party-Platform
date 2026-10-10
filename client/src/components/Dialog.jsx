import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal built on the native <dialog>: focus trapping, Escape handling and
 * inert background come from the browser. We add backdrop-click dismissal and focus return.
 */
export default function Dialog({ open, onClose, title, description, children, footer, labelledBy = 'dialog-title' }) {
  const ref = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (!open && previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={labelledBy}
      aria-describedby={description ? `${labelledBy}-desc` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
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
      )}
    </dialog>
  );
}
