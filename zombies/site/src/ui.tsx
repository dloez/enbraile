import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Language, PublishedMap } from "../shared/bundle";
import type { Member } from "../shared/runs";
import { MapPlan } from "./art";
import { t } from "./i18n";
import { navigate } from "./route";

export type RunLink = { id: string; name: Record<Language, string> };

export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return (letters || name).slice(0, 2).toUpperCase();
}

export function Chip({ name, you }: { name: string; you?: boolean }) {
  return (
    <span className={you ? "cs cs-me" : "cs"} title={name}>
      {initials(name)}
    </span>
  );
}

export function Chips({ members }: { members: Member[] }) {
  return (
    <span className="chips">
      {members.map((member, index) => (
        <Chip key={index} name={member.name} you={member.you} />
      ))}
    </span>
  );
}

function Icon({ size, width = 2.2, children }: { size: number; width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Arrow = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const Back = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const Chevron = ({ size = 24 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const Down = () => (
  <Icon size={18} width={2.4}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

export const LinkIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export function Link({ to, className, children, label }: { to: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <a
      href={to}
      className={className}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function LeaveNote({ before, name, after }: { before: string; name: string; after: string }) {
  return (
    <p className="note">
      {before}
      <b>{name}</b>
      {after}
    </p>
  );
}

export function Notice({ text, alert, children }: { text: string; alert?: boolean; children?: ReactNode }) {
  return (
    <div className="notice">
      <p className="state" role={alert ? "alert" : "status"}>
        {text}
      </p>
      {children}
    </div>
  );
}

export function useFit<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = -1;
    const fit = () => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      element.style.fontSize = "";
      if (element.scrollWidth <= width) return;
      const size = parseFloat(getComputedStyle(element).fontSize);
      element.style.fontSize = `${Math.floor((size * width) / element.scrollWidth)}px`;
    };
    fit();
    void document.fonts.ready.then(() => {
      width = -1;
      fit();
    });
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return ref;
}

export function MapHead({ back, eyebrow, name, art, plan }: { back: boolean; eyebrow: string; name: string; art: PublishedMap["art"]; plan: string }) {
  const title = useFit<HTMLHeadingElement>(name);
  return (
    <div className="mv-head">
      {back && (
        <Link to="/" className="back">
          <Back />
          {t.maps}
        </Link>
      )}
      <div className="mv-title">
        <div className="mv-name">
          <span className="lab">{eyebrow}</span>
          <h1 ref={title} className="cond">
            {name}
          </h1>
        </div>
        <span className="pl mv-small">
          <MapPlan art={art} label={plan} />
        </span>
      </div>
      <div className="plan mv-large">
        <MapPlan art={art} label={plan} />
      </div>
    </div>
  );
}
