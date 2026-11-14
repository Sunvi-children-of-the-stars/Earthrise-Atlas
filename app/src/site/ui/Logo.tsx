/** Earthrise Atlas mark: an ice-green horizon arc with the Earth (white disc) rising on it. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M4 22 A12 12 0 0 1 28 22" fill="none" stroke="var(--ice)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="13" r="3.6" fill="var(--text)" />
    </svg>
  );
}

/** Same mark as a data-URI SVG, for the favicon (index.html). */
export const LOGO_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23000'/%3E%3Cpath d='M4 22 A12 12 0 0 1 28 22' fill='none' stroke='%239bf0d8' stroke-width='2.4' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='13' r='3.6' fill='%23fff'/%3E%3C/svg%3E";
