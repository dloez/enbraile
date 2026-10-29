import type { AddSource } from "@/teams/components/add-dialog";
import { sourceLabel } from "@/teams/components/snapshot-menu";
import { liveSlots, memberMon } from "@/teams/dex";
import { isFree, ownOf, stockOf, type Member, type Stock } from "@/teams/team";
import { playerColour } from "@/components/player-badge";
import { allowedMoves, currentAbility, type Mon } from "../../shared/mon";
import { defensesOf, describeMove, describeTm } from "../../shared/describe";
import type { MoveRule } from "../../shared/pool";
import type { TeamPage, TeamSource } from "../../shared/team";

export function asSet(mon: Mon, member: Member, rule: MoveRule): Mon {
  const ability = member.ability ?? currentAbility(mon);
  const abilities = mon.abilities.map((a) => ({ ...a, current: a.id === ability }));
  const current = member.moves.flatMap((m) => (m ? [describeMove(m)] : []));
  return {
    ...mon,
    abilities,
    defenses: defensesOf(mon.types, abilities),
    learnable: mon.learnable ? { ...allowedMoves(mon, rule)!, current } : { current, relearner: [], tms: [], levels: null },
  };
}

export interface Held extends Stock, AddSource {
  source: TeamSource;
  owner: string;
  colour: number;
}

export function holding(sources: readonly TeamSource[]): Held[] {
  return sources.map((source) => ({
    id: source.id,
    source,
    label: sourceLabel(source),
    series: source.series.number,
    owner: source.player.name,
    colour: playerColour(source.player.name),
    ...stockOf(source),
    tms: source.snapshot.tms.map(describeTm),
    gaps: source.missing?.missing ?? [],
  }));
}

export function slotSummary(page: TeamPage, slot: number) {
  const stocks = new Map(holding(page.sources).map((held) => [held.id, held]));
  const member = liveSlots(page.slots, stocks)[slot] ?? null;
  const mon = memberMon(member, stocks);
  const own = stocks.get(ownOf(member)?.source ?? "");
  if (!member || !mon || (!own && !isFree(member))) return null;
  return { mon: asSet(mon, member, page.pool.moves), tms: own?.tms ?? [], gaps: own?.gaps ?? [], series: own?.series };
}
