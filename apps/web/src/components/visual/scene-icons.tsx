/*
  As peças das cenas "antes × depois". Traço fino numa grade de 24, no mesmo
  peso dos glifos do decode. A lista de nomes é o vocabulário que o modelo
  recebe (decoded/visual/scene.py, ICONS); nome fora dela vira "cube".
*/

export const SCENE_ICONS = {
  car: (
    <>
      <path d="M3.5 15.5v-3l2-4.5h13l2 4.5v3z" />
      <path d="M6.5 8l1.3-2.5h8.4L17.5 8" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="5.5" r="2.4" />
      <path d="M12 8.5v7M12 15.5l-3 5M12 15.5l3 5M7.5 11.5h9" />
    </>
  ),
  people: (
    <>
      <circle cx="8.5" cy="7" r="2.2" />
      <circle cx="16" cy="7.5" r="2" />
      <path d="M4 19c.4-4 2.2-6 4.5-6s4.1 2 4.5 6M12.8 15.5c.6-1.6 1.7-2.5 3.2-2.5 2 0 3.5 1.8 4 6" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="10" />
      <path d="M12 8V4.5M10.5 4.5h3M9 18v2.5M15 18v2.5M3 12v3M21 12v3" />
      <circle cx="9.3" cy="12.5" r="1.1" />
      <circle cx="14.7" cy="12.5" r="1.1" />
    </>
  ),
  arm: (
    <>
      <path d="M4 20.5h8M8 20.5v-3l4-8 6 2.5" />
      <circle cx="12" cy="9.5" r="1.4" />
      <path d="M18 12l2 3.5M18 12l2.8-1.5" />
    </>
  ),
  drone: (
    <>
      <rect x="9.5" y="10" width="5" height="4" />
      <path d="M9.5 11 5.5 7.5M14.5 11l4-3.5M9.5 13l-4 3.5M14.5 13l4 3.5" />
      <path d="M2.5 7.5h6M15.5 7.5h6M2.5 16.5h6M15.5 16.5h6" />
    </>
  ),
  document: (
    <>
      <path d="M6 3.5h8.5L18 7v13.5H6z" />
      <path d="M14.5 3.5V7H18M8.5 11h7M8.5 14h7M8.5 17h4.5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v10.5H11l-4.5 3.5v-3.5H4z" />
      <path d="M7.5 9h9M7.5 12h6" />
    </>
  ),
  code: (
    <>
      <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 5l-3 14" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  model: (
    <>
      <circle cx="5" cy="7" r="1.6" />
      <circle cx="5" cy="17" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="7" r="1.6" />
      <circle cx="19" cy="17" r="1.6" />
      <path d="M6.4 7.8l4.2 3.4M6.4 16.2l4.2-3.4M13.4 11.2l4.2-3.4M13.4 12.8l4.2 3.4" />
    </>
  ),
  chip: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
  server: (
    <>
      <rect x="4.5" y="4" width="15" height="6.5" />
      <rect x="4.5" y="13.5" width="15" height="6.5" />
      <path d="M7.5 7.2h1.5M7.5 16.7h1.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8h4l1.5-2.5h6L16.5 8h4v11h-17z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7.5 16v-4M11.5 16V8.5M15.5 16v-6M19 16V6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.8 5.5 1.7 5.5 4.6 0 1.2-1.1 2.1-2.8 2.1-1.2 0-2.3-.6-2.8-1.6M12 6v1.5M12 16.7v1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="10" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v6c0 4.2-3 7.3-7 8.5-4-1.2-7-4.3-7-8.5V6z" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v5M12 16.8v.4" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  flag: (
    <>
      <path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12c2.5-4.3 5.7-6.5 9.5-6.5s7 2.2 9.5 6.5c-2.5 4.3-5.7 6.5-9.5 6.5S5 16.3 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4.5L16 4.5l3.5 3.5-11 11z" />
      <path d="M13.5 7l3.5 3.5" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3.4-.6-.6-3.4L16 5.5A4.5 4.5 0 0 0 14.5 4z" />
    </>
  ),
  bolt: <path d="M13.5 3 5.5 13.5h6L10.5 21l8-10.5h-6z" />,
  cube: (
    <>
      <path d="M12 3.5 19.5 7.5v9L12 20.5l-7.5-4v-9z" />
      <path d="M4.5 7.5 12 11.5l7.5-4M12 11.5v9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bug: (
    <>
      <rect x="7.5" y="8" width="9" height="11" rx="0" />
      <path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8M4 11h3.5M16.5 11H20M4 16h3.5M16.5 16H20M12 11v8" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h8.5M17.5 12v3M20.5 12v2.5" />
    </>
  ),
  stop: (
    <>
      <path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7z" />
      <path d="M8.5 12h7" />
    </>
  ),
  light: (
    <>
      <rect x="8" y="3" width="8" height="16" />
      <circle cx="12" cy="6.8" r="1.6" />
      <circle cx="12" cy="11" r="1.6" />
      <circle cx="12" cy="15.2" r="1.6" />
      <path d="M12 19v2.5" />
    </>
  ),
} as const;

export type SceneIconName = keyof typeof SCENE_ICONS;

export function sceneIcon(name: string): React.ReactNode {
  return SCENE_ICONS[(name in SCENE_ICONS ? name : "cube") as SceneIconName];
}
