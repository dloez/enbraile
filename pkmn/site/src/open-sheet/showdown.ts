import { currentAbility, describeItem, describeMove, type Mon } from "@/open-sheet/dex";
import { memberMon, type Member, type Slots } from "@/open-sheet/team";

function nameLine(member: Member, mon: Mon): string {
  const species = mon.species.name;
  const nick = mon.nickname?.trim();
  let line = nick && nick !== species ? `${nick} (${species})` : species;
  if (mon.gender === "M" || mon.gender === "F") line += ` (${mon.gender})`;
  if (member.item) line += ` @ ${describeItem({ item: member.item, quantity: 1 }).name}`;
  return line;
}

export function showdownMember(member: Member, mon: Mon): string {
  const lines = [nameLine(member, mon)];
  const abilityId = member.ability ?? currentAbility(mon);
  if (abilityId) {
    const ability = mon.abilities.find((a) => a.id === abilityId);
    lines.push(`Ability: ${ability?.name ?? abilityId}`);
  }
  lines.push("Level: 50");
  if (mon.shiny) lines.push("Shiny: Yes");
  if (mon.nature) lines.push(`${mon.nature.name} Nature`);
  for (const move of member.moves) if (move) lines.push(`- ${describeMove(move).name}`);
  return lines.join("\n");
}

export function showdownTeam(slots: Slots, mons: readonly Mon[]): string {
  return slots
    .flatMap((member) => {
      const mon = memberMon(member, mons);
      return member && mon && mon.species.known ? [showdownMember(member, mon)] : [];
    })
    .join("\n\n");
}
