from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

PROTOCOL_VERSION = 1

type Role = Literal["driver", "control"]
type StopCondition = Literal["signature", "payloads", "position", "moving"]
type StopReason = Literal["signature", "payloads", "position", "moving", "ticks", "control"]
type ControlAction = Literal["take", "release"]
type SpeedPreset = Literal["1x", "2x", "max"]
type PauseAction = Literal["pause", "resume", "step"]
type SnapshotAction = Literal["save", "restore"]
type SnapshotVia = Literal["save", "restore", "boot"]
type RevealVia = Literal[
    "pbDisplayUseMessage",
    "pbShowAbilitySplash",
    "pbReplaceAbilitySplash",
    "pbHeldItemTriggered",
    "pbConsumeItem",
    "pbSendOut",
    "triggerOnBeingHit",
    "pbOnLosingAbility",
    "triggerOnSwitchIn",
    "text",
]


class Event(BaseModel):
    seq: int
    tick: int
    kind: str
    data: dict[str, Any] = {}


class ShownFact(BaseModel):
    kind: Literal["move", "ability", "item"]
    id: str
    own: bool


class SendOutFact(BaseModel):
    kind: Literal["send_out"]
    species: str
    illusion: bool


class Reveal(BaseModel):
    battler: int
    side: int
    trainer: str | None
    slot: int
    fact: Annotated[ShownFact | SendOutFact, Field(discriminator="kind")]
    via: RevealVia


class Digest(BaseModel):
    party: int | None = None
    position: tuple[int, int, int] | None = None
    rng: int
    error: str | None = None


class Reply(BaseModel):
    id: int | None
    tick: int
    ok: bool
    result: Any = None
    error: str | None = None
    events: list[Event] = []
    events_gap: bool = False
    caller: list[str] = []
    payloads: list[dict[str, Any]] = []
    digest: Digest | None = None


class Handshake(BaseModel):
    protocol: int
    bridge_hash: str
    build: str
    pid: int
    tick: int
    session: str | None
    role: Role | None = None
    snapshot: str | None = None
    event_seq: int = 0


class EvalResult(BaseModel):
    model_config = {"populate_by_name": True}

    class_name: str = Field(alias="class")
    inspect: str


class StackResult(BaseModel):
    frames: list[str]


class ShotResult(BaseModel):
    file: str


class RngResult(BaseModel):
    calls: int


class ReadRequest(BaseModel):
    paths: list[tuple[str, str] | tuple[str, str, int]]
    depth: int | None = None
    calls: dict[str, list[str]] = {}
    stop: list[str] = []


class ReadResult(BaseModel):
    values: dict[str, Any]
    errors: dict[str, str]


class TickInput(BaseModel):
    buttons: list[str] = []
    keys: list[str | int] = []
    text: str = ""


class AdvanceRequest(BaseModel):
    ticks: int = Field(gt=0)
    inputs: list[TickInput] = []
    repeat: bool = False
    until: list[StopCondition] = []


class AdvanceResult(BaseModel):
    ticks: int
    stopped: StopReason
    position: tuple[int, int, int] | None
    moving: bool | None
    signature: str


class ControlResult(BaseModel):
    owner: bool
    driver: bool


class SpeedResult(BaseModel):
    speed: SpeedPreset
    renders: int


class PauseResult(BaseModel):
    paused: bool


class SoundResult(BaseModel):
    muted: bool


class StatusResult(BaseModel):
    speed: SpeedPreset
    renders: int
    paused: bool
    muted: bool
    owner: bool
    driver: bool
    driven: bool
    restoring: bool
    clients: int


class SnapshotResult(BaseModel):
    name: str
    seed: int
    hash: str
    tick: int
    via: SnapshotVia


class NoteResult(BaseModel):
    recorded: bool
