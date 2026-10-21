import logging
import re
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from anil.bridge.protocol import (
    AdvanceResult,
    Event,
    NoteResult,
    ReadRequest,
    StopCondition,
    TickInput,
)
from anil.harness.context import EVENT, OVERWORLD, UNKNOWN, Context, classify, log_unknown
from anil.harness.drive import Driver, buttons
from anil.harness.investigate import Answer, Session
from anil.harness.state import INTERPRETER_RUNNING, StateError

log = logging.getLogger("harness.steps")

type Outcome = Literal["finished", "no_effect", "decision", "handoff", "stuck", "refused", "failed"]

MESSAGE = "message"
CHOICE = "choice"
NUMBER = "number"
TRANSITION = "transition"
WAITING = frozenset({EVENT, TRANSITION})
BATTLE = ("battle", "AnilBridge.battle.object_id")
CONFIRM = "C"
CANCEL = "B"
WAIT_TICKS = 300
STUCK_STEPS = 3
MESSAGE_TICKS = 600
CONFIRM_TICKS = 120
PRESS_TICKS = 2
WINDOW_TICKS = 20
CURSOR_PRESSES = 3
NUMBER_PRESSES = 120
DIGIT_BASE = 10


@dataclass(frozen=True)
class Look:
    tick: int
    context: Context
    battle: bool
    frames: list[str]

    def payload(self, kind: str) -> dict[str, Any] | None:
        for payload in reversed(self.context.payloads):
            if payload.get("kind") == kind:
                return payload
        return None

    @property
    def newest(self) -> dict[str, Any] | None:
        return self.context.payloads[-1] if self.context.payloads else None

    @property
    def idle(self) -> bool:
        return self.context.name == OVERWORLD and not self.context.payloads

    @property
    def place(self) -> tuple[str, str | None, tuple[tuple[Any, Any], ...]]:
        return (self.context.name, self.context.screen, payload_keys(self.context.payloads))


@dataclass(frozen=True)
class MessageLine:
    tick: int
    raw: str
    text: str
    kind: Literal["message"] = "message"


@dataclass(frozen=True)
class AnswerLine:
    tick: int
    prompt: str | None
    options: list[str] | None
    answer: str
    minimum: int | None = None
    maximum: int | None = None
    kind: Literal["answer"] = "answer"


type Line = MessageLine | AnswerLine


@dataclass(frozen=True)
class Decision:
    kind: Literal["choice", "number"]
    prompt: str | None
    options: list[str] | None = None
    cursor: int | None = None
    minimum: int | None = None
    maximum: int | None = None
    value: int | None = None
    digit: int | None = None


@dataclass(frozen=True)
class Ended:
    outcome: Outcome
    reason: str
    decision: Decision | None = None


def payload_keys(payloads: list[dict[str, Any]]) -> tuple[tuple[Any, Any], ...]:
    return tuple((payload.get("kind"), payload.get("tick")) for payload in payloads)


ESCAPED_BACKSLASH = "\x05"
ACTOR = re.compile(r"\\[Nn]\[([1-8])\]")
PLAYER_NAME = re.compile(r"\\[Pp][Nn]")
MONEY = re.compile(r"\\[Pp][Mm]")
LINE_BREAK = re.compile(r"\\[Nn]")
HEX_COLOUR = re.compile(r"\\\[[0-9A-Fa-f]{8}\]")
GENDER_COLOUR = re.compile(r"\\[Pp][Oo]?[Gg]")
GENDER_ENDING_A = re.compile(r"\\@a", re.IGNORECASE)
GENDER_ENDING = re.compile(r"\\@")
WINDOWSKIN = re.compile(r"\\[Ww]\[[^\]]*\]")
NAMED_COLOUR = re.compile(r"\\[BbRr]")
CONTROL_ONE = re.compile(r"\\1")
INDEXED_COLOUR = re.compile(r"\\[Cc]\[[0-9]+\]")
VARIABLE = re.compile(r"\\[Vv]\[([0-9]+)\]")
LINE_COUNT = re.compile(r"\\[Ll]\[[0-9]+\]")
SIGN = re.compile(r"\\sign\[([^\]]*)\]", re.IGNORECASE)
CONTROLS = re.compile(
    r"\\(?:f|ff|ts|cl|me|se|wt|wtnp|ch)\[[^\]]*\]|\\(?:g|cn|pt|wd|wm|op|cl|wu|sh|\.|\||!|\^)",
    re.IGNORECASE,
)
MARKUP_BREAK = re.compile(r"<br>", re.IGNORECASE)
MARKUP = re.compile(
    r"</?(?:b|i|u|s|o|r|c|ac|ar|al|outln2?|c2|c3|fs|fn|pg|pog|icon|img)(?:\s*=\s*[^>]*)?>",
    re.IGNORECASE,
)
CONTROL_CHAR = "\x01"


