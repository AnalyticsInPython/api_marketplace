/* Compact 16px stroke icon set for the console shell. */

type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconOverview = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </svg>
);

export const IconSuppliers = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="6" rx="1.6" />
    <rect x="3" y="14" width="18" height="6" rx="1.6" />
    <path d="M6.5 7h.01M6.5 17h.01" />
  </svg>
);

export const IconRouting = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="12" r="2" />
    <path d="M7 6h4a2 2 0 0 1 2 2v0M7 18h4a2 2 0 0 0 2-2v0M13 12h4" />
  </svg>
);

export const IconPlay = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
);

export const IconEvents = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12h4l2 5 4-12 2 7h6" />
  </svg>
);

export const IconKey = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="7.5" cy="15" r="4" />
    <path d="M10.5 12.5 20 3M17 6l2 2M14 9l2 2" />
  </svg>
);

export const IconSettings = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
);

export const IconDocs = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5V4.5Z" />
    <path d="M9 8h7M9 12h7M9 16h4" />
  </svg>
);

export const IconRocket = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 12l3 3M14.5 4.5C11 6 8 9 7.5 13l3.5 3.5c4-.5 7-3.5 8.5-7 .5-1.5.5-4 .5-4s-2.5 0-5.5-1Z" />
    <circle cx="14.5" cy="9.5" r="1.4" />
  </svg>
);

export const IconSearch = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const IconCalendar = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);

export const IconChevronDown = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronLeft = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconPlus = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMenu = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconClose = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconPin = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconFolder = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);
