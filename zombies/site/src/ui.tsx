import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Member } from "../shared/runs";
import { t } from "./i18n";
import { navigate } from "./route";

export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return (letters || name).slice(0, 2).toUpperCase();
}

export function Chips({ members }: { members: Member[] }) {
  return (
    <span className="tags">
      {members.map((member, index) => (
        <span key={index} className={member.you ? "cs cs-me" : "cs"} title={member.name}>
          {initials(member.name)}
        </span>
      ))}
    </span>
  );
}

export function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
      <path d="M4 12h15M13 5l7 7-7 7" />
    </svg>
  );
}

export function Back() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      <path d="M20 12H5M11 5l-7 7 7 7" />
    </svg>
  );
}

export function Close() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

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

export function LeaveNote({ name }: { name: string }) {
  return (
    <div className="note">
      <span className="k">{t.note}</span>
      <p>
        {t.leaveBefore}
        <b>{name}</b>
        {t.leaveAfter}
      </p>
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
