import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ItemIcon } from "@/components/pc/bag";
import { MonSprite } from "@/components/pc/mon-sprite";
import { UnknownMark } from "@/components/marks";
import { cn } from "@/lib/utils";
import { currentAbility, displayName, STAT_LABELS, type Ability, type Mon } from "../../../shared/mon";
import { describeAbility, describeItem } from "../../../shared/describe";
import { fightItems } from "../../../shared/items";
import { ANY_ABILITIES, ANY_ITEMS, memberMon, NATURES, speciesAbilities } from "@/teams/dex";
import { formatMoney, heldCount, mintsLeft, moneyLeft, naturePrice, ownMon, ownOf, setasLeft, type Member, type Slots, type Stocks } from "@/teams/team";
import type { Sheet } from "@/teams/schema";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    item: "item",
    ability: "ability",
    nature: "nature",
    anyItem: "Any item",
    bag: (owner: string) => `${owner}'s bag`,
    pockets: "Pockets",
    items: "Items",
    berries: "Berries",
    searchBag: "Search the bag",
    search: "Search",
    heldBy: (name: string) => `Held by ${name}`,
    nothingMatches: "Nothing matches",
    empty: "Empty",
    selected: "Selected item",
    anyItemFree: "Any item: free member",
    leftOf: (left: number, of: number) => `${left} left of ${of}`,
    holdsIt: (name: string) => `${name} holds it`,
    noneLeft: "None left",
    giveTo: (name: string) => `Give to ${name}`,
    takeItem: "Take its item",
    setasLeft: (n: number) => `${setasLabel(n)} left`,
    noAbilities: "No abilities in this export",
    searchAbilities: "Search abilities",
    canHave: "Can have",
    otherAbilities: "Other abilities",
    hidden: "Hidden",
    inGame: "In game",
    free: "Free",
    neutral: "Neutral",
    moneyForMints: "Money left for mints",
    noMoney: "No money in this snapshot",
    moneyLeft: (money: string) => `${money} left`,
    mintInBag: (n: number) => `Mint in bag ×${n}`,
    mintFor: (money: string) => `Mint ${money}`,
    mintRule: "A new nature takes a mint of it: one from the bag first, else one bought at the game's mart. The in-game nature costs nothing.",
  },
  es: {
    item: "objeto",
    ability: "habilidad",
    nature: "naturaleza",
    anyItem: "Cualquier objeto",
    bag: (owner: string) => `Mochila de ${owner}`,
    pockets: "Bolsillos",
    items: "Objetos",
    berries: "Bayas",
    searchBag: "Buscar en la mochila",
    search: "Buscar",
    heldBy: (name: string) => `Lo lleva ${name}`,
    nothingMatches: "No hay coincidencias",
    empty: "Vacío",
    selected: "Objeto elegido",
    anyItemFree: "Cualquier objeto: miembro libre",
    leftOf: (left: number, of: number) => `${left === 1 ? "Queda" : "Quedan"} ${left} de ${of}`,
    holdsIt: (name: string) => `${name} ya lo lleva`,
    noneLeft: "No quedan",
    giveTo: (name: string) => `Dárselo a ${name}`,
    takeItem: "Quitarle el objeto",
    setasLeft: (n: number) => `${n === 1 ? "Queda" : "Quedan"} ${setasLabel(n)}`,
    noAbilities: "No hay habilidades en esta exportación",
    searchAbilities: "Buscar habilidades",
    canHave: "Puede tener",
    otherAbilities: "Otras habilidades",
    hidden: "Oculta",
    inGame: "En el juego",
    free: "Gratis",
    neutral: "Neutra",
    moneyForMints: "Dinero que queda para mentas",
    noMoney: "No hay dinero en esta captura",
    moneyLeft: (money: string) => `Quedan ${money}`,
    mintInBag: (n: number) => `Menta en mochila ×${n}`,
    mintFor: (money: string) => `Menta ${money}`,
    mintRule: "Una naturaleza nueva pide su menta: primero una de la mochila y, si no hay, una comprada en la tienda del juego. La naturaleza del juego no cuesta nada.",
  },
});

export const editorScroll = "-mr-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin]";

export const segTrack = "flex flex-none gap-1 rounded-xl border-3 bg-ink p-1";

export const segButton = (on: boolean) =>
  cn(
    "min-h-8.5 cursor-pointer rounded-lg border-none px-3 font-heading text-[1.3125rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
  );

