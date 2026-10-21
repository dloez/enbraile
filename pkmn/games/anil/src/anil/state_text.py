from typing import Any

from anil.bridge.protocol import Event
from anil.harness.context import Context
from anil.harness.state import Battle, Battler, GameState, Move, Named, Pokemon, Stats

GENDERS = {0: "♂", 1: "♀"}


def label(value: Named | None) -> str:
    if value is None:
        return "-"
    return f"{value.name or '?'} ({value.id})"


def stat_line(stats: Stats) -> str:
    return (
        f"{stats.hp}/{stats.attack}/{stats.defense}/{stats.speed}/"
        f"{stats.special_attack}/{stats.special_defense}"
    )


def move_line(move: Move) -> str:
    ups = f" +{move.pp_ups}" if move.pp_ups else ""
    return f"{label(move.move)} {move.pp}/{move.total_pp}{ups}"


def pokemon_lines(pokemon: Pokemon, indent: str) -> list[str]:
    flags = [flag for flag, on in (("shiny", pokemon.shiny), ("egg", pokemon.egg)) if on]
    types = "/".join(label(kind) for kind in pokemon.types)
    return [
        (
            f"{indent}{pokemon.nickname}: {label(pokemon.species)} form {pokemon.form} "
            f"Lv{pokemon.level} {GENDERS.get(pokemon.gender, '-')} {' '.join(flags)}"
        ).rstrip(),
        (
            f"{indent}  HP {pokemon.hp}/{pokemon.stats.hp}  status {label(pokemon.status)}  "
            f"exp {pokemon.exp}  happiness {pokemon.happiness}  "
            f"exp share {'on' if pokemon.exp_share else 'off'}"
        ),
        (
            f"{indent}  types {types}  nature {label(pokemon.nature)}  "
            f"ability {label(pokemon.ability)}  item {label(pokemon.item)}"
        ),
        (
            f"{indent}  stats {stat_line(pokemon.stats)}  IVs {stat_line(pokemon.ivs)}  "
            f"EVs {stat_line(pokemon.evs)}  (HP/Atk/Def/Spe/SpA/SpD)"
        ),
        f"{indent}  moves {', '.join(move_line(move) for move in pokemon.moves)}",
    ]


def battler_lines(battler: Battler) -> list[str]:
    types = "/".join(label(kind) for kind in battler.types)
    stages = " ".join(f"{stat} {stage}" for stat, stage in battler.stages.items())
    fainted = " fainted" if battler.fainted else ""
    return [
        (
            f"  [{battler.index}] {battler.side}: {battler.nickname} {label(battler.species)} "
            f"Lv{battler.level} HP {battler.hp}/{battler.total_hp} "
            f"status {label(battler.status)}{fainted}"
        ),
        f"      types {types}  ability {label(battler.ability)}  item {label(battler.item)}",
        f"      stats {stat_line(battler.stats)}  stages {stages}",
        f"      moves {', '.join(move_line(move) for move in battler.moves)}",
    ]


def battle_lines(battle: Battle) -> list[str]:
    kind = "wild" if battle.wild else f"trainer {', '.join(battle.opponent)}"
    lines = [
        (
            f"battle: {kind}, {'v'.join(str(size) for size in battle.side_sizes)}, "
            f"turn {battle.turn}, decision {battle.decision}, "
            f"weather {battle.weather} ({battle.weather_duration}), "
            f"terrain {battle.terrain} ({battle.terrain_duration})"
        )
    ]
    for battler in battle.battlers:
        lines += battler_lines(battler)
    return lines


def payload_line(payload: dict[str, Any]) -> str:
    fields = "  ".join(
        f"{name} {value!r}" for name, value in payload.items() if name not in ("kind", "tick")
    )
    return f"  {payload.get('kind', '?')} (since tick {payload.get('tick', '?')}): {fields}"


def context_lines(context: Context) -> list[str]:
    screen = f" ({context.screen})" if context.screen else ""
    lines = [f"context: {context.name}{screen}  at {context.frame or '-'}"]
    lines += [payload_line(payload) for payload in context.payloads]
    return lines


def event_line(event: Event) -> str:
    fields = "  ".join(f"{name} {value!r}" for name, value in event.data.items())
    return f"  #{event.seq} tick {event.tick} {event.kind}: {fields}"


def maps_text(maps: frozenset[int]) -> str:
    return " ".join(str(map_id) for map_id in sorted(maps)) or "none"


def state_lines(state: GameState) -> list[str]:
    lines = [f"tick {state.tick}"]
    lines += context_lines(state.context)
    trainer = state.trainer
    if trainer is None:
        lines.append("trainer: none")
    else:
        badges = sum(trainer.badges)
        lines.append(
            f"trainer: {trainer.name}  ID {trainer.public_id:05d} ({trainer.id})  "
            f"money {trainer.money}  badges {badges}/{len(trainer.badges)}  "
            f"save slot {trainer.save_slot or '-'}"
        )
    position = state.position
    if position is not None:
        moving = " moving" if position.moving else ""
        lines.append(
            f"map: {position.map_name} ({position.map_id})  at {position.x},{position.y}  "
            f"facing {position.facing}{moving}"
        )
    lines.append(f"first encounters used: {maps_text(state.challenge_encs)}")
    lines.append(f"visited maps: {maps_text(state.visited)}")
    if state.transfer is not None:
        transfer = state.transfer
        lines.append(
            f"transfer pending: map {transfer.map_id} at {transfer.x},{transfer.y} "
            f"facing {transfer.facing or '-'}"
        )
    lines.append(f"party ({len(state.party)}):")
    for pokemon in state.party:
        lines += pokemon_lines(pokemon, "  ")
    lines.append("bag:")
    for pocket in state.bag:
        if pocket.items:
            items = ", ".join(f"{label(entry)} x{count}" for entry, count in pocket.items)
            lines.append(f"  {pocket.name} ({pocket.index}): {items}")
    if state.vial is not None:
        vial = state.vial
        locked = "  locked" if vial.locked else ""
        lines.append(f"vial: {vial.charges}/{vial.max_charges} charges{locked}")
    lines.append(f"boxes ({len(state.boxes)} stored):")
    for stored in state.boxes:
        lines.append(f"  box {stored.box} {stored.box_name!r} slot {stored.slot}:")
        lines += pokemon_lines(stored.pokemon, "    ")
    if state.battle is not None:
        lines += battle_lines(state.battle)
    if state.command is not None:
        command = state.command
        lines.append(
            f"event {command.event_id} command {command.index}: code {command.code} "
            f"indent {command.indent} parameters {command.parameters}"
        )
    for id, value in state.switches.items():
        lines.append(f"switch {id}: {value}")
    for id, value in state.variables.items():
        lines.append(f"variable {id}: {value}")
    if state.self_switches:
        on = [key for key, value in state.self_switches.items() if value]
        lines.append(f"self switches on ({len(on)}): {', '.join(sorted(on))}")
    if state.events:
        lines.append(f"events ({len(state.events)}):")
        lines += [event_line(event) for event in state.events]
    return lines
