import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel

log = logging.getLogger("harness.context")

UNKNOWN_LOG = "unknown_contexts.jsonl"
FRAME = re.compile(r"^(?P<section>\d{3}:[^:]+|\[[^:]+):(?P<line>\d+)(?::in `(?P<method>[^']*)')?$")
PASS = "pass"
OVERWORLD = "overworld"
EVENT = "event"
UNKNOWN = "unknown"
MENU = "menu"
SPECIAL = "special"
POKEDEX_ENTRY = "pokedex_entry"
BAG = "408:Bag with interactuable party"
ITEM_HELPER = "315:UI_ItemStorage"
PARTY = "302:UI_Party"
STORAGE = "421:Storage System Utilities"
STORAGE_UI = "314:UI_PokemonStorage"
MART = "317:UI_PokeMart"
EVOLUTION_UI = "328:UI_Evolution"
LEARN_MOVE = ("267:Item_Utilities", "pbLearnMove")
BATTLE_LEARN_MOVE = ("152:Battle_ExpAndMoveLearning", "pbLearnMove")
BATTLE_MESSAGES = "[v21.1 Hotfixes] Battle bug fixes.rb"
MIDBATTLE = "[Deluxe Battle Kit] [000] Midbattle Animations.rb"
KEY_ITEM = "[BW Key Items] BW Key Item.rb"
EVOLUTION = (EVOLUTION_UI, "pbEvolution")
NAMING = ("[Challenge Modes] 006_Misc.rb", "pbEnterPokemonName")
UI_BASE = "297:UI_base"
RELEARNER = ("409:BetterMoveRelearner", "main")


@dataclass(frozen=True)
class Rule:
    section: str
    method: str
    context: str
    screen: str | None = None
    under: tuple[str, str] | None = None


