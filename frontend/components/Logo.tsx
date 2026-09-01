export function Logo({ size = 20 }: { size?: number }) {
  // 8-point spark mark — a nod to Mithril's asterisk logo.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-ink"
    >
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2.5v19" />
        <path d="M2.5 12h19" />
        <path d="M5.2 5.2l13.6 13.6" />
        <path d="M18.8 5.2L5.2 18.8" />
      </g>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </svg>
  );
}
