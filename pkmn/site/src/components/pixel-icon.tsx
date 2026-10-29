import { cn } from "@/lib/utils";

const ICONS = {
  ball: {
    size: 12,
    paths: [
      ["fill-pixel-rim", "M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v1H1zM10 2h1v1H10zM1 3h1v1H1zM10 3h1v1H10zM0 4h1v1H0zM5 4h2v1H5zM11 4h1v1H11zM0 5h5v1H0zM7 5h5v1H7zM0 6h1v1H0zM4 6h1v1H4zM7 6h1v1H7zM11 6h1v1H11zM0 7h1v1H0zM5 7h2v1H5zM11 7h1v1H11zM1 8h1v1H1zM10 8h1v1H10zM1 9h1v1H1zM10 9h1v1H10zM2 10h2v1H2zM8 10h2v1H8zM4 11h4v1H4z"],
      ["fill-pixel-red", "M4 1h4v1H4zM2 2h1v1H2zM4 2h6v1H4zM2 3h8v1H2zM1 4h4v1H1zM7 4h4v1H7z"],
      ["fill-white", "M3 2h1v1H3zM5 5h2v1H5zM1 6h3v1H1zM5 6h2v1H5zM8 6h3v1H8zM1 7h4v1H1zM7 7h4v1H7zM2 8h8v1H2zM2 9h8v1H2zM4 10h4v1H4z"],
    ],
  },
  flag: { size: 10, paths: [["fill-current", "M1 0h1v10H1zM2 1h6v1H2zM2 2h7v1H2zM2 3h6v1H2zM2 4h5v1H2z"]] },
  monitor: { size: 10, paths: [["fill-current", "M0 1h10v1H0zM0 2h1v4H0zM9 2h1v4H9zM0 6h10v1H0zM2 3h1v1H2zM4 7h2v1H4zM2 8h6v1H2z"]] },
  people: { size: 10, paths: [["fill-current", "M2 1h2v2H2zM6 1h2v2H6zM1 4h4v4H1zM5 4h4v4H5z"]] },
  key: { size: 10, paths: [["fill-current", "M1 2h3v1H1zM0 3h1v3H0zM4 3h1v3H4zM1 6h3v1H1zM5 4h5v1H5zM7 5h1v2H7zM9 5h1v2H9z"]] },
  arrow: { size: 10, paths: [["fill-current", "M2 1h2v1H2zM3 2h2v1H3zM4 3h2v1H4zM5 4h2v2H5zM4 6h2v1H4zM3 7h2v1H3zM2 8h2v1H2z"]] },
  plus: { size: 10, paths: [["fill-current", "M4 0h2v10H4zM0 4h10v2H0z"]] },
  up: { size: 10, paths: [["fill-current", "M4 1h2v1H4zM3 2h4v1H3zM2 3h6v1H2zM1 4h8v1H1zM4 5h2v4H4z"]] },
  down: { size: 10, paths: [["fill-current", "M4 1h2v4H4zM1 5h8v1H1zM2 6h6v1H2zM3 7h4v1H3zM4 8h2v1H4z"]] },
  alert: { size: 10, paths: [["fill-current", "M4 0h2v6H4zM4 8h2v2H4z"]] },
  menu: { size: 10, paths: [["fill-current", "M1 1h8v2H1zM1 4h8v2H1zM1 7h8v2H1z"]] },
  cross: {
    size: 10,
    paths: [["fill-current", "M1 1h2v1H1zM7 1h2v1H7zM2 2h2v1H2zM6 2h2v1H6zM3 3h2v1H3zM5 3h2v1H5zM4 4h2v2H4zM3 6h2v1H3zM5 6h2v1H5zM2 7h2v1H2zM6 7h2v1H6zM1 8h2v1H1zM7 8h2v1H7z"]],
  },
  upload: { size: 10, paths: [["fill-current", "M4 1h2v1H4zM3 2h4v1H3zM2 3h6v1H2zM4 4h2v4H4zM1 9h8v1H1z"]] },
  wait: { size: 10, paths: [["fill-current", "M2 0h6v1H2zM2 9h6v1H2zM3 1h4v2H3zM4 3h2v1H4zM4 6h2v1H4zM3 7h4v2H3z"]] },
  check: { size: 10, paths: [["fill-current", "M8 1h2v2H8zM7 3h2v2H7zM6 5h2v2H6zM4 7h3v2H4zM2 5h2v2H2zM0 3h2v2H0z"]] },
  zip: {
    size: 10,
    paths: [
      ["fill-muted-foreground", "M1 0h6v1H1zM7 1h1v1H7zM8 2h1v8H8zM1 9h7v1H1zM1 1h1v8H1z"],
      ["fill-current", "M4 1h1v1H4zM5 2h1v1H5zM4 3h1v1H4zM5 4h1v1H5zM4 5h2v2H4z"],
    ],
  },
  lock: { size: 10, paths: [["fill-current", "M3 0h4v1H3zM2 1h1v3H2zM7 1h1v3H7zM1 4h8v6H1z"]] },
  unlock: { size: 10, paths: [["fill-current", "M3 0h4v1H3zM2 1h1v3H2zM7 1h1v1H7zM1 4h8v6H1z"]] },
  cup: { size: 10, paths: [["fill-current", "M1 0h8v1H1zM0 1h2v2H0zM8 1h2v2H8zM2 1h6v4H2zM1 3h1v1H1zM8 3h1v1H8zM3 5h4v1H3zM4 6h2v2H4zM2 8h6v2H2z"]] },
  hidden: {
    size: 10,
    paths: [["fill-current", "M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM7 7h1v1H7zM8 8h1v1H8zM9 9h1v1H9zM2 4h1v2H2zM3 6h4v1H3zM7 3h1v2H7zM3 3h1v1H3zM5 2h2v1H5z"]],
  },
  league: {
    size: 10,
    paths: [["fill-current", "M4 0h2v1H4zM2 1h2v1H2zM6 1h2v1H6zM1 2h1v2H1zM8 2h1v2H8zM0 4h10v2H0zM1 6h1v2H1zM8 6h1v2H8zM2 8h2v1H2zM6 8h2v1H6zM4 9h2v1H4z"]],
  },
  pencil: {
    size: 10,
    paths: [["fill-current", "M7 0h2v1H7zM6 1h1v1H6zM9 1h1v2H9zM5 2h1v1H5zM8 2h1v1H8zM4 3h1v1H4zM7 3h1v1H7zM3 4h1v1H3zM6 4h1v1H6zM2 5h1v1H2zM5 5h1v1H5zM1 6h1v1H1zM4 6h1v1H4zM0 7h1v3H0zM3 7h1v1H3zM1 9h2v1H1zM2 8h1v1H2z"]],
  },
  filter: { size: 10, paths: [["fill-current", "M0 1h10v1H0zM2 4h6v1H2zM4 7h2v1H4z"]] },
  download: { size: 10, paths: [["fill-current", "M4 1h2v4H4zM2 5h6v1H2zM3 6h4v1H3zM4 7h2v1H4zM1 9h8v1H1z"]] },
  cartridge: {
    size: 10,
    paths: [
      ["fill-pixel-case", "M1 1h7l1 1v8H1z"],
      ["fill-red", "M2 3h6v5H2z"],
      ["fill-white", "M3 4h4v1H3z"],
      ["fill-yellow", "M3 6h2v1H3z"],
      ["fill-pixel-notch", "M2 1h1v1H2zM4 1h1v1H4zM6 1h1v1H6z"],
    ],
  },
} as const;

export type PixelIconName = keyof typeof ICONS;

export function PixelIcon({ name, className }: { name: PixelIconName; className?: string }) {
  const icon = ICONS[name];
  return (
    <svg
      viewBox={`0 0 ${icon.size} ${icon.size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("size-4.5 flex-none", className)}
    >
      {icon.paths.map(([fill, d]) => (
        <path key={d} d={d} className={fill} />
      ))}
    </svg>
  );
}
