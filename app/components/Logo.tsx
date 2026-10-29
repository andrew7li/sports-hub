// The site's mark, wherever "SH" used to stand in as a placeholder: a navy
// badge with three ascending bars, one accent color per sport this hub
// covers (same hex values as lib/sports.ts). Matches app/favicon.ico exactly
// so the browser tab and the in-app logo are the same mark. Size is
// controlled entirely by `className` (e.g. "size-7"), same as every other
// icon in this app.
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="SportsHub"
    >
      <rect width="32" height="32" rx="6" fill="#0f2140" />
      <rect x="5.5" y="18.5" width="5" height="8" rx="1.5" fill="#0ea5e9" />
      <rect x="13.5" y="13" width="5" height="13.5" rx="1.5" fill="#f97316" />
      <rect x="21.5" y="7.5" width="5" height="19" rx="1.5" fill="#10b981" />
    </svg>
  );
}
