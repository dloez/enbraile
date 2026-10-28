import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setLang } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { lang, LANGS, messages, type Lang } from "../../shared/i18n";

const NAMES: Record<Lang, string> = { en: "English", es: "Español" };

const FLAGS: Record<Lang, string> = { en: "/flags/gb.svg", es: "/flags/es.svg" };

const t = messages({
  en: { language: "Language" },
  es: { language: "Idioma" },
});

function Flag({ of, className }: { of: Lang; className?: string }) {
  return <img src={FLAGS[of]} alt="" width={28} height={20} className={cn("h-5 w-7 flex-none rounded-[3px] ring-2 ring-ink", className)} />;
}

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function LanguageSwitch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${t.language}: ${NAMES[lang]}`}
        title={t.language}
        className={cn(`grid size-11 flex-none cursor-pointer place-items-center rounded-md hover:bg-card data-[state=open]:bg-card ${focus}`, className)}
      >
        <Flag of={lang} />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-48 gap-1">
        {LANGS.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            aria-current={option === lang}
            onClick={() => (option === lang ? setOpen(false) : setLang(option))}
            className={cn(
              `flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left font-heading text-2xl hover:bg-cell ${focus}`,
              option === lang ? "text-primary" : "text-white",
            )}
          >
            <Flag of={option} />
            {NAMES[option]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
