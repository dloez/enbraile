import logging
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, replace

from anil.bridge.protocol import (
    AdvanceRequest,
    AdvanceResult,
    ControlAction,
    ControlResult,
    SpeedPreset,
    SpeedResult,
    StopCondition,
    TickInput,
)
from anil.harness.investigate import Answer, answer, attach
from anil.harness.investigate import Session as BridgeSession
from anil.settings import Settings

log = logging.getLogger("harness.drive")

DIRECTIONS = ("DOWN", "LEFT", "RIGHT", "UP")
STEP_LIMIT_TICKS = 120
STILL_LIMIT_TICKS = 120
PRESS_LIMIT_TICKS = 600
OWNER_CONTROL = "control"


class DriveError(Exception):
    pass


class OwnerControl(Exception):
    def __init__(self, tick: int) -> None:
        super().__init__(f"the owner took control at tick {tick}")
        self.tick = tick


def buttons(*names: str) -> TickInput:
    return TickInput(buttons=list(names))


def keys(*names: str | int) -> TickInput:
    return TickInput(keys=list(names))


@dataclass
class Driver:
    session: BridgeSession
    stop_on_control: bool = False

    def advance(
        self,
        ticks: int,
        inputs: Sequence[TickInput] = (),
        *,
        repeat: bool = False,
        until: Sequence[StopCondition] = (),
    ) -> Answer[AdvanceResult]:
        request = AdvanceRequest(ticks=ticks, inputs=list(inputs), repeat=repeat, until=list(until))
        reply = self.session.call("advance", **request.model_dump())
        step = answer(reply, AdvanceResult.model_validate(reply.result))
        return replace(step, events=self.session.take_events())

    def advance_driven(
        self,
        ticks: int,
        inputs: Sequence[TickInput],
        *,
        repeat: bool = False,
        until: Sequence[StopCondition] = (),
    ) -> Answer[AdvanceResult]:
        events = []
        while True:
            step = self.advance(ticks, inputs, repeat=repeat, until=until)
            events.extend(step.events)
            if step.value.stopped != OWNER_CONTROL:
                return replace(step, events=events)
            if self.stop_on_control:
                log.info("the owner took control at tick %d; stopping", step.tick)
                raise OwnerControl(step.tick)
            log.info("the owner took control at tick %d; waiting for release", step.tick)

    def hold_until_moved(
        self, direction: str, limit: int = STEP_LIMIT_TICKS
    ) -> Answer[AdvanceResult]:
        if direction not in DIRECTIONS:
            raise DriveError(f"direction must be one of {', '.join(DIRECTIONS)}, not {direction}")
        step = self.advance_driven(limit, [buttons(direction)], repeat=True, until=["position"])
        if step.value.stopped != "position":
            raise DriveError(
                f"holding {direction} did not move the player within {limit} ticks "
                f"(tick {step.tick}, stopped on {step.value.stopped})"
            )
        return step

    def wait_until_still(self, limit: int = STILL_LIMIT_TICKS) -> Answer[AdvanceResult]:
        step = self.advance_driven(limit, [], until=["moving"])
        if step.value.moving:
            raise DriveError(f"the player was still moving after {limit} ticks (tick {step.tick})")
        return step

    def walk(self, direction: str, tiles: int) -> Answer[AdvanceResult]:
        if tiles < 1:
            raise DriveError(f"walk needs at least one tile, not {tiles}")
        events = []
        for _ in range(tiles - 1):
            events.extend(self.hold_until_moved(direction).events)
        step = self.hold_until_moved(direction)
        events.extend(step.events)
        if step.value.moving:
            step = self.wait_until_still()
            events.extend(step.events)
        return replace(step, events=events)

    def press_until_changed(
        self,
        press: TickInput,
        until: Sequence[StopCondition] = ("signature",),
        limit: int = PRESS_LIMIT_TICKS,
    ) -> Answer[AdvanceResult]:
        step = self.advance_driven(limit, [press, TickInput()], repeat=True, until=until)
        if step.value.stopped == "ticks":
            raise DriveError(
                f"pressing {press.model_dump(exclude_defaults=True)} changed none of "
                f"{', '.join(until)} within {limit} ticks (tick {step.tick})"
            )
        return step

    def type_text(self, text: str) -> Answer[AdvanceResult]:
        return self.advance_driven(1, [TickInput(text=text)])


@contextmanager
def drive(settings: Settings, name: str) -> Generator[Driver]:
    with attach(settings, name, "driver") as session:
        session.client.wait_without_timeout()
        session.follow_events()
        yield Driver(session)


def control(settings: Settings, action: ControlAction) -> Answer[ControlResult]:
    with attach(settings, "anil control", "control") as session:
        reply = session.call("control", action=action)
        return answer(reply, ControlResult.model_validate(reply.result))


def set_speed(settings: Settings, preset: SpeedPreset) -> Answer[SpeedResult]:
    with attach(settings, "anil speed", "control") as session:
        reply = session.call("speed", preset=preset)
        return answer(reply, SpeedResult.model_validate(reply.result))