export const pickRow = (on: boolean) =>
  cn(
    "cursor-pointer rounded-[10px] border-3 text-left text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
    on ? "border-primary bg-cell" : "border-transparent bg-transparent enabled:hover:bg-cell",
  );

export function EditorHead({ who, what, back, onBack, aside }: { who: string; what: string; back: string; onBack: () => void; aside?: ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-2.5">
      <button
        type="button"
        aria-label={back}
        onClick={onBack}
        className="grid size-10 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h2 className="m-0 min-w-0 flex-1 truncate font-heading text-[1.625rem] leading-[1.05] font-normal">
        <span className="text-muted-foreground">{who} ·</span> {what}
      </h2>
      {aside}
    </div>
  );
}

type PocketId = "items" | "berries";

export function ItemEditor({ sheet, slots, stocks, slot, owner, back, onBack, onGive, onTake }: {
  sheet: Sheet;
  slots: Slots;
  stocks: Stocks;
  slot: number;
  owner: string;
  back: string;
  onBack: () => void;
  onGive: (item: string) => void;
  onTake: () => void;
}) {
  const member = slots[slot] as Member;
  const mon = memberMon(member, stocks) as Mon;
  const name = displayName(mon);
  const own = ownOf(member);
  const free = own === null;
  const items = useMemo(() => (free ? ANY_ITEMS : fightItems(sheet.items).map(describeItem).filter((i) => i.known)), [sheet, free]);
  const holding = member.item ? items.find((i) => i.id === member.item) : undefined;
  const [pocket, setPocket] = useState<PocketId>(holding?.pocket ?? "items");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(member.item);
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => i.pocket === pocket && (!q || i.name.toLowerCase().includes(q)));
  const selected = shown.find((i) => i.id === picked) ?? shown[0];
  const leftOf = (id: string, quantity: number) => (own ? quantity - heldCount(slots, own.source, id) : Infinity);
  const left = selected ? leftOf(selected.id, selected.quantity) : 0;
  const holds = selected !== undefined && member.item === selected.id;
  const blocked = !selected || holds || left <= 0;

  return (
    <>
      <EditorHead who={name} what={t.item} back={back} onBack={onBack} aside={<span className="flex-none font-heading text-[1.1875rem] text-muted-foreground">{free ? t.anyItem : t.bag(owner)}</span>} />
      <div className="flex flex-none gap-2">
        <div role="tablist" aria-label={t.pockets} className={segTrack}>
          {(
            [
              ["items", t.items],
              ["berries", t.berries],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={pocket === id} onClick={() => setPocket(id)} className={segButton(pocket === id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border-3 bg-ink px-2.5 focus-within:border-primary">
          <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t.searchBag}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none" />
        </label>
      </div>
      <div className={cn(editorScroll, "gap-0.75")}>
        {shown.map((item) => {
          const remaining = leftOf(item.id, item.quantity);
          const holders = slots.flatMap((m, at) => {
            const holder = own && ownOf(m)?.source === own.source && m?.item === item.id ? memberMon(m, stocks) : undefined;
            return holder ? [{ at, mon: holder }] : [];
          });
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === selected?.id}
              onClick={() => setPicked(item.id)}
              className={cn(pickRow(item.id === selected?.id), "flex min-h-12 flex-none items-center gap-2 pr-2.5 pl-0.5", remaining <= 0 && member.item !== item.id && "opacity-50")}
            >
              <ItemIcon item={item} scale={2} />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{item.name}</span>
              <span className="flex flex-none">
                {holders.map((h) => (
                  <span key={h.at} title={t.heldBy(displayName(h.mon))} className="flex size-7 items-center justify-center overflow-hidden">
                    <MonSprite mon={h.mon} className="-m-1.5 size-10 flex-none" />
                    <span className="sr-only">{t.heldBy(displayName(h.mon))}</span>
                  </span>
                ))}
              </span>
              {!free && <span className={cn("min-w-8.5 flex-none text-right font-heading text-[1.375rem]", remaining <= 0 ? "text-faint" : "text-subtle")}>×{remaining}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <p className="my-6 text-center font-heading text-2xl text-muted-foreground">{q ? t.nothingMatches : t.empty}</p>}
      </div>
      {selected && (
        <section aria-label={t.selected} aria-live="polite" className="flex flex-none flex-col gap-2 rounded-xl border-3 border-cell bg-box px-3 pt-2.5 pb-3">
          <div className="flex items-center gap-2.5">
            <ItemIcon item={selected} scale={2} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-heading text-[1.75rem] leading-none">{selected.name}</span>
              <span className="font-heading text-[1.1875rem] text-muted-foreground">
                {free ? t.anyItemFree : t.leftOf(left, selected.quantity)}
              </span>
            </span>
          </div>
          <p className="m-0 min-h-10 text-sm leading-[1.4] text-prose">{selected.desc || "—"}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={blocked}
              onClick={() => onGive(selected.id)}
              className={buttonVariants({ variant: "go", className: "min-h-12 flex-1 rounded-[10px] text-2xl" })}
            >
              {holds ? t.holdsIt(name) : left <= 0 ? t.noneLeft : t.giveTo(name)}
            </button>
            <button
              type="button"
              disabled={!member.item}
              onClick={onTake}
              className={buttonVariants({ className: cn("min-h-12 flex-none rounded-[10px] text-[1.375rem]", member.item ? "text-stat-up" : "text-faint") })}
            >
              {t.takeItem}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export function setasLabel(count: number): string {
  return `${count} Mini Seta${count === 1 ? "" : "s"}`;
}

function AbilityCard({ ability, on, off, tag, onPick }: { ability: Ability; on: boolean; off: boolean; tag: ReactNode; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={off}
      onClick={onPick}
      className={cn(
        "flex flex-none cursor-pointer flex-col gap-1.5 rounded-xl border-3 px-3.5 py-3 text-left text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-45",
        on ? "border-primary bg-cell" : "border-cell bg-box enabled:hover:border-cell-hi",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 text-[1.0625rem] font-extrabold">
          {ability.name}
          {ability.marked && <UnknownMark />}
        </span>
        {ability.hidden && <span className="rounded-sm border-2 border-cell-hi px-1.5 font-heading text-[1.0625rem] text-subtle">{t.hidden}</span>}
        {tag}
      </span>
      <span className="text-sm leading-[1.45] text-prose">{ability.desc || "—"}</span>
    </button>
  );
}

function FreeAbilities({ mon, using, back, onBack, onPick }: { mon: Mon; using: string | null; back: string; onBack: () => void; onPick: (ability: string) => void }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const own = speciesAbilities(mon.species.id);
    const its = [...own.base.map((id) => describeAbility(id)), ...own.hidden.map((id) => describeAbility(id, true))];
    const ids = new Set(its.map((a) => a.id));
    return [
      { name: t.canHave, abilities: its },
      { name: t.otherAbilities, abilities: ANY_ABILITIES.filter((a) => !ids.has(a.id)) },
    ];
  }, [mon.species.id]);
  const q = query.trim().toLowerCase();
  return (
    <>
      <EditorHead who={displayName(mon)} what={t.ability} back={back} onBack={onBack} />
      <label className="flex min-h-11 flex-none items-center gap-2 rounded-[10px] border-3 bg-ink px-2.5 focus-within:border-primary">
        <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t.searchAbilities}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none" />
      </label>
      <div className={cn(editorScroll, "gap-2")}>
        {groups.map((group) => {
          const shown = group.abilities.filter((a) => !q || a.name.toLowerCase().includes(q));
          if (shown.length === 0) return null;
          return (
            <section key={group.name} aria-label={group.name} className="flex flex-col gap-2">
              <h3 className="m-0 px-1 pt-1 font-heading text-[1.125rem] leading-none font-normal text-muted-foreground">{group.name}</h3>
              {shown.map((a) => (
                <AbilityCard key={a.id} ability={a} on={a.id === using} off={false} tag={null} onPick={() => onPick(a.id)} />
              ))}
            </section>
          );
        })}
        {groups.every((group) => !group.abilities.some((a) => !q || a.name.toLowerCase().includes(q))) && (
          <p className="my-6 text-center font-heading text-2xl text-muted-foreground">{t.nothingMatches}</p>
        )}
      </div>
    </>
  );
}

export function AbilityEditor({ slots, stocks, slot, back, onBack, onPick }: {
  slots: Slots;
  stocks: Stocks;
  slot: number;
  back: string;
  onBack: () => void;
  onPick: (ability: string) => void;
}) {
  const member = slots[slot] as Member;
  const mon = memberMon(member, stocks) as Mon;
  const own = ownOf(member);
  const using = member.ability ?? currentAbility(mon);
  if (!own) return <FreeAbilities mon={mon} using={using} back={back} onBack={onBack} onPick={onPick} />;
  const cost = stocks.get(own.source)?.costs.abilitySetas ?? 0;
  const left = setasLeft(slots, stocks, own.source, slot);
  return (
    <>
      <EditorHead
        who={displayName(mon)}
        what={t.ability}
        back={back}
        onBack={onBack}
        aside={<span className="flex-none font-heading text-[1.1875rem] text-muted-foreground">{t.setasLeft(left)}</span>}
      />
      <div className={cn(editorScroll, "gap-2")}>
        {mon.abilities.length === 0 && <p className="my-6 text-center font-heading text-2xl text-muted-foreground">{t.noAbilities}</p>}
        {mon.abilities.map((a) => {
          const on = a.id === using;
          return (
            <AbilityCard
              key={a.id}
              ability={a}
              on={on}
              off={!a.current && !on && left < cost}
              onPick={() => onPick(a.id)}
              tag={
                a.current ? (
                  <span className="rounded-sm bg-cyan px-1.75 font-heading text-[1.0625rem] text-ink">{t.inGame}</span>
                ) : (
                  <span className="rounded-sm bg-warning px-1.5 font-heading text-[1.0625rem] text-ink">{cost === 0 ? t.free : setasLabel(cost)}</span>
                )
              }
            />
          );
        })}
      </div>
    </>
  );
}

function natureEffect(plus: string | null, minus: string | null): string {
  if (!plus || !minus) return t.neutral;
  return `+${STAT_LABELS[plus as keyof typeof STAT_LABELS]} −${STAT_LABELS[minus as keyof typeof STAT_LABELS]}`;
}

export function NatureEditor({ slots, stocks, slot, back, onBack, onPick }: {
  slots: Slots;
  stocks: Stocks;
  slot: number;
  back: string;
  onBack: () => void;
  onPick: (nature: string, current: string | null) => void;
}) {
  const member = slots[slot] as Member;
  const mon = memberMon(member, stocks) as Mon;
  const own = ownOf(member);
  const inGame = own ? (ownMon(own, stocks)?.nature?.id ?? null) : null;
  const using = mon.nature?.id ?? null;
  const money = own ? moneyLeft(slots, stocks, own.source, slot) : null;
  return (
    <>
      <EditorHead
        who={displayName(mon)}
        what={t.nature}
        back={back}
        onBack={onBack}
        aside={
          own && (
            <span className="flex-none font-heading text-[1.1875rem] text-muted-foreground" title={t.moneyForMints}>
              {money === null ? t.noMoney : t.moneyLeft(formatMoney(money))}
            </span>
          )
        }
      />
      <div className={cn(editorScroll, "gap-0.75")}>
        {NATURES.map((n) => {
          const on = n.id === using;
          const price = own && n.id !== inGame ? naturePrice(slots, stocks, own.source, slot, n.id) : null;
          const off = !on && price !== null && price.by === "money" && !price.affordable;
          const mints = own && price?.by === "mint" ? mintsLeft(slots, stocks, own.source, n.id, slot) : 0;
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={on}
              disabled={off}
              onClick={() => onPick(n.id, inGame)}
              className={cn(pickRow(on), "flex min-h-11 flex-none items-center gap-2.5 px-2.5 disabled:opacity-45")}
            >
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-extrabold">{n.name}</span>
              <span className="flex-none font-heading text-[1.1875rem] text-subtle">{natureEffect(n.plus, n.minus)}</span>
              {own &&
                (n.id === inGame ? (
                  <span className="flex-none rounded-sm bg-cyan px-1.75 font-heading text-[1.0625rem] text-ink">{t.inGame}</span>
                ) : price?.by === "mint" ? (
                  <span className="flex-none rounded-sm bg-warning px-1.5 font-heading text-[1.0625rem] text-ink">{t.mintInBag(mints)}</span>
                ) : (
                  <span className="flex-none rounded-sm bg-warning px-1.5 font-heading text-[1.0625rem] text-ink">{price && price.price === 0 ? t.free : t.mintFor(formatMoney(price?.price ?? 0))}</span>
                ))}
            </button>
          );
        })}
      </div>
      {own && (
        <p className="m-0 flex-none text-sm leading-[1.4] text-prose">
          {t.mintRule}
        </p>
      )}
    </>
  );
}