TABLE: tuple[Rule, ...] = (
    Rule("[Intro Versus] 001_script_principal.rb", "update", PASS),
    Rule("[Lens of truth] Script.rb", "update", PASS),
    Rule("[Discord Rich Presence API] script.rb", "update", PASS),
    Rule("[Misc Scripts Añil] 015_damage_numbers.rb", "pbGraphicsUpdate", PASS),
    Rule("190:Battle_Scene", "pbGraphicsUpdate", PASS),
    Rule("190:Battle_Scene", "pbUpdate", PASS),
    Rule("411:Debug Passability", "block in main", OVERWORLD),
    Rule("038:Interpreter", "block in update", EVENT),
    Rule("093:Messages", "block in pbMessageDisplay", SPECIAL, "learn_move", LEARN_MOVE),
    Rule("[Map Zoom] Map Zoom.rb", "block in pbShowCommands", SPECIAL, "learn_move", LEARN_MOVE),
    Rule("093:Messages", "block in pbMessageDisplay", SPECIAL, "evolution", EVOLUTION),
    Rule("093:Messages", "block in pbMessageDisplay", SPECIAL, "naming", NAMING),
    Rule("093:Messages", "block in pbMessageDisplay", "message"),
    Rule(BATTLE_MESSAGES, "block in pbDisplayMessage", SPECIAL, "learn_move", BATTLE_LEARN_MOVE),
    Rule(
        BATTLE_MESSAGES, "block in pbDisplayPausedMessage", SPECIAL, "learn_move", BATTLE_LEARN_MOVE
    ),
    Rule("190:Battle_Scene", "block in pbShowCommands", SPECIAL, "learn_move", BATTLE_LEARN_MOVE),
    Rule("190:Battle_Scene", "block in pbShowCommands", "choice"),
    Rule("[v21.1 Hotfixes] Battle bug fixes.rb", "block in pbDisplayMessage", "message"),
    Rule("[v21.1 Hotfixes] Battle bug fixes.rb", "block in pbDisplayPausedMessage", "message"),
    Rule("[Map Zoom] Map Zoom.rb", "block in pbShowCommands", "choice"),
    Rule("428:ItemFind", "block in pbShow", "message", "item_found"),
    Rule("093:Messages", "block in pbChooseNumber", "number"),
    Rule("[Pantalla de Título Animada] Scene Intro.rb", "block in update", "menu", "title"),
    Rule("[Multi Save] Multi Save.rb", "block in pbChoose", "menu", "load"),
    Rule("102:EventScene", "update", "menu", "event_scene", ("102:EventScene", "block in main")),
    Rule(
        "[PauseMenuDP] Script.rb",
        "update",
        "menu",
        "pause",
        ("[PauseMenuDP] Script.rb", "pbPauseMenu"),
    ),
    Rule(
        "408:Bag with interactuable party",
        "block (2 levels) in pbChooseItem",
        "battle_bag",
        under=("408:Bag with interactuable party", "block in pbItemMenu"),
    ),
    Rule(
        BAG,
        "block (2 levels) in pbChooseItem",
        MENU,
        "mart_sell",
        under=(MART, "pbChooseSellItem"),
    ),
    Rule(BAG, "block (2 levels) in pbChooseItem", MENU, "bag"),
    Rule(BAG, "block in pbChoosePoke", MENU, "bag_party"),
    Rule(BAG, "block in pbDisplay", MENU, "bag_message"),
    Rule(ITEM_HELPER, "block in pbShowCommands", MENU, "bag_commands", (BAG, "pbShowCommands")),
    Rule(ITEM_HELPER, "block in pbConfirm", MENU, "bag_confirm", (BAG, "pbConfirm")),
    Rule(ITEM_HELPER, "block in pbChooseNumber", MENU, "bag_number", (BAG, "pbChooseNumber")),
    Rule(ITEM_HELPER, "block in pbChooseNumber", MENU, "party_number", (PARTY, "pbChooseNumber")),
    Rule(PARTY, "block in pbDisplay", MENU, "party_message"),
    Rule(PARTY, "block (2 levels) in pbDisplayConfirm", MENU, "party_confirm"),
    Rule(STORAGE, "block in pbSelectBoxInternal", MENU, "storage_box"),
    Rule(STORAGE, "block in pbSelectPartyInternal", MENU, "storage_party"),
    Rule(STORAGE_UI, "block in pbShowCommands", MENU, "storage_commands"),
    Rule(STORAGE_UI, "block in pbDisplay", MENU, "storage_message"),
    Rule(MART, "block (2 levels) in pbChooseBuyItem", MENU, "mart_buy"),
    Rule(MART, "block (2 levels) in pbChooseNumber", MENU, "mart_number"),
    Rule(MART, "block in pbConfirm", MENU, "mart_confirm"),
    Rule(MART, "block in pbDisplay", MENU, "mart_message"),
    Rule(MART, "block in pbDisplayPaused", MENU, "mart_message"),
    Rule("[Multi Save] Multi Save.rb", "block in slotSelectCommands", MENU, "save_slots"),
    Rule("[v21.1 Hotfixes] Misc bug fixes.rb", "block in pbMapScene", MENU, "region_map"),
    Rule(UI_BASE, "block in navigate", MENU, "move_reminder", RELEARNER),
    Rule(UI_BASE, "block in show_message", MENU, "move_reminder_message", RELEARNER),
    Rule(
        UI_BASE,
        "block (2 levels) in show_confirm_message",
        MENU,
        "move_reminder_confirm",
        RELEARNER,
    ),
    Rule(UI_BASE, "block in fade_in", "transition", under=RELEARNER),
    Rule(*RELEARNER, "transition"),
    Rule(UI_BASE, "block in fade_out", "transition", under=RELEARNER),
    Rule(
        "[Modular UI Scenes] [002] Summary Utilities.rb",
        "block in pbChooseMoveToForget",
        SPECIAL,
        "forget_move",
    ),
    Rule(EVOLUTION_UI, "block in pbEvolution", SPECIAL, "evolution"),
    Rule(EVOLUTION_UI, "block in pbFlashInOut", SPECIAL, "evolution"),
    Rule(EVOLUTION_UI, "block in pbEvolutionSuccess", SPECIAL, "evolution"),
    Rule("267:Item_Utilities", "block in pbTopRightWindow", SPECIAL, "stats"),
    Rule(
        "[Misc Scripts Añil] 008_Menú de starters.rb",
        "block in pbSelectElement",
        "menu",
        "starters",
    ),
    Rule("322:UI_TextEntry", "block in pbEntry1", "special", "naming"),
    Rule(
        "302:UI_Party",
        "block in pbChoosePokemon",
        "battle_switch",
        under=("192:Scene_ChooseCommands", "block in pbPartyScreen"),
    ),
    Rule("302:UI_Party", "block in pbChoosePokemon", "menu", "party"),
    Rule("302:UI_Party", "block (2 levels) in pbShowCommands", "menu", "party_commands"),
    Rule(
        "[[DBK] Enhanced Battle UI] [002] Selection Menu.rb",
        "block in pbCommandMenuEx",
        "battle_command",
    ),
    Rule(
        "[Deluxe Battle Kit] [003] Command Menu Refactor.rb", "block in pbFightMenu", "battle_fight"
    ),
    Rule("192:Scene_ChooseCommands", "block in pbChooseTarget", "battle_target"),
    Rule("301:UI_Pokedex_Entry", "block in pbSceneBrief", POKEDEX_ENTRY),
    Rule("[Intro Versus] 001_script_principal.rb", "transition", "transition"),
    Rule("084:MessageConfig", "pbSetSpritesToColor", "transition"),
    Rule("084:MessageConfig", "block in pbFadeOutIn", "transition"),
    Rule("102:EventScene", "update", "transition"),
    Rule("326:UI_Controls", "pbOnScreenEnd", "transition"),
    Rule(
        "261:Overworld_BattleIntroAnim", "block (2 levels) in pbBattleAnimationCore", "transition"
    ),
    Rule("261:Overworld_BattleIntroAnim", "pbBattleAnimationCore", "transition"),
    Rule("261:Overworld_BattleIntroAnim", "block in pbBattleAnimation", "transition"),
    Rule("260:Overworld_BattleStarting", "after_battle", "transition"),
    Rule("245:Overworld", "pbWait", "transition"),
    Rule("327:UI_EggHatching", "updateScene", "transition"),
    Rule(PARTY, "block in pbSwitchBegin", "transition"),
    Rule(PARTY, "block in pbSwitchEnd", "transition"),
    Rule(STORAGE_UI, "block in pbSwitchBoxToRight", "transition"),
    Rule(STORAGE_UI, "block in pbSwitchBoxToLeft", "transition"),
    Rule(STORAGE_UI, "block in pbShowPartyTab", "transition"),
    Rule(STORAGE_UI, "block in pbHidePartyTab", "transition"),
    Rule(STORAGE_UI, "pbHold", "transition"),
    Rule(STORAGE_UI, "pbPlace", "transition"),
    Rule("047:Game_Map", "block in pbScrollMap", "transition"),
    Rule("245:Overworld", "block in pbMoveTowardPlayer", "transition"),
    Rule("367:Utilities", "pbExclaim", "transition"),
    Rule(KEY_ITEM, "block in pbUpdate", "transition"),
    Rule(KEY_ITEM, "block in shakeItem", "transition"),
    Rule("257:Overworld_MapTransitionAnims", "pbCaveEntranceEx", "transition"),
    Rule("257:Overworld_MapTransitionAnims", "block in pbCaveEntranceEx", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbBattleIntroAnimation", "transition"),
    Rule("193:Scene_PlayAnimations", "pbBattleIntroAnimation", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbSendOutBattlers", "transition"),
    Rule("193:Scene_PlayAnimations", "pbSendOutBattlers", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbRecall", "transition"),
    Rule("193:Scene_PlayAnimations", "pbShowPartyLineup", "transition"),
    Rule("193:Scene_PlayAnimations", "pbShowOpponent", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbAnimationCore", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbHitAndHPLossAnimation", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbDamageAnimation", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbShowAbilitySplash", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbHideAbilitySplash", "transition"),
    Rule("150:Battle", "pbShowAbilitySplash", "transition"),
    Rule("190:Battle_Scene", "pbWaitMessage", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbThrow", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbThrowSuccess", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbHideCaptureBall", "transition"),
    Rule("193:Scene_PlayAnimations", "block in pbThrowAndDeflect", "transition"),
    Rule("193:Scene_PlayAnimations", "pbEXPBar", "transition"),
    Rule("193:Scene_PlayAnimations", "pbHPChanged", "transition"),
    Rule("[v21.1 Hotfixes] Battle bug fixes.rb", "block in pbFaintBattler", "transition"),
    Rule(MIDBATTLE, "block in pbToggleBlackBars", "transition"),
    Rule(MIDBATTLE, "block in pbToggleDataboxes", "transition"),
    Rule(MIDBATTLE, "pbShowSpeaker", "transition"),
    Rule(MIDBATTLE, "pbHideSpeaker", "transition"),
    Rule(MIDBATTLE, "pbUpdateSpeakerSprite", "transition"),
    Rule(
        "[Deluxe Battle Kit] [005] Mega Evolution.rb", "block in pbShowMegaEvolution", "transition"
    ),
    Rule("[[DBK] Enhanced Battle UI] [000] Main.rb", "block in pbRefreshUIPrompt", "transition"),
    Rule(
        "[[DBK] Animated Pokémon System] [007] Substitute Doll.rb",
        "block in pbAnimateSubstitute",
        "transition",
    ),
    Rule("[Deluxe Battle Kit] [001] Animation Utilities.rb", "pbPauseScene", "transition"),
    Rule(
        "[Deluxe Battle Kit] [001] Animation Utilities.rb",
        "block in pbItemUseAnimation",
        "transition",
    ),
    Rule("[Pantalla de Título Animada] Intro Animation.rb", "block in wait", "transition"),
    Rule("[Lens of truth] Script.rb", "block (2 levels) in <main>", "transition"),
    Rule("[Map Zoom] Map Zoom.rb", "initialize", "transition"),
    Rule("[Map Zoom] Map Zoom.rb", "pbDisposeZoomMap", "transition"),
    Rule("415:Fondos Terrenos", "block in sceneWait", "transition"),
)


class Context(BaseModel):
    name: str
    screen: str | None
    frame: str | None
    payloads: list[dict[str, Any]]


def frame_key(frame: str) -> tuple[str, str] | None:
    match = FRAME.match(frame)
    if match is None:
        return None
    return match["section"], match["method"] or ""


def rule_for(frames: list[str], index: int) -> Rule | None:
    key = frame_key(frames[index])
    if key is None:
        return None
    outer = {frame_key(frame) for frame in frames[index + 1 :]}
    for rule in TABLE:
        if (rule.section, rule.method) == key and (rule.under is None or rule.under in outer):
            return rule
    return None


def classify(
    frames: list[str], payloads: list[dict[str, Any]], interpreter_running: bool
) -> Context:
    for index, frame in enumerate(frames):
        rule = rule_for(frames, index)
        if rule is None:
            return Context(name=UNKNOWN, screen=None, frame=frame, payloads=payloads)
        if rule.context == PASS:
            continue
        name = EVENT if rule.context == OVERWORLD and interpreter_running else rule.context
        return Context(name=name, screen=rule.screen, frame=frame, payloads=payloads)
    return Context(name=UNKNOWN, screen=None, frame=None, payloads=payloads)


def log_unknown(session_dir: Path, tick: int, frames: list[str]) -> None:
    log.warning("unknown context at tick %d; call stack:\n  %s", tick, "\n  ".join(frames))
    with (session_dir / UNKNOWN_LOG).open("a", encoding="utf-8") as file:
        file.write(json.dumps({"tick": tick, "frames": frames}, ensure_ascii=False) + "\n")