@dataclass
class Filler:
    session: Session
    values: dict[str, Any] = field(default_factory=dict)

    def value(self, path: str) -> Any:
        if path not in self.values:
            result = self.session.read(ReadRequest(paths=[(path, path)], depth=1)).value
            self.values[path] = result.values.get(path)
        return self.values[path]

    def text(self, raw: str) -> str:
        text = SIGN.sub(lambda m: f"\\op\\cl\\ts[]\\w[{m[1]}]", raw)
        text = text.replace("\\\\", ESCAPED_BACKSLASH)
        text = ACTOR.sub(lambda m: self.filled(f"$game_actors[{m[1]}].name", m[0]), text)
        text = PLAYER_NAME.sub(lambda m: self.filled("$player.name", m[0]), text)
        text = MONEY.sub(lambda m: self.money(m[0]), text)
        text = LINE_BREAK.sub("\n", text)
        text = self.gendered(text)
        for pattern in (HEX_COLOUR, GENDER_COLOUR, NAMED_COLOUR, WINDOWSKIN):
            text = pattern.sub("", text)
        text = CONTROL_ONE.sub(CONTROL_CHAR, text)
        text = INDEXED_COLOUR.sub("", text)
        while True:
            last = text
            text = VARIABLE.sub(lambda m: ruby_text(self.value(f"$game_variables[{m[1]}]")), text)
            if text == last:
                break
        for pattern in (LINE_COUNT, CONTROLS, MARKUP):
            text = pattern.sub("", text)
        text = MARKUP_BREAK.sub("\n", text)
        return text.replace(CONTROL_CHAR, "").replace(ESCAPED_BACKSLASH, "\\")

    def filled(self, path: str, code: str) -> str:
        value = self.value(path)
        return code if value is None else ruby_text(value)

    def money(self, code: str) -> str:
        value = self.value("$player.money")
        return code if value is None else f"{value:,}$"

    def gendered(self, text: str) -> str:
        if "\\@" not in text:
            return text
        female, male = self.value("$player.female?"), self.value("$player.male?")
        if female:
            text = GENDER_ENDING_A.sub("a", text)
        if male:
            text = GENDER_ENDING_A.sub("", text)
        if female:
            text = GENDER_ENDING.sub("a", text)
        if male:
            text = GENDER_ENDING.sub("o", text)
        return text


def ruby_text(value: Any) -> str:
    return "" if value is None else str(value)


def note(session: Session, kind: str, stage: str, **fields: Any) -> None:
    reply = session.call("note", kind=kind, entry={"stage": stage, **fields})
    if not NoteResult.model_validate(reply.result).recorded:
        log.info("the session keeps no record; the %s %s entry was dropped", kind, stage)


def same_text(expected: str, shown: Any) -> bool:
    return isinstance(shown, str) and expected.split() == shown.split()


def look(session: Session) -> Look:
    answer = session.read(ReadRequest(paths=[INTERPRETER_RUNNING, BATTLE]))
    values = answer.value.values
    if answer.value.errors:
        raise StateError(f"context read failed at tick {answer.tick}: {answer.value.errors}")
    context = classify(answer.caller, answer.payloads, bool(values[INTERPRETER_RUNNING[0]]))
    if context.name == UNKNOWN:
        log_unknown(session.session_dir, answer.tick, answer.caller)
    return Look(answer.tick, context, values[BATTLE[0]] is not None, answer.caller)


def line_fields(line: Line) -> dict[str, Any]:
    fields = {key: value for key, value in asdict(line).items() if value is not None}
    fields["line"] = fields.pop("kind")
    del fields["tick"]
    return fields


def decision_fields(decision: Any) -> dict[str, Any] | None:
    if decision is None:
        return None
    return {key: value for key, value in asdict(decision).items() if value is not None}


def where(view: Look) -> str:
    screen = f" ({view.context.screen})" if view.context.screen else ""
    return f"{view.context.name}{screen}"


