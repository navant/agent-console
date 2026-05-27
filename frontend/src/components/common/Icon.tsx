import React, { SVGProps } from 'react';

export type IconName =
  | 'folder'
  | 'folder-open'
  | 'file'
  | 'file-code'
  | 'chevron'
  | 'chev-down'
  | 'code'
  | 'chat'
  | 'sparkle'
  | 'search'
  | 'plus'
  | 'x'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'layout'
  | 'kanban'
  | 'history'
  | 'send'
  | 'attach'
  | 'slash'
  | 'play'
  | 'check'
  | 'download'
  | 'eye'
  | 'panel'
  | 'panel-right'
  | 'book'
  | 'terminal'
  | 'rocket'
  | 'flask'
  | 'bug'
  | 'image'
  | 'sheet'
  | 'arrow-right'
  | 'pin'
  | 'more-h'
  | 'user'
  | 'lock'
  | 'home'
  | 'git'
  | 'refresh'
  | 'list'
  | 'flag'
  | 'expand'
  | 'minimize'
  | 'arrows-lr'
  | 'target';

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

const PATHS: Record<IconName, React.ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  'folder-open': (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H3" />
      <path d="m3 9 1.8 8.4A2 2 0 0 0 6.8 19h10.4a2 2 0 0 0 2-1.6L21 9" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  'file-code': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="m10 13-2 2 2 2M14 13l2 2-2 2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  'chev-down': <path d="m6 9 6 6 6-6" />,
  code: (
    <>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z" />,
  sparkle: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
      <path d="M19 3v3M20.5 4.5h-3M5 17v3M6.5 18.5h-3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.96l.06-.06A1.65 1.65 0 0 0 4.66 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1A1.65 1.65 0 0 0 4.27 7.18l-.06-.06A2 2 0 1 1 7.04 4.27l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />,
  layout: (
    <>
      <rect x="3" y="3" width="7" height="18" rx="1.5" />
      <rect x="14" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" />
    </>
  ),
  kanban: (
    <>
      <rect x="3" y="3" width="6" height="18" rx="1.5" />
      <rect x="10.5" y="3" width="6" height="12" rx="1.5" />
      <rect x="18" y="3" width="3" height="8" rx="1.5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </>
  ),
  attach: <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 6" />,
  slash: <path d="M19 5 5 19" />,
  play: <path d="m6 4 14 8-14 8Z" />,
  check: <path d="m5 12 4 4 10-10" />,
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  'panel-right': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
    </>
  ),
  book: (
    <>
      <path d="M4 4a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" />
      <path d="M4 18a2 2 0 0 1 2-2h12" />
    </>
  ),
  terminal: (
    <>
      <path d="m4 7 4 5-4 5M12 17h8" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.3-.05-3.1-.84-.71-2.3-.7-3.1 0Z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19L14 9V3" />
    </>
  ),
  bug: (
    <>
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M19 7 17 9M5 7l2 2M19 13h-3M5 13h3M19 19l-2-2M5 19l2-2M12 6V3M9 3l3 3 3-3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  sheet: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  'arrow-right': <path d="M5 12h14M13 5l7 7-7 7" />,
  pin: <path d="M12 17v5M9 11V4h6v7l3 4H6Z" />,
  'more-h': (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  home: <path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2v-9Z" />,
  git: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 8v8M8 12h8" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  flag: <path d="M4 21V4l8 3 8-3v13l-8 3-8-3Z" />,
  expand: (
    <>
      <path d="M21 3h-6M21 3v6M21 3l-7 7M3 21h6M3 21v-6M3 21l7-7" />
    </>
  ),
  minimize: <path d="M15 3v6h6M3 15h6v6" />,
  'arrows-lr': (
    <>
      <path d="m7 17-5-5 5-5M2 12h12M17 7l5 5-5 5M22 12H10" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
};

export default function Icon({ name, size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
