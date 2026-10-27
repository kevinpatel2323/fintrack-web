// Fintrack mark: an "F." in a rounded square. Ink and surface swap with the
// theme, so it is black-on-white in dark mode and white-on-black in light.
export default function Logo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={`app-logo ${className}`.trim()}
      aria-hidden
      focusable="false"
    >
      <rect width="28" height="28" rx="6" fill="var(--surface-gray-10)" />
      <rect x="8.5" y="7" width="3.2" height="14" rx="1" fill="var(--ink-base)" />
      <rect x="8.5" y="7" width="10.5" height="3.2" rx="1" fill="var(--ink-base)" />
      <rect x="8.5" y="12.6" width="7.5" height="3" rx="1" fill="var(--ink-base)" />
      <circle cx="18" cy="19.4" r="1.8" fill="var(--ink-base)" />
    </svg>
  );
}
