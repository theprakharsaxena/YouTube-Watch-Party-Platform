export const DISPLAY_NAME_MAX = 24;

/** Returns an error message, or '' when valid. Server re-validates independently. */
export function validateDisplayName(value) {
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name) return 'Enter a display name.';
  if (name.length > DISPLAY_NAME_MAX) return `Keep it to ${DISPLAY_NAME_MAX} characters or fewer.`;
  return '';
}
