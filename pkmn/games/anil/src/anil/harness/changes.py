from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from anil.harness.investigate import Session
from anil.harness.state import Flags, GameState, Pokemon, Stored, read_flags, read_state


@dataclass(frozen=True)
class Changed[T]:
    before: T
    after: T


@dataclass(frozen=True)
class ItemChange:
    id: str
    name: str | None
    before: int
    after: int


@dataclass(frozen=True)
class MemberChange:
    slot: int
    change: Literal["added", "removed", "changed"]
    species: str | None
    fields: dict[str, Changed[Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class StoredChange:
    box: int
    slot: int
    change: Literal["added", "removed", "changed"]
    species: str | None
    fields: dict[str, Changed[Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class FlagChange[K]:
    id: K
    before: Any
    after: Any


@dataclass(frozen=True)
class StateChanges:
    items: list[ItemChange] = field(default_factory=list)
    money: Changed[int] | None = None
    vial: Changed[int | None] | None = None
    party: list[MemberChange] = field(default_factory=list)
    boxes: list[StoredChange] = field(default_factory=list)
    position: Changed[tuple[int, int, int] | None] | None = None
    switches: list[FlagChange[int]] = field(default_factory=list)
    variables: list[FlagChange[int]] = field(default_factory=list)
    self_switches: list[FlagChange[str]] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not any(
            (
                self.items,
                self.money,
                self.vial,
                self.party,
                self.boxes,
                self.position,
                self.switches,
                self.variables,
                self.self_switches,
            )
        )


@dataclass(frozen=True)
class Mark:
    state: GameState
    flags: Flags


def mark(session: Session) -> Mark:
    return Mark(read_state(session, record_unknown=False), read_flags(session))


def item_counts(state: GameState) -> dict[str, tuple[str | None, int]]:
    counts: dict[str, tuple[str | None, int]] = {}
    for pocket in state.bag:
        for named, quantity in pocket.items:
            _, held = counts.get(named.id, (named.name, 0))
            counts[named.id] = (named.name, held + quantity)
    return counts


def member_fields(member: Pokemon) -> dict[str, Any]:
    return {
        "species": member.species.name,
        "nickname": member.nickname,
        "level": member.level,
        "hp": member.hp,
        "status": member.status.name,
        "item": None if member.item is None else member.item.name,
        "moves": [move.move.name for move in member.moves],
        "pp": [move.pp for move in member.moves],
        "exp_share": member.exp_share,
    }


def party_changes(before: list[Pokemon], after: list[Pokemon]) -> list[MemberChange]:
    changes = []
    for slot in range(max(len(before), len(after))):
        old = before[slot] if slot < len(before) else None
        new = after[slot] if slot < len(after) else None
        if old is None and new is not None:
            changes.append(MemberChange(slot, "added", new.species.name))
        elif new is None and old is not None:
            changes.append(MemberChange(slot, "removed", old.species.name))
        elif old is not None and new is not None and (differ := field_changes(old, new)):
            changes.append(MemberChange(slot, "changed", new.species.name, differ))
    return changes


def field_changes(old: Pokemon, new: Pokemon) -> dict[str, Changed[Any]]:
    was, now = member_fields(old), member_fields(new)
    return {key: Changed(was[key], now[key]) for key in was if was[key] != now[key]}


def stored_changes(before: list[Stored], after: list[Stored]) -> list[StoredChange]:
    old = {(stored.box, stored.slot): stored.pokemon for stored in before}
    new = {(stored.box, stored.slot): stored.pokemon for stored in after}
    changes = []
    for box, slot in sorted(old.keys() | new.keys()):
        was, now = old.get((box, slot)), new.get((box, slot))
        if was is None and now is not None:
            changes.append(StoredChange(box, slot, "added", now.species.name))
        elif now is None and was is not None:
            changes.append(StoredChange(box, slot, "removed", was.species.name))
        elif was is not None and now is not None and (differ := field_changes(was, now)):
            changes.append(StoredChange(box, slot, "changed", now.species.name, differ))
    return changes


def place(state: GameState) -> tuple[int, int, int] | None:
    found = state.position
    return None if found is None else (found.map_id, found.x, found.y)


def switch_value(value: Any) -> bool:
    return value is not None and value is not False


def variable_value(value: Any) -> Any:
    return 0 if value is None else value


def array_changes(
    before: list[Any], after: list[Any], normal: Callable[[Any], Any]
) -> list[FlagChange[int]]:
    changes = []
    for index in range(max(len(before), len(after))):
        old = normal(before[index] if index < len(before) else None)
        new = normal(after[index] if index < len(after) else None)
        if old != new:
            changes.append(FlagChange(index, old, new))
    return changes


def state_changes(before: Mark, after: Mark, *, with_boxes: bool = False) -> StateChanges:
    held, holds = item_counts(before.state), item_counts(after.state)
    items = []
    for id in sorted(held.keys() | holds.keys()):
        name, old = held.get(id, (None, 0))
        new_name, new = holds.get(id, (name, 0))
        if old != new:
            items.append(ItemChange(id, new_name or name, old, new))
    old_money = None if before.state.trainer is None else before.state.trainer.money
    new_money = None if after.state.trainer is None else after.state.trainer.money
    money = (
        Changed(old_money, new_money)
        if old_money is not None and new_money is not None and old_money != new_money
        else None
    )
    old_charges = None if before.state.vial is None else before.state.vial.charges
    new_charges = None if after.state.vial is None else after.state.vial.charges
    old_place, new_place = place(before.state), place(after.state)
    self_keys = sorted(before.flags.self_switches.keys() | after.flags.self_switches.keys())
    return StateChanges(
        items=items,
        money=money,
        vial=Changed(old_charges, new_charges) if old_charges != new_charges else None,
        party=party_changes(before.state.party, after.state.party),
        boxes=stored_changes(before.state.boxes, after.state.boxes) if with_boxes else [],
        position=Changed(old_place, new_place) if old_place != new_place else None,
        switches=array_changes(before.flags.switches, after.flags.switches, switch_value),
        variables=array_changes(before.flags.variables, after.flags.variables, variable_value),
        self_switches=[
            FlagChange(key, old, new)
            for key in self_keys
            if (old := before.flags.self_switches.get(key, False))
            != (new := after.flags.self_switches.get(key, False))
        ],
    )


def changes_fields(changes: StateChanges) -> dict[str, Any]:
    return {key: value for key, value in asdict(changes).items() if value}