@dataclass
class Steps:
    driver: Driver
    kind: str
    logger: logging.Logger
    report: Callable[[str], None]
    transcript: list[Line] = field(default_factory=list)
    events: list[Event] = field(default_factory=list)
    shown: set[tuple[Any, Any]] = field(default_factory=set)
    tick: int = 0

    @property
    def session(self) -> Session:
        return self.driver.session

    def look(self) -> Look:
        view = look(self.session)
        self.tick = view.tick
        return view

    def advance(
        self,
        ticks: int,
        inputs: Sequence[TickInput] = (),
        *,
        repeat: bool = False,
        until: Sequence[StopCondition] = (),
    ) -> AdvanceResult:
        step: Answer[AdvanceResult] = self.driver.advance_driven(
            ticks, inputs, repeat=repeat, until=until
        )
        self.events.extend(step.events)
        self.tick = step.tick
        return step.value

    def note(self, stage: str, **fields: Any) -> None:
        note(self.session, self.kind, stage, **fields)

    def close_entry(self, view: Look) -> bool:
        species = (view.payload("pokedex") or {}).get("species")
        self.logger.info("closing the Pokédex entry of %s on tick %d", species, view.tick)
        self.note("step", prompt="pokedex", screen=view.context.name, answer=species)
        return self.confirm(view)

    def record(self, line: Line) -> None:
        self.transcript.append(line)
        self.note("line", **line_fields(line))
        if isinstance(line, MessageLine):
            self.logger.info("message on tick %d: %r", line.tick, line.text)
            self.report(f"tick {line.tick}: {line.text}")
        else:
            prompt = f" to {line.prompt!r}" if line.prompt else ""
            self.logger.info("answered %r%s on tick %d", line.answer, prompt, line.tick)
            self.report(f"tick {line.tick}: answered {line.answer!r}{prompt}")

    def text(self, raw: Any) -> str:
        return Filler(self.session).text(ruby_text(raw))

    def message(self, view: Look) -> bool:
        payload = view.payload(MESSAGE)
        progressed = False
        if payload is not None and (payload.get("tick"), payload.get("text")) not in self.shown:
            self.shown.add((payload.get("tick"), payload.get("text")))
            raw = ruby_text(payload.get("text"))
            self.record(MessageLine(view.tick, raw, self.text(raw)))
            progressed = True
        spent = 0
        while spent < MESSAGE_TICKS:
            result = self.advance(
                MESSAGE_TICKS - spent,
                [buttons(CONFIRM), TickInput()],
                repeat=True,
                until=["payloads", "signature"],
            )
            spent += result.ticks
            if result.stopped == "payloads":
                return True
            if result.stopped == "ticks":
                return progressed
            now = self.look()
            if now.place != view.place:
                return True
        return progressed

    def wait(self, view: Look) -> bool:
        spent = 0
        while spent < WAIT_TICKS:
            result = self.advance(WAIT_TICKS - spent, until=["signature", "payloads"])
            spent += result.ticks
            if result.stopped == "ticks":
                return False
            now = self.look()
            if now.place != view.place or now.battle != view.battle:
                return True
        return False

    def press(self, button: str) -> None:
        self.advance(PRESS_TICKS, [buttons(button), TickInput()])

    def confirm(self, view: Look, button: str = CONFIRM) -> bool:
        result = self.advance(
            CONFIRM_TICKS, [buttons(button), TickInput()], repeat=True, until=["payloads"]
        )
        return result.stopped == "payloads" or self.look().place != view.place

    def live(
        self, view: Look, kind: str, name: str, context: str | None = None
    ) -> tuple[Look, dict[str, Any]] | Ended:
        expected = kind if context is None else context
        for _ in range(WINDOW_TICKS):
            payload = view.payload(kind)
            if payload is None or view.context.name != expected:
                return Ended(
                    "stuck", f"the {kind} closed at tick {view.tick} before it was answered"
                )
            if payload.get(name) is not None:
                return view, payload
            self.advance(1)
            view = self.look()
        return Ended(
            "stuck", f"the {kind} window showed no live {name} within {WINDOW_TICKS} ticks"
        )

    def prompt(self, view: Look, payload: dict[str, Any]) -> str | None:
        text = payload.get("text")
        if text is None:
            message = view.payload(MESSAGE)
            text = None if message is None else message.get("text")
        return None if text is None else self.text(text)

    def cursor_to(
        self,
        view: Look,
        kind: str,
        target: int,
        rows: int,
        label: str,
        keys: tuple[str, str] = ("DOWN", "UP"),
    ) -> tuple[Look, dict[str, Any]] | Ended:
        context = view.context.name
        found = self.live(view, kind, "cursor", context)
        if isinstance(found, Ended):
            return found
        view, payload = found
        presses = 0
        while payload.get("cursor") != target:
            if presses >= CURSOR_PRESSES * max(rows, 1):
                return Ended(
                    "stuck",
                    f"the cursor never reached {label!r} "
                    f"(at {payload.get('cursor')} after {presses} presses)",
                )
            self.press(keys[0] if target > payload["cursor"] else keys[1])
            presses += 1
            found = self.live(self.look(), kind, "cursor", context)
            if isinstance(found, Ended):
                return found
            view, payload = found
        return view, payload

    def choice(self, view: Look, answer: str | None, taken: Callable[[], None]) -> bool | Ended:
        found = self.live(view, CHOICE, "cursor", view.context.name)
        if isinstance(found, Ended):
            return found
        view, payload = found
        options = [self.text(option) for option in payload.get("options") or []]
        prompt = self.prompt(view, payload)
        target = (
            next((index for index, option in enumerate(options) if same_text(answer, option)), None)
            if answer is not None
            else None
        )
        if target is None:
            decision = Decision(CHOICE, prompt, options=options, cursor=payload.get("cursor"))
            why = "no answer left" if answer is None else f"{answer!r} is not one of {options}"
            return Ended("decision", f"a choice is open with {why}", decision)
        reached = self.cursor_to(view, CHOICE, target, len(options), options[target])
        if isinstance(reached, Ended):
            return reached
        view, _ = reached
        taken()
        self.record(AnswerLine(view.tick, prompt, options, options[target]))
        if not self.confirm(view):
            return Ended("stuck", f"C on the answer closed nothing within {CONFIRM_TICKS} ticks")
        return True

    def number(self, view: Look, answer: str | None, taken: Callable[[], None]) -> bool | Ended:
        context = view.context.name
        found = self.live(view, NUMBER, "value", context)
        if isinstance(found, Ended):
            return found
        view, payload = found
        minimum, maximum = payload.get("min"), payload.get("max")
        prompt = self.prompt(view, payload)
        target = parse_number(answer, minimum, maximum)
        if target is None:
            decision = Decision(
                NUMBER,
                prompt,
                minimum=minimum,
                maximum=maximum,
                value=payload.get("value"),
                digit=payload.get("digit"),
            )
            why = (
                "no answer left"
                if answer is None
                else f"{answer!r} is not an integer from {minimum} to {maximum}"
            )
            return Ended("decision", f"a number input is open with {why}", decision)
        reached = self.enter(view, payload, target, context)
        if isinstance(reached, Ended):
            return reached
        view = reached
        taken()
        self.record(
            AnswerLine(view.tick, prompt, None, str(target), minimum=minimum, maximum=maximum)
        )
        if not self.confirm(view):
            return Ended("stuck", f"C on the answer closed nothing within {CONFIRM_TICKS} ticks")
        return True

    def enter(self, view: Look, payload: dict[str, Any], target: int, context: str) -> Look | Ended:
        places: dict[int, int] = {}
        for _ in range(NUMBER_PRESSES):
            value, digit = payload["value"], payload.get("digit")
            if value == target:
                return view
            if digit is None:
                return Ended("stuck", "the number window showed no live digit")
            if (value < 0) != (target < 0):
                return Ended(
                    "stuck", f"entering {target} from {value} needs a sign change, not done here"
                )
            place = places.get(digit)
            if place is None:
                self.press("UP")
                found = self.live(self.look(), NUMBER, "value", context)
                if isinstance(found, Ended):
                    return found
                view, payload = found
                learned = digit_place(abs(value), abs(payload["value"]))
                if learned is not None:
                    places[digit] = learned
                continue
            have = abs(value) // place % DIGIT_BASE
            want = abs(target) // place % DIGIT_BASE
            if have != want:
                up = (want - have) % DIGIT_BASE
                self.press("UP" if up <= DIGIT_BASE - up else "DOWN")
            else:
                wanted = highest_difference(abs(value), abs(target))
                known = next((index for index, size in places.items() if size == wanted), None)
                if known is not None:
                    self.press("LEFT" if known < digit else "RIGHT")
                else:
                    self.press("LEFT" if wanted > place else "RIGHT")
            found = self.live(self.look(), NUMBER, "value", context)
            if isinstance(found, Ended):
                return found
            view, payload = found
        return Ended(
            "stuck",
            f"the number never reached {target} in {NUMBER_PRESSES} presses "
            f"(at {payload.get('value')})",
        )


def parse_number(answer: str | None, minimum: Any, maximum: Any) -> int | None:
    if answer is None:
        return None
    try:
        number = int(answer.strip())
    except ValueError:
        return None
    if isinstance(minimum, int) and number < minimum:
        return None
    if isinstance(maximum, int) and number > maximum:
        return None
    return number


def digit_place(before: int, after: int) -> int | None:
    change = after - before
    size = change if change > 0 else -change // (DIGIT_BASE - 1)
    if change == 0 or (change < 0 and -change % (DIGIT_BASE - 1)):
        return None
    place = 1
    while place < size:
        place *= DIGIT_BASE
    return place if place == size else None


def highest_difference(value: int, target: int) -> int:
    place = 1
    highest = 1
    while place <= max(value, target):
        if value // place % DIGIT_BASE != target // place % DIGIT_BASE:
            highest = place
        place *= DIGIT_BASE
    return highest
