type IconName =
  | "home"
  | "chart"
  | "grid"
  | "calendar"
  | "kanban"
  | "megaphone"
  | "lightbulb"
  | "film"
  | "sparkles"
  | "gem"
  | "sliders"
  | "logout"
  | "sun"
  | "moon";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7.5 16v-5" />
      <path d="M12 16V7" />
      <path d="M16.5 16v-8" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 2.5V6" />
      <path d="M16 2.5V6" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.5" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="9.75" y="4" width="4.5" height="10" rx="1.2" />
      <rect x="16" y="4" width="4.5" height="13" rx="1.2" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v3l4 .8V19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3.4L21 18V7L3 11Z" />
      <path d="M21 10.5a2.5 2.5 0 0 1 0 4" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.3 2.2h4.6c.2-.9.6-1.6 1.3-2.2A6 6 0 0 0 12 3Z" />
    </>
  ),
  film: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M8 4.5v15" />
      <path d="M16 4.5v15" />
      <path d="M3.5 9h4.5" />
      <path d="M3.5 15h4.5" />
      <path d="M16 9h4.5" />
      <path d="M16 15h4.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4Z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  gem: (
    <>
      <path d="M7 3.5h10l4 6-9 11-9-11 4-6Z" />
      <path d="M3 9.5h18" />
      <path d="M12 20.5 8.5 9.5 12 3.5l3.5 6-3.5 11Z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10" />
      <circle cx="17" cy="7" r="2.2" />
      <path d="M20 17H10" />
      <circle cx="7" cy="17" r="2.2" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M10 12h10" />
      <path d="m16.5 8.5 3.5 3.5-3.5 3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5" />
      <path d="M12 19v2.5" />
      <path d="M4.9 4.9l1.8 1.8" />
      <path d="M17.3 17.3l1.8 1.8" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M4.9 19.1l1.8-1.8" />
      <path d="M17.3 6.7l1.8-1.8" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />,
};

export default function Icon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
