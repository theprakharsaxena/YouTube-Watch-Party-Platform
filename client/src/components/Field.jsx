import { useId } from 'react';

export default function Field({ label, error, hint, optional = false, className = '', ...inputProps }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--invalid' : ''} ${className}`.trim()}>
      <label htmlFor={id} className="field__label">
        {label}
        {optional && <span className="field__optional"> · optional</span>}
      </label>
      <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && !error && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

