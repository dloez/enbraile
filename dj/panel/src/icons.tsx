import type { ReactNode } from "react";

function Stroke({ size = 20, width = 2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const Note = ({ size }: { size?: number }) => <Stroke size={size} width={1.6}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></Stroke>;
export const Search = () => <Stroke size={18}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Stroke>;
export const Close = () => <Stroke size={16}><path d="M18 6 6 18M6 6l12 12" /></Stroke>;
export const Plus = () => <Stroke size={18}><path d="M12 5v14M5 12h14" /></Stroke>;
export const Check = () => <Stroke size={18}><path d="m5 12 5 5 9-10" /></Stroke>;
export const Shuffle = () => <Stroke><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" /></Stroke>;
export const Repeat = () => <Stroke><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></Stroke>;
export const Up = () => <Stroke size={16}><path d="m6 15 6-6 6 6" /></Stroke>;
export const Headphones = () => <Stroke size={14}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" /></Stroke>;
export const Back = () => <Stroke size={18}><path d="M19 12H5M12 19l-7-7 7-7" /></Stroke>;
export const Down =() => <Stroke size={16}><path d="m6 9 6 6 6-6" /></Stroke>;

export const Play = () => (
  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
);
export const Pause = () => (
  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);
export const Skip = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 5 5.5z" /><rect x="17" y="5" width="2.5" height="14" rx="1" /></svg>
);
export const Previous = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5.5v13a1 1 0 0 1-1.5.86l-10-6.5a1 1 0 0 1 0-1.72l10-6.5A1 1 0 0 1 19 5.5z" /><rect x="4.5" y="5" width="2.5" height="14" rx="1" /></svg>
);
export const Grip = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
);
