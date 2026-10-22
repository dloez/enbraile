import json
import logging
import re
import sqlite3
import time
from collections.abc import Callable, Generator
from contextlib import closing, contextmanager
from dataclasses import dataclass, field, fields, replace
from pathlib import Path, PureWindowsPath
from typing import Any

from anil.bridge.client import BridgeClient, BridgeError
from anil.bridge.protocol import PROTOCOL_VERSION, NoteResult, ReadRequest, ReadResult
from anil.bridge.sources import bridge_hash
from anil.harness import calc, gamedb
from anil.harness.context import OVERWORLD, Context, classify
from anil.harness.dialog import DialogResult, continue_dialog, interact
from anil.harness.drive import DriveError, Driver, buttons, drive, keys
from anil.harness.investigate import Answer, InvestigateError, Session, attach
from anil.harness.knowledge import (
    HIDDEN,
    MAX_MOVES,
    STORY,
    Hidden,
    KnowledgeView,
    Known,
    KnownBattle,
    KnownEffect,
    KnownFoe,
    KnownRandom,
)
from anil.harness.launch import LaunchError, stop
from anil.harness.lock import GAME_IMAGE, read_lock
from anil.harness.random import OWN, Learnset
from anil.harness.replay import LAUNCH_JSON, ReplayError, SessionLaunch, load_launch, replay
from anil.harness.rules import (
    CHAPAS,
    EV_BERRIES,
    FEATHERS,
    MACHO_BRACE,
    MOCHIS,
    POWER_ITEMS,
    RESET_MOCHI,
    VITAMINS,
)
from anil.harness.showdown import export_party
from anil.harness.snapshot import SnapshotError
from anil.harness.snapshot import restore as restore_snapshot
from anil.harness.snapshot import save as save_snapshot
from anil.harness.state import (
    BATTLER_EFFECTS,
    INTERPRETER_RUNNING,
    Battler,
    BattlerEffects,
    Named,
    read_state,
)
from anil.harness.steps import CONFIRM, Line, MessageLine
from anil.harness.world import WorldError, open_world
from anil.install.builds import BUILDS
from anil.install.deploy import game_dir, read_stamp
from anil.install.windows import InteropError, run_windows, to_linux, to_unc, windows_process_image
from anil.mod.allowlists import load as load_allow_lists
from anil.mod.allowlists import load_types
from anil.settings import Settings

log = logging.getLogger("harness.check")

CHECK_KIND = "check"
CLIENT_NAME = "anil check"
HANDSHAKE_CLIENT_NAME = "anil check handshake"
HANDSHAKE_TIMEOUT_SECONDS = 5.0
READ_DEPTH = 6

CHALLENGE_RULES = (
    "PERMAFAINT",
    "HEALING_ITEMS_PURCHASE",
    "BATTLE_ITEMS_PURCHASE",
    "VITAMINS_PURCHASE",
    "ONE_CAPTURE",
    "FIRST_CAPTURE",
    "GIFT_CLAUSE",
    "SHINY_CLAUSE",
    "DUPS_CLAUSE",
    "LEGENDARY_CLAUSE",
    "FORCE_NICKNAME",
    "FORCE_SET_BATTLES",
)
RANDOM_FLAGS = {
    "random_enabled": True,
    "progressive_random": True,
    "randomize_pokemon": True,
    "consistent_wild_encounters": True,
    "enable_random_moves": True,
    "prioritize_stab_in_learnset": True,
    "different_movesets_per_form": True,
    "banohko": True,
    "enable_random_tm_compat": True,
    "enable_random_types": False,
    "enable_random_evolutions": False,
    "enable_random_evolutions_similar_bst": False,
    "enable_random_evolutions_respect_restrictions": False,
    "randomize_items": True,
    "randomize_held_items": True,
    "randomize_trainers": True,
    "remember_trainer_teams": True,
    "randomize_trainers_items": True,
    "randomize_starters": True,
    "semi_random_mode": False,
}
RANDOM_GENS = [1, 2, 3, 4, 5]
ABILITY_MODE = "FULLRANDOM"
ABILITY_SWITCH = 48
RANDOMIZER_RULES = {
    "PROGRESSIVE_RANDOM": True,
    "RANDOMIZE_POKEMON": True,
    "CONSISTENT_ENCOUNTERS": True,
    "RANDOMIZE_MOVES": True,
    "PRIORIZE_STAB_IN_LEARNSET": True,
    "DIFFERENT_MOVESETS_PER_FORM": True,
    "BAN_OHKO": True,
    "RANDOMIZE_TM_COMPATIBILITY": True,
    "RANDOMIZE_ABILITIES": ABILITY_MODE,
    "GENS": {f"GEN{gen}": True for gen in RANDOM_GENS},
    "RANDOMIZE_TRAINERS": True,
    "REMEMBER_TRAINER_TEAMS": True,
    "RANDOMIZE_TRAINER_ITEMS": True,
    "RANDOMIZE_ITEMS": True,
    "RANDOMIZE_HELD_ITEMS": True,
}
STARTER_VARIABLES = (803, 804, 805)
MODE_SWITCHES = {109: False, 110: True, 111: False}
SET_STYLE = 1
WILD_HIDDEN = 1
HIDDEN_OPTIONS = ("battle_style", "salvajes_visibles_en_ow")
RULEBOOK = "RULEBOOK"
LAB_VARIABLES = {76: 31, 78: 4, 79: 8}
PLAYER_OPACITY = 255
CLEAR_TONE = "(0.000000, 0.000000, 0.000000, 0.000000)"
BEDROOM_MAP = 28
SKIPPED_MAPS = (104, 217)
MOD_VERSION = 1
WINDOW_TITLE = f"Pokémon Añil Randomlocke v{MOD_VERSION}"
MOD_LOG_LINES = ("randomlocke self-check passed", f"randomlocke v{MOD_VERSION} installed")
NEW_GAME_LOG_LINE = "randomlocke new game set up"
MOD_SOURCE = "randomlocke.rb"
UPDATER_METHODS = ("check_for_updates", "validate_game_version", "validate_game_version_and_update")
DISCORD_IVARS = ["large_image", "small_image", "timestamp_start"]
GAME_SAVE_SLOT = "Partida 1"
SAVE_FILE_SUFFIX = ".rxdata"
SAVE_FILE_PATH_NAME = "Game.rxdata"
ANIL_SAVE_FOLDER = "Pokemon Anil"
SNAPSHOT_PREFIX = "check-"
SNAPSHOT_MUTATION = (
    "$player.money += 1234; $bag.add(:POTION); "
    "$game_switches[1] = !$game_switches[1]; $player.money"
)
SNAPSHOT_WAIT_TICKS = 120
BRIDGE_LOG = "bridge.log"
HARNESS_LOG = "harness.log"
HANDSHAKE_LOG_LINE = "handshake ok"
NO_MEGA_SWITCH = 34
STARTER_REGION_SWITCHES = {334 + index: index == 0 for index in range(11)}
CHOSEN_STARTERS_VARIABLE = 31
CHOSEN_STARTERS = ["BULBASAUR", "CHARMANDER", "SQUIRTLE"]
STARTER_MENU_METHOD = "pbMostrarListaStarters"
STARTER_REGION_LOG_LINE = "randomlocke starter region set: Kanto"
NEW_GAME_SAVE_LOG_LINE = "randomlocke new game saved to {slot}: true"
MANUAL_SLOT_PATTERN = re.compile(r"Partida \d+")
ALLOW_LISTS = load_allow_lists()
ALLOWED_SPECIES = frozenset(ALLOW_LISTS.species)
ALLOWED_MOVES = frozenset(ALLOW_LISTS.moves)
ALLOWED_ABILITIES = frozenset(ALLOW_LISTS.abilities)
OFFICIAL_TYPES = load_types()

type Paths = list[tuple[str, str] | tuple[str, str, int]]

NEW_GAME_PATHS: Paths = [
    ("scene", "$scene.class.name"),
    INTERPRETER_RUNNING,
    ("message", "$game_temp.message_window_showing"),
    ("map", "$game_map.map_id"),
    ("x", "$game_player.x"),
    ("y", "$game_player.y"),
    ("visited", "$PokemonGlobal.visitedMaps"),
    ("challenge_rules", "$PokemonGlobal.challenge_rules"),
    ("challenge_qued", "$PokemonGlobal.challenge_qued"),
    ("challenge_encs", "$PokemonGlobal.challenge_encs"),
    ("challenge_started", "$PokemonGlobal.challenge_started"),
    *((f"flag.{name}", f"$PokemonGlobal.{name}") for name in RANDOM_FLAGS),
    ("random_gens", "$PokemonGlobal.random_gens"),
    ("ability_mode", "RandomizedChallenge.ability_mode"),
    ("ability_switch", f"$game_switches[{ABILITY_SWITCH}]"),
    ("randomizer_rules", "$PokemonGlobal.randomizer_rules"),
    *((f"starter.{id}", f"$game_variables[{id}].species") for id in STARTER_VARIABLES),
    *((f"switch.{id}", f"$game_switches[{id}]") for id in MODE_SWITCHES),
    ("battlestyle", "$PokemonSystem.battlestyle"),
    ("wild_visible", "$PokemonSystem.salvajes_visibles_en_ow"),
    ("rulebook", f'$bag.quantity("{RULEBOOK}")'),
    ("running_shoes", "$player.has_running_shoes"),
    *((f"variable.{id}", f"$game_variables[{id}]") for id in LAB_VARIABLES),
    ("menu_disabled", "$game_system.menu_disabled"),
    ("opacity", "$game_player.opacity"),
    ("tone", "$game_screen.tone"),
    ("mod_version", "$PokemonGlobal.randomlocke_version"),
    ("window_title", "System.window_title"),
    ("discord", "$DiscordRPC"),
    ("no_mega_setting", "Settings::NO_MEGA_EVOLUTION"),
    ("no_mega", f"$game_switches[{NO_MEGA_SWITCH}]"),
    *((f"region_switch.{id}", f"$game_switches[{id}]") for id in STARTER_REGION_SWITCHES),
    ("chosen_starters", f"$game_variables[{CHOSEN_STARTERS_VARIABLE}]"),
    ("save_slot", "$player.save_slot"),
]
FINGERPRINT_PATHS: Paths = [
    ("map", "$game_map.map_id"),
    ("x", "$game_player.x"),
    ("y", "$game_player.y"),
    ("direction", "$game_player.direction"),
    ("money", "$player@money"),
    ("party", "$player@party"),
    ("bag", "$bag@pockets"),
    ("switches", "$game_switches@data"),
    ("variables", "$game_variables@data"),
]
OPTIONS_SOURCE = (
    "k = []; MenuHandlers.each(:options_menu) { |option, _| k << option }; "
    f"k.map(&:to_s) & {list(HIDDEN_OPTIONS)!r}"
)
LOCK_SOURCE = (
    "s = $PokemonSystem; b = s.battlestyle; w = s.salvajes_visibles_en_ow; "
    "s.battlestyle = 0; s.salvajes_visibles_en_ow = 0; "
    "r = [s.battlestyle, s.salvajes_visibles_en_ow]; "
    "s.instance_variable_set(:@battlestyle, b); s.instance_variable_set(:@salvajes_visibles_en_ow, w); r"
)
STARTER_MENU_SOURCE = f"(method(:{STARTER_MENU_METHOD}).source_location || [])[0].to_s"
SAVED_STARTERS_SOURCE = (
    "d = File.open(SaveData.get_full_path($player.save_slot), 'rb') { |f| Marshal.load(f) }; "
    f"{list(STARTER_VARIABLES)!r}.map {{ |i| d[:variables][i].species.to_s }} + "
    f"[d[:switches][{min(STARTER_REGION_SWITCHES)}], d[:player].save_slot]"
)
UPDATER_SOURCE_LOCATIONS = (
    f"{list(UPDATER_METHODS)!r}.map {{ |m| (PokeUpdater.method(m).source_location || [])[0].to_s }}"
)
UPDATER_CALLS = (
    "[PokeUpdater.check_for_updates, PokeUpdater.validate_game_version, "
    "PokeUpdater.validate_game_version_and_update(true)]"
)
EVAL_SOURCE = "[6 * 7, RUBY_VERSION]"
EVAL_ANSWER_PREFIX = "[42, "
EVAL_ERROR_MESSAGE = "anil check eval error"

CHALLENGE_STARTED_MESSAGE = "¡Tu desafío ha comenzado! ¡Buena suerte!"
FIRST_BALL = "POKEBALL"
NICKNAMES_FORCED = 0
CHALLENGE_PATHS: Paths = [
    ("qued", "$PokemonGlobal.challenge_qued"),
    ("started", "$PokemonGlobal.challenge_started"),
    ("toggled", "ChallengeModes@@started"),
    ("rules", "$PokemonGlobal.challenge_rules"),
    ("battlestyle", "$PokemonSystem.battlestyle"),
    ("givenicknames", "$PokemonSystem.givenicknames"),
    ("balls", f'$bag.quantity("{FIRST_BALL}")'),
]
SCRIPT_COMMAND = 355
SCRIPT_SETUP = (
    "$game_system.map_interpreter.setup([RPG::EventCommand.new({code}, 0, [{source!r}]), "
    "RPG::EventCommand.new(0, 0, [])], 0); true"
)
SCRIPT_START_TICKS = 2
SCRIPT_PAYLOAD_TICKS = 120
SCENE_SPRITES = (
    "ObjectSpace.each_object({scene}).map {{ |s| (s.instance_variable_get(:@sprites) || {{}})[{name!r}] }}"
    ".find {{ |x| x && !x.disposed?{visible} }}"
)
WINDOW_SOURCE = "w = " + SCENE_SPRITES + "; w ? [w.text] : []"
WINDOW_WAIT_TICKS = 600
WINDOW_STEP_TICKS = 5
WINDOW_CLOSE_PRESSES = 6
WINDOW_CLOSE_TICKS = 60
MART_CHOOSING = "pbChooseBuyItem"
MART_PAUSED = "pbDisplayPaused"
PRESS_GAP_TICKS = 4
MART_SCENE = "PokemonMart_Scene"
MART_HELP = "helpwindow"
MART_ITEMS = "itemwindow"
MART_ITEM_SOURCE = "w = " + SCENE_SPRITES + "; w ? [w.index, w.item.to_s] : []"
MART_BUY = "Quiero comprar"
MART_LEAVE = "No, gracias"
MART_BANS = {
    "POTION": (
        "HEALING_ITEMS_PURCHASE",
        '¡La regla "Compra de objetos curativos" te impide comprar objetos de curación en las tiendas!',
    ),
    "XATTACK": (
        "BATTLE_ITEMS_PURCHASE",
        '¡La regla "Compra de objetos combate" te impide comprar objetos de combate en las tiendas!',
    ),
    "PROTEIN": (
        "VITAMINS_PURCHASE",
        '¡La regla "Compra de vitaminas" te impide comprar vitaminas en las tiendas!',
    ),
}
MART_STOCK = list(MART_BANS)
MART_SCRIPT = "pbPokemonMart([" + ", ".join(f":{item}" for item in MART_STOCK) + "])"
MART_HOLDINGS: Paths = [
    ("money", "$player.money"),
    *((item, f'$bag.quantity("{item}")') for item in MART_STOCK),
]
PERMAFAINT_RULE = "PERMAFAINT"
TEST_SPECIES = "RATTATA"
TEST_LEVEL = 5
FAINTED = "the fainted Pokémon"
HURT = "the hurt Pokémon"
PARTY_SETUP = (
    f"a = Pokemon.new(:{TEST_SPECIES}, {TEST_LEVEL}); b = Pokemon.new(:{TEST_SPECIES}, {TEST_LEVEL}); "
    "$player.party.push(a, b); a.hp = 0; b.hp = 1; $player.party.length"
)
MEMBER_FIELDS = (
    ("species", ".species"),
    ("name", ".name"),
    ("hp", ".hp"),
    ("totalhp", ".totalhp"),
    ("perma_faint", "@perma_faint"),
    ("fainted", ".fainted?"),
)
REVIVE_ITEMS = ("REVIVE", "MAXREVIVE")
REVIVE_REFUSAL = "No tendría ningún efecto."
REVIVE_COUNTS: Paths = [(item, f'$bag.quantity("{item}")') for item in REVIVE_ITEMS]
REVIVE_GIVE = (
    "[" + ", ".join(f":{item}" for item in REVIVE_ITEMS) + "].each { |i| $bag.add(i) }; true"
)
ITEM_RESULT = "anil_check_item"
ITEM_SCRIPT = (
    "pbFadeOutIn { sc = PokemonParty_Scene.new; scr = PokemonPartyScreen.new(sc, $player.party); "
    'scr.pbStartScene("", false); '
    f"${ITEM_RESULT} = pbUseItemOnPokemon(:ITEM, $player.party[SLOT], scr); scr.pbEndScene }}"
)
PARTY_SCENE = "PokemonParty_Scene"
PARTY_MESSAGE = "messagebox"
CENTER_MAP = 31
CENTER_NURSE = 6
CENTER_TILE = (10, 8)
FACING_UP = 8
TRANSFER_SOURCE = (
    "$game_temp.player_transferring = true; $game_temp.player_new_map_id = {map}; "
    "$game_temp.player_new_x = {x}; $game_temp.player_new_y = {y}; "
    "$game_temp.player_new_direction = {direction}; true"
)
TRANSFER_TICKS = 120
NURSE_ANSWERS = ("Sí",)
BATTLE_PATH = ("battle", "AnilBridge.battle.object_id")
NAMING = "naming"
BATTLE_COMMAND = "battle_command"
BATTLE_BAG = "battle_bag"
COMMAND_INDEX_PATH = ("command", 'AnilBridge.battle.scene@sprites["commandWindow"].index')
COMMAND_COLUMNS = 2
BAG_COMMAND = 1
RUN_COMMAND = 3
COMMAND_PRESSES = 4
BAG_SCENE = "PokemonBag_Scene"
BAG_ITEMS = "itemlist"
BAG_ITEM_SOURCE = "w = " + SCENE_SPRITES + "; w ? [w.pocket, w.index, w.item.to_s] : []"
BAG_POCKET_PRESSES = 10
BAG_ITEM_PRESSES = 20
BAG_COMMANDS_FRAME = "block in pbShowCommands"
DRIVE_STEPS = 300
WILD_SPECIES = TEST_SPECIES
WILD_LEVEL = 2
WILD_TRIES = 50
WILD_VAR = "$anil_check_wild"
GIFT_VAR = "$anil_check_gift"
LEGENDARY_FLAGS = ("Legendary", "Mythical")
LEGENDARY_SPECIES = "MEWTWO"
FRESH_WILD = (
    f"pk = nil; {WILD_TRIES}.times {{ pk = Pokemon.new(:{WILD_SPECIES}, {WILD_LEVEL}); "
    "break unless pk.shiny? || pk.species_data.get_family_species.any? { |s| $player.owned?(s) } || "
    f"{list(LEGENDARY_FLAGS)!r}.any? {{ |f| pk.species_data.has_flag?(f) }} }}; pk"
)
WILD_SCRIPT = f"{WILD_VAR} = ({{wild}}); WildBattle.start({WILD_VAR})"
DUPE_WILD = f"pk = ({FRESH_WILD}); pk.species = {GIFT_VAR}.species; pk"
WILD_SETUPS = {
    "shiny": f"pk = ({FRESH_WILD}); pk.shiny = true; pk",
    "dupes": DUPE_WILD,
    "dead-owner": DUPE_WILD,
    "released-owner": DUPE_WILD,
    "legendary": f"pk = ({FRESH_WILD}); pk.species = :{LEGENDARY_SPECIES}; pk",
}
FOE = "AnilBridge.battle.battlers[1].pokemon"
FOE_PATHS: Paths = [
    ("species", f"{FOE}.species"),
    ("name", f"{FOE}.speciesName"),
    ("shiny", f"{FOE}.shiny?"),
    *((flag, f'{FOE}.species_data.has_flag?("{flag}")') for flag in LEGENDARY_FLAGS),
]
FLEE_ITEM = "SMOKEBALL"
FLEE_SETUP = f"pk = $player.party.find {{ |p| p.able? }}; pk.item = :{FLEE_ITEM}; pk.name"
GIFT_SCRIPT = f"{GIFT_VAR} = Pokemon.new(:{TEST_SPECIES}, {TEST_LEVEL}); pbAddPokemon({GIFT_VAR})"
CLAUSE_RULES = [
    "FIRST_CAPTURE",
    "GIFT_CLAUSE",
    "SHINY_CLAUSE",
    "DUPS_CLAUSE",
    "LEGENDARY_CLAUSE",
    PERMAFAINT_RULE,
]
OWNER_STATE = (
    f"g = {GIFT_VAR}; held = $PokemonStorage.party.any? {{ |p| p.equal?(g) }} || "
    "$PokemonStorage.maxBoxes.times.any? { |b| $PokemonStorage.maxPokemon(b).times.any? "
    "{ |i| $PokemonStorage[b, i].equal?(g) } }; "
    "fam = g.species_data.get_family_species; "
    "all = $PokemonStorage.party + $PokemonStorage.maxBoxes.times.flat_map { |b| "
    "$PokemonStorage.maxPokemon(b).times.map { |i| $PokemonStorage[b, i] } }; "
    "kin = all.count { |p| p && !p.egg? && !p.equal?(g) && fam.include?(p.species) }; "
    "[g.perma_faint == true, held, $player.owned?(g.species), kin]"
)
OWNER_STEPS = {
    "dead-owner": f"{GIFT_VAR}.hp = 0; {GIFT_VAR}.perma_faint",
    "released-owner": (
        f"g = {GIFT_VAR}; at = nil; $PokemonStorage.maxBoxes.times {{ |b| "
        "$PokemonStorage.maxPokemon(b).times { |i| at ||= [b, i] if $PokemonStorage[b, i].equal?(g) } }; "
        "i = $PokemonStorage.party.index { |p| p.equal?(g) }; at = [-1, i] if i; "
        "$PokemonStorage.pbDelete(*at) if at; at"
    ),
}
ENCOUNTER_RULES = ["FIRST_CAPTURE"]
NICKNAME_RULE = "FORCE_NICKNAME"
FIRST_BALL_REFUSAL = (
    '¡La regla "Cláusula Primer Pokémon" te impide atrapar un Pokémon en un mapa '
    "en el que ya tuviste un encuentro!"
)
NICKNAME_REFUSAL = '¡La regla "Motes Obligatorios" hace obligatorio ponerle un mote a tu Pokémon!'
GIFT_NICKNAME = "Lumen"
CATCH_NICKNAME = "Nube"
CATCH_BALL = "MASTERBALL"
CATCH_MAP = BEDROOM_MAP
CATCH_TILE = (29, 10)
FACING_DOWN = 2
NAME_KEY = "RETURN"
FIGHT_COMMAND = 0
BATTLE_FIGHT = "battle_fight"
WIPE_RULES = [PERMAFAINT_RULE]
WIPE_OFF_RULES = ("GAME_OVER_WHITEOUT", "PERMALOCKE")
WIPE_ABILITY = "RUNAWAY"
WIPE_LEAD_MOVE = "EXPLOSION"
WIPE_FOE_MOVE = "TACKLE"
WIPE_FOE_LEVEL = 100
WIPE_MON = (
    "x.species = :{species}; x.ability = :{ability}; x.forget_all_moves; x.learn_move(:{move}); "
    "x.heal; x"
)
WIPE_NEW = f"x = Pokemon.new(:{TEST_SPECIES}, {{level}}); " + WIPE_MON
WIPE_LEAD = WIPE_MON.format(species=TEST_SPECIES, ability=WIPE_ABILITY, move=WIPE_LEAD_MOVE)
WIPE_FOE = WIPE_NEW.format(
    level=WIPE_FOE_LEVEL, species=TEST_SPECIES, ability=WIPE_ABILITY, move=WIPE_FOE_MOVE
)
WIPE_PC = WIPE_NEW.format(
    level=TEST_LEVEL, species=TEST_SPECIES, ability=WIPE_ABILITY, move=WIPE_LEAD_MOVE
)
WIPE_PARTY_SETUP = (
    "x = $player.party.find { |p| p.able? }; "
    f'if !x; raise "party full" if $player.party_full?; x = Pokemon.new(:{TEST_SPECIES}, {TEST_LEVEL}); '
    "$player.party.push(x); end; "
    f"ld = ({WIPE_LEAD}); $player.party.each {{ |p| p.hp = 0 unless p.equal?(ld) }}; ld.hp = 1; "
    "$player.party.index(ld)"
)
PC_NICKNAME = "Reserva"
PC_SETUP = (
    'b = $PokemonStorage.currentBox; raise "box slot taken" if $PokemonStorage[b, 0]; '
    f"pc = ({WIPE_PC}); pc.name = {PC_NICKNAME!r}; $PokemonStorage[b, 0] = pc; b"
)
LIVING_COUNT = "n = 0; pbEachPokemon { |p, _| n += 1 if !p.fainted? && !p.egg? }; n"
PC_SWAP_MESSAGE = (
    "Todos tus Pokémon se han desmayado. Pero aún tienes Pokémon en tu PC con los que "
    "puedes continuar el desafío."
)
LOSS_MESSAGE = (
    "Todos tus Pokémon se han desmayado. ¡Has perdido el desafío! Todos los modificadores "
    "de desafío estarán desactivados."
)
STORAGE_FRAME = "pbSelectBoxInternal"
STORAGE_COMMANDS_SOURCE = (
    "w = ObjectSpace.each_object(Window_CommandPokemon).find { |x| !x.disposed? && x.visible }; "
    "m = ObjectSpace.each_object(Window_UnformattedTextPokemon).find { |x| !x.disposed? && x.visible }; "
    "w ? [w.index, w.commands, m ? m.text : nil] : []"
)
STORAGE_MORE = "¿Desea hacer más operaciones?"
STORAGE_NO = "No"
STORAGE_WITHDRAW = "Sacar"
STORAGE_COMMAND_PRESSES = 10
LOSS = "LOSS"
WIPE_STATE_PATHS: Paths = [
    ("started", "$PokemonGlobal.challenge_started"),
    ("toggled", "ChallengeModes@@started"),
    ("rules", "$PokemonGlobal.challenge_rules"),
    ("state", "$PokemonGlobal.challenge_state"),
    ("hall", "$PokemonGlobal.hallOfFameLastNumber"),
    ("map", "$game_map.map_id"),
    ("center", "$PokemonGlobal.pokecenterMapId"),
]
VICTORY = "VICTORY"
GAME_BEATEN_SWITCH = 249
HALL_STATE_PATHS: Paths = [
    *WIPE_STATE_PATHS,
    ("beaten", f"$game_switches[{GAME_BEATEN_SWITCH}]"),
]
HALL_SNAPSHOT_PREFIX = "check-hall-of-fame-"
HALL_SCRIPT = "pbHallOfFameEntry"
HALL_NO_SLOT = "$player.save_slot = nil; true"
HALL_WAIT_FRAME = "show_gen5_trainer_sequence"
HALL_STEPS = 1200
HALL_PERMAFAINTED = (
    "p = $player.party.find { |x| x.perma_faint }; "
    f"$player.party.push(Pokemon.new(:{TEST_SPECIES}, {TEST_LEVEL})) if !p && $player.party.length < 2; "
    "p ||= $player.party.last; p.hp = 0; $player.party.index(p)"
)
CREDITS_MAP = 211
CREDITS_TILE = (20, 11)
CREDITS_STEPS = 1200
CREDITS_END_MAP = BEDROOM_MAP

LEVEL_CAP_MODE_VARIABLE = 28
LEVEL_CAP_BYPASS_SWITCH = 29
HARD_CAP_MODE = 1
LEVEL_CAP_PATHS: Paths = [
    ("cap_variable", "LevelCapsEX::LEVEL_CAP_VARIABLE"),
    ("mode", f"$game_variables[{LEVEL_CAP_MODE_VARIABLE}]"),
    ("hard_cap", "LevelCapsEX.hard_cap?"),
    ("cap", "LevelCapsEX.level_cap"),
    ("max_level", "GameData::GrowthRate.max_level"),
    ("bypass", f"$game_switches[{LEVEL_CAP_BYPASS_SWITCH}]"),
    ("debug", "$DEBUG"),
    ("badges", "$player.badge_count"),
]
LEVEL_CAP_SNAPSHOT_PREFIX = "check-level-cap-"
CAP_SPECIES = "TAUROS"
CAP_MOVE = "TACKLE"
CAP_FOE_SPECIES = TEST_SPECIES
CAP_FOE_MOVE = "SPLASH"
CAP_CANDY = "RARECANDY"
CAP_CANDY_REFUSAL = "No tendrá ningún efecto."
CAP_ABILITY = "RUNAWAY"
CAP_MON = (
    "x = Pokemon.new(:{species}, {level}); x.species = :{species}; x.level = {level}; "
    f"x.ability = :{CAP_ABILITY}; "
    "x.item = nil; x.forget_all_moves; x.learn_move(:{move}); x.heal; x"
)
CAP_LEAD_SETUP = (
    "x = ({mon}); x.exp = x.growth_rate.minimum_exp_for_level({cap}) - {short}; "
    "$player.party.replace([x]); [x.level, x.exp]"
)
CAP_FOE = "x = ({mon}); x.hp = 1; x"
CAP_MEMBER = (
    "p = $player.party[0]; [p.species.to_s, p.level, p.exp, "
    "p.growth_rate.minimum_exp_for_level({cap})]"
)
CAP_MEMBER_FIELDS = ("species", "level", "exp", "cap_exp")
CAP_OFF = f"$game_variables[{LEVEL_CAP_MODE_VARIABLE}] = 0; LevelCapsEX.hard_cap?"
LEVEL_CAP_SWITCHES = (
    (184, 23),
    (185, 30),
    (186, 39),
    (187, 49),
    (192, 54),
    (196, 59),
    (212, 66),
    (225, 75),
    (249, 100),
)
CAP_SWITCH_ON = (
    "$game_switches[{switch}] = true; [LevelCapsEX.level_cap, GameData::GrowthRate.max_level, "
    "$game_variables[LevelCapsEX::LEVEL_CAP_VARIABLE], Pokemon.new(:{species}, 100).level]"
)
CAP_SWITCH_FIELDS = "level_cap, max_level, cap variable, Pokemon.new level 100"
CAP_SWITCHES_OFF = "{switches}.each {{ |s| $game_switches[s] = false }}; LevelCapsEX.level_cap"
CAP_BYPASS = (
    f"$game_switches[{LEVEL_CAP_BYPASS_SWITCH}] = {{on}}; "
    f"[$game_switches[{LEVEL_CAP_BYPASS_SWITCH}], LevelCapsEX.hard_cap?, LevelCapsEX.level_cap, "
    "GameData::GrowthRate.max_level]"
)
CAP_CODE_LEVELS = (
    "x = Pokemon.new(:{species}, {high}); y = Pokemon.new(:{species}, 5); y.level = {higher}; "
    "[x.level, y.level]"
)
CAP_CODE_HIGH = 16
CAP_CODE_HIGHER = 36
CAP_TRAINERS = """
st = $PokemonGlobal.random_trainer_teams || {}
ks = GameData::Trainer.keys.select { |k| d = GameData::Trainer.get(*k); !st.key?(d.id) && d.pokemon.any? { |p| p[:level] > CAP } }.first(COUNT)
ks.map { |k| [k.map(&:to_s).join(" "), GameData::Trainer.get(*k).pokemon.map { |p| p[:level] }, pbLoadTrainer(*k).party.map(&:level)] }
"""
CAP_TRAINER_COUNT = 3
CAP_BYPASS_LABEL = f"switch {LEVEL_CAP_BYPASS_SWITCH} on: "
LEVEL_UP_FRAME = "pbTopRightWindow"
LEVEL_UP_WINDOWS = 4
CAP_EXP_MESSAGE = "puntos de experiencia"

type Reporter = Callable[[str], None]


class CheckError(Exception):
    pass


@dataclass
class CheckResult:
    name: str
    passed: bool = True
    evidence: list[str] = field(default_factory=list)

    def expect(self, label: str, actual: Any, expected: Any) -> bool:
        ok = actual == expected
        line = f"{label}: {actual!r}" if ok else f"{label}: {actual!r}, expected {expected!r}"
        return self.mark(ok, line)

    def mark(self, ok: bool, line: str) -> bool:
        self.evidence.append(f"{'ok ' if ok else 'BAD'} {line}")
        self.passed = self.passed and ok
        return ok

    def note(self, line: str) -> None:
        self.evidence.append(f"    {line}")


def plain(raw: Any) -> Any:
    if isinstance(raw, list):
        return [plain(item) for item in raw]
    if isinstance(raw, dict) and raw.get("class") == "Hash" and "entries" in raw:
        return {plain(key): plain(value) for key, value in raw["entries"]}
    return raw


def read_values(
    session: Session, paths: Paths
) -> tuple[Answer[ReadResult], dict[str, Any], dict[str, str]]:
    answer = session.read(ReadRequest(paths=paths, depth=READ_DEPTH))
    values = {name: plain(value) for name, value in answer.value.values.items()}
    return answer, values, answer.value.errors


def eval_inspect(session: Session, source: str) -> str:
    return session.eval(source).value.inspect


def bridge_log_lines(session_dir: Path) -> list[str]:
    path = session_dir / BRIDGE_LOG
    if not path.is_file():
        return []
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


@dataclass
class Live:
    settings: Settings
    driver: Driver
    launch: SessionLaunch
    started: float
    values: dict[str, Any] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    context: str | None = None

    @property
    def session(self) -> Session:
        return self.driver.session

    def read_new_game(self) -> None:
        answer, self.values, self.errors = read_values(self.session, NEW_GAME_PATHS)
        running = bool(self.values.get(INTERPRETER_RUNNING[0]))
        self.context = classify(answer.caller, answer.payloads, running).name

    def value(self, result: CheckResult, name: str) -> Any:
        if name in self.errors:
            result.mark(False, f"{name}: read failed: {self.errors[name]}")
        return self.values.get(name)


def check_overworld(live: Live, result: CheckResult) -> None:
    result.expect("scene", live.value(result, "scene"), "Scene_Map")
    result.expect("context", live.context, OVERWORLD)
    result.expect("message open", live.value(result, "message"), False)
    result.expect("map", live.value(result, "map"), BEDROOM_MAP)
    result.note(f"position ({live.value(result, 'x')}, {live.value(result, 'y')})")
    visited = live.value(result, "visited") or []
    for map_id in SKIPPED_MAPS:
        entered = map_id < len(visited) and bool(visited[map_id])
        result.expect(f"map {map_id} entered", entered, False)


def check_challenge(live: Live, result: CheckResult) -> None:
    rules = live.value(result, "challenge_rules") or []
    result.expect("challenge rules", sorted(rules), sorted(CHALLENGE_RULES))
    result.expect("rule count", len(rules), len(CHALLENGE_RULES))
    result.expect("challenge queued", live.value(result, "challenge_qued"), True)
    result.expect("challenge encounters", live.value(result, "challenge_encs"), {})
    result.expect("challenge started", live.value(result, "challenge_started"), None)


def check_randomizer(live: Live, result: CheckResult) -> None:
    for name, expected in RANDOM_FLAGS.items():
        result.expect(name, live.value(result, f"flag.{name}"), expected)
    result.expect("random_gens", live.value(result, "random_gens"), RANDOM_GENS)
    result.expect("ability mode", live.value(result, "ability_mode"), ABILITY_MODE)
    result.expect(f"switch {ABILITY_SWITCH}", live.value(result, "ability_switch"), True)
    result.expect("randomizer_rules", live.value(result, "randomizer_rules"), RANDOMIZER_RULES)
    for id in STARTER_VARIABLES:
        species = live.value(result, f"starter.{id}")
        result.mark(isinstance(species, str), f"variable {id} starter: {species!r}")


def check_completo(live: Live, result: CheckResult) -> None:
    for id, expected in MODE_SWITCHES.items():
        result.expect(f"switch {id}", live.value(result, f"switch.{id}"), expected)


def hidden_options(live: Live) -> list[str]:
    return json.loads(eval_inspect(live.session, OPTIONS_SOURCE))


def check_locked_option(live: Live, result: CheckResult, name: str, index: int) -> None:
    option = HIDDEN_OPTIONS[index]
    expected = SET_STYLE if index == 0 else WILD_HIDDEN
    result.expect(name, live.value(result, name), expected)
    after_setter = json.loads(eval_inspect(live.session, LOCK_SOURCE))
    result.expect(f"{name} after setting 0", after_setter[index], expected)
    result.expect(f"options menu lists {option}", option in hidden_options(live), False)


def check_set_style(live: Live, result: CheckResult) -> None:
    check_locked_option(live, result, "battlestyle", 0)


def check_wild_hidden(live: Live, result: CheckResult) -> None:
    check_locked_option(live, result, "wild_visible", 1)


def check_rulebook(live: Live, result: CheckResult) -> None:
    result.expect(f"{RULEBOOK} in the bag", live.value(result, "rulebook"), 1)


def check_intro(live: Live, result: CheckResult) -> None:
    result.expect("running shoes", live.value(result, "running_shoes"), True)
    for id, expected in LAB_VARIABLES.items():
        result.expect(f"variable {id}", live.value(result, f"variable.{id}"), expected)
    result.expect("menu disabled", live.value(result, "menu_disabled"), False)
    result.expect("player opacity", live.value(result, "opacity"), PLAYER_OPACITY)
    tone = live.value(result, "tone") or {}
    result.expect("screen tone", tone.get("inspect"), CLEAR_TONE)


def check_mark(live: Live, result: CheckResult) -> None:
    result.expect("randomlocke_version", live.value(result, "mod_version"), MOD_VERSION)
    result.expect("window title", live.value(result, "window_title"), WINDOW_TITLE)
    lines = bridge_log_lines(live.session.session_dir)
    for wanted in MOD_LOG_LINES:
        result.mark(any(wanted in line for line in lines), f"bridge.log has {wanted!r}")
    setup = next((line for line in lines if NEW_GAME_LOG_LINE in line), None)
    if live.launch.snapshot is None:
        result.mark(setup is not None, f"bridge.log has {NEW_GAME_LOG_LINE!r}")
    else:
        result.note(f"booted into snapshot {live.launch.snapshot.name}; the setup ran before it")


def check_no_mega(live: Live, result: CheckResult) -> None:
    result.expect(
        "Settings::NO_MEGA_EVOLUTION", live.value(result, "no_mega_setting"), NO_MEGA_SWITCH
    )
    result.expect(f"switch {NO_MEGA_SWITCH}", live.value(result, "no_mega"), True)


def setup_log_line(live: Live, result: CheckResult, wanted: str) -> None:
    if live.launch.snapshot is not None:
        result.note(f"booted into snapshot {live.launch.snapshot.name}; the new game ran before it")
        return
    lines = bridge_log_lines(live.session.session_dir)
    result.mark(any(wanted in line for line in lines), f"bridge.log has {wanted!r}")


def check_starter_region(live: Live, result: CheckResult) -> None:
    for id, expected in STARTER_REGION_SWITCHES.items():
        result.expect(f"switch {id}", bool(live.value(result, f"region_switch.{id}")), expected)
    result.expect(
        f"variable {CHOSEN_STARTERS_VARIABLE}",
        live.value(result, "chosen_starters"),
        CHOSEN_STARTERS,
    )
    source = json.loads(eval_inspect(live.session, STARTER_MENU_SOURCE))
    result.mark(source.endswith(MOD_SOURCE), f"{STARTER_MENU_METHOD} defined in {source!r}")
    setup_log_line(live, result, STARTER_REGION_LOG_LINE)


def check_new_game_save(live: Live, result: CheckResult) -> None:
    slot = live.value(result, "save_slot")
    result.mark(
        isinstance(slot, str) and MANUAL_SLOT_PATTERN.fullmatch(slot) is not None,
        f"$player.save_slot: {slot!r}",
    )
    if not isinstance(slot, str):
        return
    setup_log_line(live, result, NEW_GAME_SAVE_LOG_LINE.format(slot=slot))
    if live.launch.snapshot is not None:
        return
    save_dir = live.settings.saves / live.launch.save
    written = save_dir / f"{slot}{SAVE_FILE_SUFFIX}"
    result.mark(written.is_file(), f"{written} exists")
    *saved, region_switch, saved_slot = json.loads(
        eval_inspect(live.session, SAVED_STARTERS_SOURCE)
    )
    live_starters = [live.value(result, f"starter.{id}") for id in STARTER_VARIABLES]
    result.expect("starters in the save", saved, live_starters)
    result.expect(f"switch {min(STARTER_REGION_SWITCHES)} in the save", region_switch, True)
    result.expect("slot in the save", saved_slot, slot)
    for path in files_under(save_dir):
        if path.suffix != SAVE_FILE_SUFFIX or path == written:
            continue
        mtime = path.stat().st_mtime
        result.mark(mtime < live.started, f"{path.name} untouched since the session started")


def check_updater(live: Live, result: CheckResult) -> None:
    sources = json.loads(eval_inspect(live.session, UPDATER_SOURCE_LOCATIONS))
    replaced = all(source.endswith(MOD_SOURCE) for source in sources)
    for method, source in zip(UPDATER_METHODS, sources, strict=True):
        result.mark(source.endswith(MOD_SOURCE), f"PokeUpdater.{method} defined in {source!r}")
    if not replaced:
        result.note("the updater methods were not called, since one is not the mod's")
        return
    before = len(bridge_log_lines(live.session.session_dir))
    result.expect("updater answers", eval_inspect(live.session, UPDATER_CALLS), "[nil, nil, nil]")
    added = bridge_log_lines(live.session.session_dir)[before:]
    for method in UPDATER_METHODS:
        wanted = f"updater call {method} skipped"
        result.mark(any(wanted in line for line in added), f"bridge.log has {wanted!r}")


def check_discord(live: Live, result: CheckResult) -> None:
    discord = live.value(result, "discord") or {}
    result.expect("$DiscordRPC class", discord.get("class"), "DiscordAPI")
    result.expect("$DiscordRPC ivars", sorted(discord.get("ivars") or {}), DISCORD_IVARS)


def check_launch(live: Live, result: CheckResult) -> None:
    lock = read_lock(live.settings.lock_file)
    if not result.mark(lock is not None, f"lock {live.settings.lock_file}") or lock is None:
        return
    result.expect("lock session", lock.session, live.session.session)
    pid = lock.game_pid
    result.expect(
        f"image of game pid {pid}", windows_process_image(pid) if pid else None, GAME_IMAGE
    )
    launch = live.launch
    result.note(
        f"launch.json: build {launch.build}, save {launch.save}, seed {launch.seed}, "
        f"clock {launch.clock}, snapshot {launch.snapshot.name if launch.snapshot else None}"
    )
    stamp = read_stamp(game_dir(live.settings))
    deployed = stamp.bridge_hash if stamp else None
    result.expect("deployed bridge", deployed, launch.stamp.bridge_hash)
    harness_log = live.session.session_dir / HARNESS_LOG
    lines = harness_log.read_text(encoding="utf-8").splitlines() if harness_log.is_file() else []
    handshake = next((line for line in lines if HANDSHAKE_LOG_LINE in line), None)
    result.mark(handshake is not None, f"harness.log: {handshake}")


def check_handshake(live: Live, result: CheckResult) -> None:
    lock = read_lock(live.settings.lock_file)
    try:
        with BridgeClient.connect(
            live.settings.bridge_port, name=HANDSHAKE_CLIENT_NAME, timeout=HANDSHAKE_TIMEOUT_SECONDS
        ) as client:
            handshake = client.hello()
    except BridgeError as error:
        result.mark(False, f"hello on port {live.settings.bridge_port}: {error}")
        return
    result.expect("session", handshake.session, live.session.session)
    result.expect("pid", handshake.pid, lock.game_pid if lock else None)
    result.expect("protocol", handshake.protocol, PROTOCOL_VERSION)
    result.expect("bridge hash", handshake.bridge_hash, bridge_hash())
    result.expect("build", handshake.build, live.launch.build)
    result.note(f"tick {handshake.tick}, event_seq {handshake.event_seq}")


def check_eval(live: Live, result: CheckResult) -> None:
    answer = live.session.eval(EVAL_SOURCE)
    result.mark(
        answer.value.class_name == "Array" and answer.value.inspect.startswith(EVAL_ANSWER_PREFIX),
        f"{EVAL_SOURCE} at tick {answer.tick}: {answer.value.inspect}",
    )
    failed = live.session.client.request("eval", source=f"raise {EVAL_ERROR_MESSAGE!r}")
    result.mark(
        not failed.ok and EVAL_ERROR_MESSAGE in (failed.error or ""),
        f"a raising eval answers ok={failed.ok}: {failed.error}",
    )
    after = live.session.eval(EVAL_SOURCE)
    result.expect("the next eval", after.value.inspect, answer.value.inspect)


def appdata_save_folder() -> Path:
    appdata = run_windows("cmd.exe", "/c", "echo %APPDATA%")
    if not appdata or "%" in appdata:
        raise CheckError("cmd.exe did not resolve %APPDATA%")
    return to_linux(PureWindowsPath(appdata) / ANIL_SAVE_FOLDER)


def files_under(folder: Path) -> list[Path]:
    return [path for path in folder.rglob("*") if path.is_file()] if folder.is_dir() else []


def check_saves(live: Live, result: CheckResult) -> None:
    save_dir = live.settings.saves / live.launch.save
    expected = to_unc(save_dir) + "\\"
    paths: Paths = [
        ("data_directory", "System.data_directory"),
        ("save_dir", "SaveData::SAVE_DIR"),
        ("file_path", "SaveData::FILE_PATH"),
    ]
    _, values, errors = read_values(live.session, paths)
    for name, error in errors.items():
        result.mark(False, f"{name}: read failed: {error}")
    result.expect("System.data_directory", values.get("data_directory"), expected)
    result.expect("SaveData::SAVE_DIR", values.get("save_dir"), expected)
    result.expect("SaveData::FILE_PATH", values.get("file_path"), expected + SAVE_FILE_PATH_NAME)
    saved_at = time.time()
    answer = eval_inspect(live.session, f"Game.save({GAME_SAVE_SLOT!r})")
    result.expect(f"Game.save({GAME_SAVE_SLOT!r})", answer, "true")
    written = save_dir / f"{GAME_SAVE_SLOT}{SAVE_FILE_SUFFIX}"
    fresh = written.is_file() and written.stat().st_mtime >= saved_at - 2
    size = written.stat().st_size if written.is_file() else None
    result.mark(fresh, f"{written} written by this save ({size} bytes)")
    folder = appdata_save_folder()
    found = files_under(folder)
    new = [path for path in found if path.stat().st_mtime >= live.started]
    result.mark(
        not new,
        f"{folder}: {'exists' if folder.is_dir() else 'absent'}, {len(found)} files, "
        f"{len(new)} written since the session started",
    )
    for path in new:
        result.note(f"written there: {path}")


def check_snapshot(live: Live, result: CheckResult) -> None:
    session = live.session
    name = f"{SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    taken = save_snapshot(session, name)
    result.note(
        f"saved {name} at tick {taken.value.tick} (seed {taken.value.seed}, hash {taken.value.hash})"
    )
    before = session.rng()
    _, saved, _ = read_values(session, FINGERPRINT_PATHS)
    money = eval_inspect(session, SNAPSHOT_MUTATION)
    live.driver.advance(SNAPSHOT_WAIT_TICKS)
    _, changed, _ = read_values(session, FINGERPRINT_PATHS)
    differs = sorted(key for key in saved if saved[key] != changed.get(key))
    result.mark(bool(differs), f"after the change (money {money}) these differ: {differs}")
    restored = restore_snapshot(session, name)
    after = session.rng()
    _, back, _ = read_values(session, FINGERPRINT_PATHS)
    result.expect("restored snapshot tick", restored.value.tick, taken.value.tick)
    result.expect("tick after the restore", after.tick, before.tick)
    result.expect("rng calls after the restore", after.value.calls, before.value.calls)
    still = sorted(key for key in saved if saved[key] != back.get(key))
    result.expect("fields differing from the saved state", still, [])


def check_replay(settings: Settings, session: str, result: CheckResult, report: Reporter) -> str:
    result.note(stop(settings))
    try:
        outcome = replay(settings, session, keep=True, report=report)
    except (ReplayError, LaunchError, *LIVE_ERRORS) as error:
        result.mark(False, f"replay of {session}: {error}")
        return session
    result.mark(
        True,
        f"session {outcome.session} replayed {session} over ticks {outcome.first_tick}-"
        f"{outcome.last_tick} with no digest mismatch ({outcome.advances} advances, "
        f"{outcome.evals} evals, {outcome.restores} restores)",
    )
    result.note(f"the replayed game {outcome.session} is left running")
    return outcome.session


def eval_json(live: Live, source: str) -> Any:
    return json.loads(eval_inspect(live.session, source))


def read_checked(live: Live, result: CheckResult, paths: Paths) -> dict[str, Any]:
    _, values, errors = read_values(live.session, paths)
    for name, error in errors.items():
        result.mark(False, f"{name}: read failed: {error}")
    return values


def run_script(live: Live, source: str, *, until_payload: bool = False) -> None:
    eval_inspect(live.session, SCRIPT_SETUP.format(code=SCRIPT_COMMAND, source=source))
    live.driver.advance(SCRIPT_START_TICKS)
    if until_payload:
        live.driver.advance(SCRIPT_PAYLOAD_TICKS, until=["payloads"])


def line_text(line: Line) -> str:
    return line.text if isinstance(line, MessageLine) else f"{line.prompt} -> {line.answer}"


def note_transcript(result: CheckResult, transcript: list[Line]) -> None:
    for line in transcript:
        result.note(f"tick {line.tick} {line.kind}: {line_text(line)}")


def drive_dialog(live: Live, result: CheckResult, answers: list[str]) -> DialogResult:
    outcome = continue_dialog(live.driver, answers)
    note_transcript(result, outcome.transcript)
    result.note(f"dialog {outcome.outcome} in {outcome.context.name} at tick {outcome.tick}")
    return outcome


def window_shown(live: Live, scene: str, name: str) -> list[Any]:
    return eval_json(live, WINDOW_SOURCE.format(scene=scene, name=name, visible=" && x.visible"))


def window_text(live: Live, scene: str, name: str) -> str | None:
    for _ in range(WINDOW_WAIT_TICKS // WINDOW_STEP_TICKS):
        shown = window_shown(live, scene, name)
        if shown:
            return shown[0]
        live.driver.advance(WINDOW_STEP_TICKS)
    return None


def close_window(live: Live, scene: str, name: str) -> bool:
    for _ in range(WINDOW_CLOSE_PRESSES):
        live.driver.advance(1, [buttons(CONFIRM)])
        for _ in range(WINDOW_CLOSE_TICKS // WINDOW_STEP_TICKS):
            live.driver.advance(WINDOW_STEP_TICKS)
            if not window_shown(live, scene, name):
                return True
    return False


def wait_frame(live: Live, wanted: str, unwanted: str | None = None) -> bool:
    for _ in range(WINDOW_WAIT_TICKS // WINDOW_STEP_TICKS):
        frames = live.session.stack().value.frames
        if any(wanted in frame for frame in frames) and not any(
            unwanted is not None and unwanted in frame for frame in frames
        ):
            return True
        live.driver.advance(WINDOW_STEP_TICKS)
    return False


def wait_script_done(live: Live) -> bool:
    for _ in range(WINDOW_WAIT_TICKS // WINDOW_STEP_TICKS):
        _, values, _ = read_values(live.session, [INTERPRETER_RUNNING])
        if not values.get(INTERPRETER_RUNNING[0]):
            return True
        live.driver.advance(WINDOW_STEP_TICKS)
    return False


def read_challenge(live: Live, result: CheckResult) -> dict[str, Any]:
    return read_checked(live, result, CHALLENGE_PATHS)


def challenge_on(live: Live, result: CheckResult, rules: list[str]) -> bool:
    state = read_challenge(live, result)
    on = bool(state.get("started")) and bool(state.get("toggled"))
    result.expect("challenge on", on, True)
    active = state.get("rules") or []
    for rule in rules:
        result.expect(f"rule {rule} on", rule in active, True)
    return on and all(rule in active for rule in rules)


def check_challenge_start(live: Live, result: CheckResult) -> None:
    state = read_challenge(live, result)
    result.note(
        f"before: queued {state.get('qued')}, started {state.get('started')}, "
        f"{state.get('balls')} {FIRST_BALL}"
    )
    if not result.expect("challenge queued before the first ball", state.get("qued"), True):
        return
    result.expect(f"{FIRST_BALL} held before", state.get("balls"), 0)
    run_script(live, f"$bag.add(:{FIRST_BALL})", until_payload=True)
    outcome = drive_dialog(live, result, [])
    texts = [line_text(line) for line in outcome.transcript]
    result.mark(CHALLENGE_STARTED_MESSAGE in texts, f"message {CHALLENGE_STARTED_MESSAGE!r} shown")
    result.expect("dialog outcome", outcome.outcome, "finished")
    state = read_challenge(live, result)
    result.expect("challenge queued after", state.get("qued"), False)
    result.expect("challenge started after", state.get("started"), True)
    result.expect("ChallengeModes@@started", state.get("toggled"), True)
    result.expect("battlestyle", state.get("battlestyle"), SET_STYLE)
    result.expect("givenicknames", state.get("givenicknames"), NICKNAMES_FORCED)
    result.expect(f"{FIRST_BALL} held after", state.get("balls"), 1)


def mart_item(live: Live) -> str | None:
    shown = eval_json(live, MART_ITEM_SOURCE.format(scene=MART_SCENE, name=MART_ITEMS, visible=""))
    return shown[1] if shown else None


def wait_mart_item(live: Live) -> str | None:
    for _ in range(WINDOW_WAIT_TICKS // WINDOW_STEP_TICKS):
        item = mart_item(live)
        if item is not None:
            return item
        live.driver.advance(WINDOW_STEP_TICKS)
    return None


def check_mart_bans(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, [rule for rule, _ in MART_BANS.values()]):
        return
    before = read_checked(live, result, MART_HOLDINGS)
    result.note(f"held before: {before}")
    run_script(live, MART_SCRIPT, until_payload=True)
    opened = drive_dialog(live, result, [MART_BUY])
    if not result.expect("dialog outcome on choosing to buy", opened.outcome, "handoff"):
        return
    for index, item in enumerate(MART_STOCK):
        if index:
            wait_frame(live, MART_CHOOSING, MART_PAUSED)
            live.driver.advance(1, [buttons("DOWN")])
            live.driver.advance(PRESS_GAP_TICKS)
        if not result.expect(f"mart cursor {index}", wait_mart_item(live), item):
            return
        if not result.mark(
            wait_frame(live, MART_CHOOSING, MART_PAUSED), f"{MART_CHOOSING} waiting"
        ):
            return
        live.driver.advance(1, [buttons(CONFIRM)])
        rule, message = MART_BANS[item]
        result.expect(f"{item} refused ({rule})", window_text(live, MART_SCENE, MART_HELP), message)
        result.mark(close_window(live, MART_SCENE, MART_HELP), f"{item} refusal closed")
        result.expect(f"mart cursor after {item}", mart_item(live), item)
    result.expect("held after", read_checked(live, result, MART_HOLDINGS), before)
    wait_frame(live, MART_CHOOSING, MART_PAUSED)
    live.driver.advance(1, [buttons("B")])
    live.driver.advance(PRESS_GAP_TICKS)
    left = drive_dialog(live, result, [MART_LEAVE])
    result.expect("dialog outcome on leaving", left.outcome, "finished")


def transfer(live: Live, map_id: int, tile: tuple[int, int], direction: int) -> None:
    x, y = tile
    eval_inspect(live.session, TRANSFER_SOURCE.format(map=map_id, x=x, y=y, direction=direction))
    live.driver.advance(TRANSFER_TICKS)


def read_member(live: Live, result: CheckResult, slot: int, label: str) -> dict[str, Any]:
    paths: Paths = [(name, f"$player.party[{slot}]{suffix}") for name, suffix in MEMBER_FIELDS]
    member = read_checked(live, result, paths)
    result.note(
        f"{label}: {member.get('species')} {member.get('hp')}/{member.get('totalhp')}, "
        f"@perma_faint {member.get('perma_faint')}, fainted? {member.get('fainted')}"
    )
    return member


def check_permafaint(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, [PERMAFAINT_RULE]):
        return
    size = int(eval_inspect(live.session, PARTY_SETUP))
    fainted_slot, hurt_slot = size - 2, size - 1
    fainted = read_member(live, result, fainted_slot, f"{FAINTED}, HP set to 0")
    hurt = read_member(live, result, hurt_slot, f"{HURT}, HP set to 1")
    result.expect(f"{FAINTED} @perma_faint", fainted.get("perma_faint"), True)
    result.expect(f"{FAINTED} fainted?", fainted.get("fainted"), True)
    result.expect(f"{HURT} HP", hurt.get("hp"), 1)
    eval_inspect(live.session, REVIVE_GIVE)
    given = read_checked(live, result, REVIVE_COUNTS)
    result.note(f"held: {given}")
    for item in REVIVE_ITEMS:
        script = ITEM_SCRIPT.replace("SLOT", str(fainted_slot)).replace("ITEM", item)
        run_script(live, script)
        text = window_text(live, PARTY_SCENE, PARTY_MESSAGE)
        result.expect(f"{item} on {FAINTED}", text, REVIVE_REFUSAL)
        result.mark(close_window(live, PARTY_SCENE, PARTY_MESSAGE), f"{item} message closed")
        result.mark(wait_script_done(live), f"{item} party screen closed")
        used = read_checked(live, result, [("used", f"${ITEM_RESULT}")]).get("used")
        result.expect(f"pbUseItemOnPokemon({item})", used, False)
    result.expect("held after", read_checked(live, result, REVIVE_COUNTS), given)
    after = read_member(live, result, fainted_slot, f"{FAINTED} after the items")
    result.expect(f"{FAINTED} HP after the items", after.get("hp"), 0)
    transfer(live, CENTER_MAP, CENTER_TILE, FACING_UP)
    with closing(open_world(BUILDS[live.launch.build], live.settings)) as connection:
        healed = interact(live.driver, connection, CENTER_MAP, CENTER_NURSE, list(NURSE_ANSWERS))
    note_transcript(result, healed.transcript)
    result.note(f"nurse dialog {healed.outcome}: {healed.reason}")
    result.expect("nurse dialog outcome", healed.outcome, "finished")
    fainted = read_member(live, result, fainted_slot, f"{FAINTED} after the nurse")
    hurt = read_member(live, result, hurt_slot, f"{HURT} after the nurse")
    result.expect(f"{FAINTED} HP after the nurse", fainted.get("hp"), 0)
    result.expect(f"{FAINTED} @perma_faint after the nurse", fainted.get("perma_faint"), True)
    result.expect(f"{HURT} healed by the nurse", hurt.get("hp"), hurt.get("totalhp"))


@dataclass(frozen=True)
class Spot:
    map_id: int
    tile: tuple[int, int]
    direction: int


CENTER_SPOT = Spot(CENTER_MAP, CENTER_TILE, FACING_UP)
CATCH_SPOT = Spot(CATCH_MAP, CATCH_TILE, FACING_DOWN)


@dataclass
class Look:
    context: Context
    battle: bool

    @property
    def idle(self) -> bool:
        return self.context.name == OVERWORLD and not self.battle

    @property
    def naming(self) -> bool:
        return self.context.screen == NAMING and any(
            payload.get("kind") == NAMING for payload in self.context.payloads
        )

    def message(self) -> dict[str, Any] | None:
        shown = [payload for payload in self.context.payloads if payload.get("kind") == "message"]
        if not shown:
            return None
        if self.context.name == "message" or (self.context.screen == NAMING and not self.naming):
            return shown[-1]
        return None


type Done = Callable[[Look, list[str]], bool]


def look(live: Live) -> Look:
    answer, values, _ = read_values(live.session, [INTERPRETER_RUNNING, BATTLE_PATH])
    running = bool(values.get(INTERPRETER_RUNNING[0]))
    context = classify(answer.caller, answer.payloads, running)
    return Look(context, values.get(BATTLE_PATH[0]) is not None)


def press(live: Live, button: str) -> None:
    live.driver.advance(1, [buttons(button)])
    live.driver.advance(PRESS_GAP_TICKS)


def drive_to(
    live: Live, result: CheckResult, done: Done, steps: int = DRIVE_STEPS
) -> tuple[Look | None, list[str]]:
    texts: list[str] = []
    seen: set[int] = set()
    for _ in range(steps):
        now = look(live)
        if done(now, texts):
            return now, texts
        message = now.message()
        if message is None:
            live.driver.advance(WINDOW_STEP_TICKS)
            continue
        if message["tick"] not in seen:
            seen.add(message["tick"])
            texts.append(message["text"])
            result.note(f"tick {message['tick']} message: {message['text']}")
        press(live, CONFIRM)
    return None, texts


def reached(
    live: Live, result: CheckResult, done: Done, label: str, steps: int = DRIVE_STEPS
) -> list[str] | None:
    now, texts = drive_to(live, result, done, steps)
    if not result.mark(now is not None, label):
        return None
    return texts


def at_command(now: Look, _: list[str]) -> bool:
    return now.context.name == BATTLE_COMMAND


def at_naming(now: Look, _: list[str]) -> bool:
    return now.naming


def left_naming(now: Look, _: list[str]) -> bool:
    return not now.naming


def at_idle(now: Look, _: list[str]) -> bool:
    return now.idle


def choose_command(live: Live, result: CheckResult, target: int) -> bool:
    for _ in range(COMMAND_PRESSES):
        index = read_checked(live, result, [COMMAND_INDEX_PATH]).get(COMMAND_INDEX_PATH[0])
        if not isinstance(index, int):
            return False
        if index == target:
            press(live, CONFIRM)
            return True
        row, column = divmod(index, COMMAND_COLUMNS)
        target_row, target_column = divmod(target, COMMAND_COLUMNS)
        if row != target_row:
            press(live, "DOWN" if row < target_row else "UP")
        else:
            press(live, "RIGHT" if column < target_column else "LEFT")
    return False


def marked(live: Live, result: CheckResult, map_id: int) -> Any:
    path = ("marked", f"$PokemonGlobal.challenge_encs[{map_id}]")
    return read_checked(live, result, [path]).get("marked")


def ball_count(live: Live, result: CheckResult, ball: str) -> Any:
    return read_checked(live, result, [("balls", f'$bag.quantity("{ball}")')]).get("balls")


def start_wild(live: Live, result: CheckResult, wild: str) -> dict[str, Any] | None:
    run_script(live, WILD_SCRIPT.format(wild=wild))
    if reached(live, result, at_command, "wild battle at its command menu") is None:
        return None
    foe = read_checked(live, result, FOE_PATHS)
    result.note(
        f"wild {foe.get('species')}, shiny {foe.get('shiny')}, "
        + ", ".join(f"{flag} {foe.get(flag)}" for flag in LEGENDARY_FLAGS)
    )
    return foe


def flee(live: Live, result: CheckResult) -> bool:
    if not result.mark(choose_command(live, result, RUN_COMMAND), "chose Huir"):
        return False
    return reached(live, result, at_idle, "fled back to the overworld") is not None


def bag_item(live: Live) -> list[Any]:
    return eval_json(live, BAG_ITEM_SOURCE.format(scene=BAG_SCENE, name=BAG_ITEMS, visible=""))


def choose_ball(live: Live, result: CheckResult, ball: str) -> bool:
    if not result.mark(choose_command(live, result, BAG_COMMAND), "chose Mochila"):
        return False
    in_bag = reached(
        live, result, lambda now, _: now.context.name == BATTLE_BAG and bool(bag_item(live)), "bag"
    )
    if in_bag is None:
        return False
    pocket = read_checked(live, result, [("pocket", f'GameData::Item.get("{ball}").pocket')])
    for _ in range(BAG_POCKET_PRESSES):
        if bag_item(live)[0] == pocket.get("pocket"):
            break
        press(live, "RIGHT")
    for _ in range(BAG_ITEM_PRESSES):
        if bag_item(live)[2] == ball:
            break
        press(live, "DOWN")
    if not result.expect("bag item chosen", bag_item(live)[2], ball):
        return False
    press(live, CONFIRM)
    if not result.mark(wait_frame(live, BAG_COMMANDS_FRAME), f"{ball} commands shown"):
        return False
    press(live, CONFIRM)
    return True


def enter_name(live: Live, name: str) -> None:
    live.driver.type_text(name)
    live.driver.advance(1, [keys(NAME_KEY)])
    live.driver.advance(1)


def force_nickname(live: Live, result: CheckResult, label: str, species: str, name: str) -> bool:
    result.note(f"{label}: typed {species!r}")
    enter_name(live, species)
    if reached(live, result, left_naming, f"{label}: the name screen closed") is None:
        return False
    texts = reached(live, result, at_naming, f"{label}: the name screen came back")
    if texts is None:
        return False
    result.mark(
        NICKNAME_REFUSAL in texts, f"{label}: {species!r} refused with {NICKNAME_REFUSAL!r}"
    )
    result.note(f"{label}: typed {name!r}")
    enter_name(live, name)
    return reached(live, result, left_naming, f"{label}: the name screen closed") is not None


def encounter_map_unmarked(live: Live, result: CheckResult, spot: Spot) -> bool:
    transfer(live, spot.map_id, spot.tile, spot.direction)
    here = read_checked(live, result, [("map", "$game_map.map_id")]).get("map")
    result.expect("map", here, spot.map_id)
    return result.expect(
        f"map {spot.map_id} marked before", marked(live, result, spot.map_id), None
    )


def owner_step(live: Live, result: CheckResult, clause: str) -> bool:
    result.note(f"{clause}: {eval_inspect(live.session, OWNER_STEPS[clause])}")
    perma_faint, held, owned, kin = eval_json(live, OWNER_STATE)
    result.expect(f"{clause}: gift permafainted", perma_faint, True)
    result.expect(f"{clause}: gift in the party or a box", held, clause != "released-owner")
    result.expect(f"{clause}: other held members of the gift's family", kin, 0)
    return result.expect(f"{clause}: gift species still owned", owned, True)


def check_clauses(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, CLAUSE_RULES):
        return
    if not encounter_map_unmarked(live, result, CENTER_SPOT):
        return
    result.note(f"{eval_inspect(live.session, FLEE_SETUP)} holds a {FLEE_ITEM}")
    run_script(live, GIFT_SCRIPT)
    if reached(live, result, at_naming, "gift: the name screen") is None:
        return
    gift_paths: Paths = [("species", f"{GIFT_VAR}.species"), ("name", f"{GIFT_VAR}.speciesName")]
    gift = read_checked(live, result, gift_paths)
    species_name = str(gift.get("name"))
    if not force_nickname(live, result, "gift", species_name.lower(), GIFT_NICKNAME):
        return
    if reached(live, result, at_idle, "gift: back to the overworld") is None:
        return
    after: Paths = [
        ("name", f"{GIFT_VAR}.name"),
        ("owned", f'$player.owned?("{gift.get("species")}")'),
    ]
    given = read_checked(live, result, after)
    result.expect(f"gift {gift.get('species')} name", given.get("name"), GIFT_NICKNAME)
    result.expect(f"gift {gift.get('species')} owned", given.get("owned"), True)
    result.expect(f"map {CENTER_MAP} marked after the gift", marked(live, result, CENTER_MAP), None)
    for clause, wild in WILD_SETUPS.items():
        if clause in OWNER_STEPS and not owner_step(live, result, clause):
            return
        foe = start_wild(live, result, wild)
        if foe is None:
            return
        if clause == "shiny":
            result.expect("shiny wild is shiny", foe.get("shiny"), True)
        elif clause in ("dupes", *OWNER_STEPS):
            result.expect(
                f"{clause} wild is the gift's species", foe.get("species"), gift.get("species")
            )
        else:
            result.expect(f"{LEGENDARY_SPECIES} is Legendary", foe.get(LEGENDARY_FLAGS[0]), True)
        if not flee(live, result):
            return
        result.expect(
            f"map {CENTER_MAP} marked after the {clause} battle",
            marked(live, result, CENTER_MAP),
            None,
        )


def check_first_encounter(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, ENCOUNTER_RULES):
        return
    if not encounter_map_unmarked(live, result, CENTER_SPOT):
        return
    result.note(f"{eval_inspect(live.session, FLEE_SETUP)} holds a {FLEE_ITEM}")
    balls = ball_count(live, result, FIRST_BALL)
    if not result.mark(isinstance(balls, int) and balls > 0, f"{FIRST_BALL} held: {balls}"):
        return
    foe = start_wild(live, result, FRESH_WILD)
    if foe is None:
        return
    result.expect("first wild is shiny", foe.get("shiny"), False)
    if not flee(live, result):
        return
    result.expect(
        f"map {CENTER_MAP} marked after the first battle", marked(live, result, CENTER_MAP), True
    )
    if start_wild(live, result, FRESH_WILD) is None or not choose_ball(live, result, FIRST_BALL):
        return
    texts = reached(
        live,
        result,
        lambda now, texts: bool(texts) and now.context.name == BATTLE_BAG,
        "back in the bag after the refusal",
    )
    if texts is None:
        return
    result.mark(FIRST_BALL_REFUSAL in texts, f"{FIRST_BALL} refused with {FIRST_BALL_REFUSAL!r}")
    result.expect(f"{FIRST_BALL} held after", ball_count(live, result, FIRST_BALL), balls)
    press(live, "B")
    if reached(live, result, at_command, "back at the command menu") is None:
        return
    if flee(live, result):
        result.expect(f"map {CENTER_MAP} still marked", marked(live, result, CENTER_MAP), True)


def check_catch_nickname(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, [*ENCOUNTER_RULES, NICKNAME_RULE]):
        return
    if not encounter_map_unmarked(live, result, CATCH_SPOT):
        return
    eval_inspect(live.session, f"$bag.add(:{CATCH_BALL}); true")
    balls = ball_count(live, result, CATCH_BALL)
    result.note(f"{CATCH_BALL} held: {balls}")
    foe = start_wild(live, result, FRESH_WILD)
    if foe is None or not choose_ball(live, result, CATCH_BALL):
        return
    if reached(live, result, at_naming, "catch: the name screen") is None:
        return
    result.expect(f"map {CATCH_MAP} marked by the catch", marked(live, result, CATCH_MAP), True)
    if not force_nickname(live, result, "catch", str(foe.get("name")), CATCH_NICKNAME):
        return
    if reached(live, result, at_idle, "catch: back to the overworld") is None:
        return
    caught_paths: Paths = [
        ("species", "$player.party.last.species"),
        ("name", "$player.party.last.name"),
    ]
    caught = read_checked(live, result, caught_paths)
    result.expect("caught species", caught.get("species"), foe.get("species"))
    result.expect("caught name", caught.get("name"), CATCH_NICKNAME)
    result.expect(
        f"{CATCH_BALL} held after",
        ball_count(live, result, CATCH_BALL),
        balls - 1 if isinstance(balls, int) else None,
    )
    result.expect(f"map {CATCH_MAP} marked after", marked(live, result, CATCH_MAP), True)


def wipe_ready(live: Live, result: CheckResult) -> bool:
    if not challenge_on(live, result, WIPE_RULES):
        return False
    rules = read_checked(live, result, WIPE_STATE_PATHS).get("rules") or []
    for rule in WIPE_OFF_RULES:
        result.expect(f"rule {rule} on", rule in rules, False)
    return not any(rule in rules for rule in WIPE_OFF_RULES)


def read_party(live: Live, result: CheckResult, label: str) -> list[dict[str, Any]]:
    size = read_checked(live, result, [("size", "$player.party.length")]).get("size")
    count = size if isinstance(size, int) else 0
    return [read_member(live, result, slot, f"{label}, slot {slot}") for slot in range(count)]


def set_up_wipe(live: Live, result: CheckResult) -> int:
    lead = int(eval_inspect(live.session, WIPE_PARTY_SETUP))
    result.note(f"party slot {lead} is the lead at 1 HP knowing {WIPE_LEAD_MOVE}; the rest at 0 HP")
    return lead


def fight_to_loss(live: Live, result: CheckResult, done: Done, label: str) -> list[str] | None:
    run_script(live, WILD_SCRIPT.format(wild=WIPE_FOE))
    if reached(live, result, at_command, "wild battle at its command menu") is None:
        return None
    foe = read_checked(live, result, FOE_PATHS)
    result.note(f"wild {foe.get('species')} at level {WIPE_FOE_LEVEL} knowing {WIPE_FOE_MOVE}")
    if not result.mark(choose_command(live, result, FIGHT_COMMAND), "chose Luchar"):
        return None
    fight = reached(live, result, lambda now, _: now.context.name == BATTLE_FIGHT, "move menu")
    if fight is None:
        return None
    press(live, CONFIRM)
    return reached(live, result, done, label)


def in_storage(live: Live) -> bool:
    return any(STORAGE_FRAME in frame for frame in live.session.stack().value.frames)


def storage_commands(live: Live) -> list[Any]:
    for _ in range(WINDOW_WAIT_TICKS // WINDOW_STEP_TICKS):
        shown = eval_json(live, STORAGE_COMMANDS_SOURCE)
        if shown:
            return shown
        live.driver.advance(WINDOW_STEP_TICKS)
    return []


def storage_choose(live: Live, result: CheckResult, choice: str) -> bool:
    shown = storage_commands(live)
    if not result.mark(bool(shown), f"storage commands shown for {choice!r}"):
        return False
    result.note(f"storage asks {shown[2]!r} with {shown[1]}")
    for _ in range(STORAGE_COMMAND_PRESSES):
        shown = storage_commands(live)
        if not shown:
            return result.mark(False, f"storage commands gone before {choice!r}")
        index, commands, _ = shown
        if commands[index] == choice:
            press(live, CONFIRM)
            return True
        press(live, "DOWN")
    return result.mark(False, f"storage command {choice!r} not reached")


def leave_storage(live: Live, result: CheckResult) -> bool:
    if not result.mark(wait_frame(live, STORAGE_FRAME), "storage waiting for a choice"):
        return False
    press(live, "B")
    shown = storage_commands(live)
    result.expect("storage asks on leaving", shown[2] if shown else None, STORAGE_MORE)
    return storage_choose(live, result, STORAGE_NO)


def wipe_texts(result: CheckResult, texts: list[str], message: str, count: int) -> None:
    seen = sum(message in text for text in texts)
    result.expect(f"{message!r} shown", seen, count)


def check_party_wipe(live: Live, result: CheckResult) -> None:
    if not wipe_ready(live, result):
        return
    box = int(eval_inspect(live.session, PC_SETUP))
    pc_paths: Paths = [
        ("species", f"$PokemonStorage[{box}, 0].species"),
        ("name", f"$PokemonStorage[{box}, 0].name"),
        ("hp", f"$PokemonStorage[{box}, 0].hp"),
    ]
    stored = read_checked(live, result, pc_paths)
    result.note(
        f"box {box} slot 0 holds {stored.get('name')}, a living {stored.get('species')} "
        f"at {stored.get('hp')} HP"
    )
    set_up_wipe(live, result)
    living = int(eval_inspect(live.session, LIVING_COUNT))
    result.expect("living Pokémon in the party and the PC", living, 2)
    texts = fight_to_loss(
        live, result, lambda now, _: in_storage(live), "the storage screen opened"
    )
    if texts is None:
        return
    wipe_texts(result, texts, PC_SWAP_MESSAGE, 1)
    result.mark(True, f"the storage screen is open ({STORAGE_FRAME} on the stack)")
    if not leave_storage(live, result):
        return
    again = reached(
        live, result, lambda now, _: in_storage(live), "the storage screen opened again"
    )
    if again is None:
        return
    wipe_texts(result, again, PC_SWAP_MESSAGE, 1)
    if not result.mark(wait_frame(live, STORAGE_FRAME), "storage waiting for a choice"):
        return
    press(live, CONFIRM)
    if not storage_choose(live, result, STORAGE_WITHDRAW):
        return
    if not leave_storage(live, result):
        return
    after = reached(live, result, at_idle, "back to the overworld after the swap")
    if after is None:
        return
    wipe_texts(result, after, PC_SWAP_MESSAGE, 0)
    state = read_checked(live, result, WIPE_STATE_PATHS)
    result.note(f"on map {state.get('map')}, Pokémon Center map {state.get('center')}")
    result.expect("challenge on after the swap", bool(state.get("toggled")), True)
    result.expect(
        "box slot 0 after the swap", read_checked(live, result, pc_paths).get("species"), None
    )
    party = read_party(live, result, "after the whiteout")
    able = [member for member in party if member.get("hp")]
    result.expect("living party members", len(able), 1)
    if able:
        result.expect("the living member's name", able[0].get("name"), PC_NICKNAME)
    for slot, member in enumerate(party):
        if all(member is not living for living in able):
            result.expect(f"slot {slot} HP after the whiteout", member.get("hp"), 0)
            result.expect(f"slot {slot} @perma_faint", member.get("perma_faint"), True)


def check_total_wipe(live: Live, result: CheckResult) -> None:
    if not wipe_ready(live, result):
        return
    set_up_wipe(live, result)
    living = int(eval_inspect(live.session, LIVING_COUNT))
    result.expect("living Pokémon in the party and the PC", living, 1)
    texts = fight_to_loss(live, result, at_idle, "back to the overworld after the loss")
    if texts is None:
        return
    wipe_texts(result, texts, LOSS_MESSAGE, 1)
    wipe_texts(result, texts, PC_SWAP_MESSAGE, 0)
    state = read_checked(live, result, WIPE_STATE_PATHS)
    hall = state.get("hall")
    slot = hall if isinstance(hall, int) and hall >= 0 else 0
    entry = (state.get("state") or {}).get(slot)
    result.note(f"challenge_state {state.get('state')}, hallOfFameLastNumber {hall}")
    rules = state.get("rules") or []
    result.expect(f"challenge_state[{slot}]", entry, [LOSS, rules])
    result.expect("challenge_started after the loss", state.get("started"), None)
    result.expect("ChallengeModes@@started after the loss", state.get("toggled"), False)
    result.expect("challenge rules kept", sorted(rules), sorted(CHALLENGE_RULES))
    party = read_party(live, result, "after the loss")
    for slot, member in enumerate(party):
        result.expect(f"slot {slot} @perma_faint after the loss", member.get("perma_faint"), False)


def hall_state(live: Live, result: CheckResult, label: str) -> dict[str, Any]:
    state = read_checked(live, result, HALL_STATE_PATHS)
    result.note(
        f"{label}: challenge_state {state.get('state')}, hallOfFameLastNumber {state.get('hall')}, "
        f"challenge_started {state.get('started')}, ChallengeModes@@started {state.get('toggled')}, "
        f"switch {GAME_BEATEN_SWITCH} {state.get('beaten')}, map {state.get('map')}"
    )
    return state


def challenge_still_on(
    live: Live, result: CheckResult, slot: int, label: str, state: dict[str, Any]
) -> None:
    result.expect(f"challenge_started {label}", state.get("started"), True)
    result.expect(f"ChallengeModes@@started {label}", state.get("toggled"), True)
    member = read_member(live, result, slot, f"the permafainted member {label}")
    result.expect(f"@perma_faint {label}", member.get("perma_faint"), True)
    result.expect(f"HP {label}", member.get("hp"), 0)


def enter_hall(live: Live) -> int | None:
    run_script(live, HALL_SCRIPT)
    presses = 0
    for _ in range(HALL_STEPS):
        _, values, _ = read_values(live.session, [INTERPRETER_RUNNING])
        if not values.get(INTERPRETER_RUNNING[0]):
            return presses
        if any(HALL_WAIT_FRAME in frame for frame in live.session.stack().value.frames):
            press(live, CONFIRM)
            presses += 1
        else:
            live.driver.advance(WINDOW_STEP_TICKS)
    return None


def hall_unsaved(live: Live, result: CheckResult, before: dict[str, Any]) -> bool:
    eval_inspect(live.session, HALL_NO_SLOT)
    presses = enter_hall(live)
    if not result.mark(presses is not None, f"{HALL_SCRIPT} with no save slot ended"):
        return False
    result.expect(f"C presses on {HALL_WAIT_FRAME} with no save slot", presses, 0)
    unsaved = hall_state(live, result, "after the Hall of Fame with no save slot")
    result.expect("hallOfFameLastNumber with no save slot", unsaved.get("hall"), before.get("hall"))
    return result.expect("challenge_state with no save slot", unsaved.get("state"), {})


def check_hall_of_fame(live: Live, result: CheckResult) -> None:
    if not challenge_on(live, result, [PERMAFAINT_RULE]):
        return
    session = live.session
    name = f"{HALL_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        hall_and_credits(live, result)
    finally:
        restore_snapshot(session, name)


def hall_and_credits(live: Live, result: CheckResult) -> None:
    slot = int(eval_inspect(live.session, HALL_PERMAFAINTED))
    before = hall_state(live, result, "before the Hall of Fame")
    result.expect("challenge_state before the Hall of Fame", before.get("state"), {})
    challenge_still_on(live, result, slot, "before the Hall of Fame", before)
    hall = before.get("hall")
    if not isinstance(hall, int) or not hall_unsaved(live, result, before):
        return
    saved = eval_inspect(live.session, f"Game.save({GAME_SAVE_SLOT!r})")
    result.expect(f"Game.save({GAME_SAVE_SLOT!r})", saved, "true")
    presses = enter_hall(live)
    if not result.mark(presses is not None, f"{HALL_SCRIPT} with a save slot ended"):
        return
    result.mark(bool(presses), f"C pressed {presses} times on {HALL_WAIT_FRAME}")
    entered = hall_state(live, result, "after the Hall of Fame")
    result.expect("hallOfFameLastNumber after the Hall of Fame", entered.get("hall"), hall + 1)
    result.expect("challenge_state after the Hall of Fame", entered.get("state"), {})
    result.expect(
        f"switch {GAME_BEATEN_SWITCH} after the Hall of Fame",
        entered.get("beaten"),
        before.get("beaten"),
    )
    challenge_still_on(live, result, slot, "after the Hall of Fame", entered)
    transfer(live, CREDITS_MAP, CREDITS_TILE, FACING_DOWN)
    if reached(live, result, at_idle, "the credits event ran", CREDITS_STEPS) is None:
        return
    credits = hall_state(live, result, "after the credits")
    result.expect("map after the credits", credits.get("map"), CREDITS_END_MAP)
    result.expect(f"switch {GAME_BEATEN_SWITCH} after the credits", credits.get("beaten"), True)
    result.expect(
        "challenge_state after the credits",
        credits.get("state"),
        {hall + 1: [VICTORY, credits.get("rules") or []]},
    )
    result.expect(
        "challenge rules kept", sorted(credits.get("rules") or []), sorted(CHALLENGE_RULES)
    )
    challenge_still_on(live, result, slot, "after the credits", credits)


def cap_member(live: Live, result: CheckResult, cap: int, label: str) -> dict[str, Any]:
    member = dict(zip(CAP_MEMBER_FIELDS, eval_json(live, CAP_MEMBER.format(cap=cap)), strict=True))
    result.note(
        f"{label}: {member.get('species')} level {member.get('level')}, exp {member.get('exp')} "
        f"(the cap level's minimum is {member.get('cap_exp')})"
    )
    return member


def set_up_cap_lead(live: Live, result: CheckResult, cap: int, level: int, short: int) -> None:
    lead = CAP_MON.format(species=CAP_SPECIES, level=level, move=CAP_MOVE)
    setup = CAP_LEAD_SETUP.format(mon=lead, cap=cap, short=short)
    result.note(
        f"the party is one {CAP_SPECIES} knowing {CAP_MOVE}: {eval_inspect(live.session, setup)}"
    )


def cap_candy(live: Live, result: CheckResult, cap: int, label: str) -> None:
    set_up_cap_lead(live, result, cap, cap, 0)
    before = cap_member(live, result, cap, f"{label}before the candy")
    eval_inspect(live.session, f"$bag.add(:{CAP_CANDY}); true")
    held = ball_count(live, result, CAP_CANDY)
    run_script(live, ITEM_SCRIPT.replace("SLOT", "0").replace("ITEM", CAP_CANDY))
    text = window_text(live, PARTY_SCENE, PARTY_MESSAGE)
    result.expect(f"{label}{CAP_CANDY} at the cap", text, CAP_CANDY_REFUSAL)
    result.mark(
        close_window(live, PARTY_SCENE, PARTY_MESSAGE), f"{label}{CAP_CANDY} message closed"
    )
    result.mark(wait_script_done(live), f"{label}{CAP_CANDY} party screen closed")
    used = read_checked(live, result, [("used", f"${ITEM_RESULT}")]).get("used")
    result.expect(f"{label}pbUseItemOnPokemon({CAP_CANDY})", used, False)
    result.expect(f"{label}{CAP_CANDY} held after", ball_count(live, result, CAP_CANDY), held)
    after = cap_member(live, result, cap, f"{label}after the candy")
    result.expect(f"{label}level after the candy", after.get("level"), cap)
    result.expect(f"{label}exp after the candy", after.get("exp"), before.get("exp"))


def level_up_shown(live: Live) -> bool:
    return any(LEVEL_UP_FRAME in frame for frame in live.session.stack().value.frames)


def win_battle(live: Live, result: CheckResult, label: str) -> list[str] | None:
    texts: list[str] = []
    for _ in range(LEVEL_UP_WINDOWS):
        now, seen = drive_to(live, result, lambda now, _: now.idle or level_up_shown(live))
        texts.extend(seen)
        if now is None:
            break
        if now.idle:
            result.mark(True, f"{label}: back to the overworld after the win")
            return texts
        result.note(f"{label}: the level-up stats window is open; C closes it")
        press(live, CONFIRM)
    result.mark(False, f"{label}: back to the overworld after the win")
    return None


def cap_battle(live: Live, result: CheckResult, cap: int, label: str) -> dict[str, Any] | None:
    foe = CAP_FOE.format(mon=CAP_MON.format(species=CAP_FOE_SPECIES, level=cap, move=CAP_FOE_MOVE))
    run_script(live, WILD_SCRIPT.format(wild=foe))
    if reached(live, result, at_command, f"{label}: wild battle at its command menu") is None:
        return None
    seen = read_checked(live, result, [*FOE_PATHS, ("level", f"{FOE}.level"), ("hp", f"{FOE}.hp")])
    result.note(
        f"{label}: wild {seen.get('species')} level {seen.get('level')} at {seen.get('hp')} HP"
    )
    if not result.mark(choose_command(live, result, FIGHT_COMMAND), f"{label}: chose Luchar"):
        return None
    fight = reached(live, result, lambda now, _: now.context.name == BATTLE_FIGHT, "move menu")
    if fight is None:
        return None
    press(live, CONFIRM)
    texts = win_battle(live, result, label)
    if texts is None:
        return None
    gained = [text for text in texts if CAP_EXP_MESSAGE in text]
    after = cap_member(live, result, cap, f"{label}: after the win")
    return {**after, "gained": gained}


def cap_off(live: Live, result: CheckResult, cap: int) -> None:
    off = eval_inspect(live.session, CAP_OFF)
    result.expect(
        f"LevelCapsEX.hard_cap? with variable {LEVEL_CAP_MODE_VARIABLE} at 0", off, "false"
    )
    set_up_cap_lead(live, result, cap, cap - 1, 1)
    free = cap_battle(live, result, cap, "the cap off, one EXP point below")
    if free is None:
        return
    exp, cap_exp = free.get("exp"), free.get("cap_exp")
    past = isinstance(exp, int) and isinstance(cap_exp, int) and exp > cap_exp
    result.mark(past, f"the cap off: exp {exp} past the cap level's minimum {cap_exp}")


def cap_exp_probes(live: Live, result: CheckResult, cap: int, label: str) -> bool:
    cap_candy(live, result, cap, label)
    at_cap = cap_battle(live, result, cap, f"{label}at the cap")
    if at_cap is None:
        return False
    result.expect(f"{label}at the cap: EXP messages", at_cap["gained"], [])
    result.expect(f"{label}at the cap: level after the win", at_cap.get("level"), cap)
    result.expect(f"{label}at the cap: exp after the win", at_cap.get("exp"), at_cap.get("cap_exp"))
    set_up_cap_lead(live, result, cap, cap - 1, 1)
    below = cap_battle(live, result, cap, f"{label}one EXP point below the cap")
    if below is None:
        return False
    result.mark(bool(below["gained"]), f"{label}one below: EXP messages {below['gained']}")
    result.expect(f"{label}one below: level after the win", below.get("level"), cap)
    result.expect(f"{label}one below: exp after the win", below.get("exp"), below.get("cap_exp"))
    return True


def cap_badges(live: Live, result: CheckResult, cap: int) -> None:
    for switch, level in LEVEL_CAP_SWITCHES:
        seen = eval_json(live, CAP_SWITCH_ON.format(switch=switch, species=CAP_FOE_SPECIES))
        result.expect(
            f"switches {LEVEL_CAP_SWITCHES[0][0]} to {switch} on: [{CAP_SWITCH_FIELDS}]",
            seen,
            [level] * 4,
        )
    switches = [switch for switch, _ in LEVEL_CAP_SWITCHES]
    back = eval_inspect(live.session, CAP_SWITCHES_OFF.format(switches=switches))
    result.expect("level_cap with the badge switches off again", back, str(cap))


def cap_bypass(live: Live, result: CheckResult, cap: int, on: bool) -> None:
    seen = eval_json(live, CAP_BYPASS.format(on="true" if on else "false"))
    result.expect(
        f"switch {LEVEL_CAP_BYPASS_SWITCH} set {'on' if on else 'off'}: "
        "[switch, hard_cap?, level_cap, max_level]",
        seen,
        [on, True, cap, cap],
    )


def cap_code_levels(live: Live, result: CheckResult, cap: int, label: str) -> None:
    high, higher = cap + CAP_CODE_HIGH, cap + CAP_CODE_HIGHER
    source = CAP_CODE_LEVELS.format(species=CAP_FOE_SPECIES, high=high, higher=higher)
    result.expect(
        f"{label}Pokemon.new at {high}, and level = {higher} on a level 5 one",
        eval_json(live, source),
        [cap, cap],
    )


def cap_trainers(live: Live, result: CheckResult, cap: int, label: str) -> None:
    trainers = eval_data(live, ruby(CAP_TRAINERS, CAP=cap, COUNT=CAP_TRAINER_COUNT))
    if not result.mark(bool(trainers), f"{label}{len(trainers)} unloaded trainers above the cap"):
        return
    for key, pbs, loaded in trainers:
        result.expect(
            f"{label}{key} loaded levels (PBS {pbs})", loaded, [min(level, cap) for level in pbs]
        )


def check_level_cap(live: Live, result: CheckResult) -> None:
    state = read_checked(live, result, LEVEL_CAP_PATHS)
    result.note(
        f"cap variable {state.get('cap_variable')}, cap {state.get('cap')} at "
        f"{state.get('badges')} badges, GrowthRate.max_level {state.get('max_level')}"
    )
    result.expect(
        f"variable {LEVEL_CAP_MODE_VARIABLE} (cap mode)", state.get("mode"), HARD_CAP_MODE
    )
    result.expect("LevelCapsEX.hard_cap?", state.get("hard_cap"), True)
    result.expect(f"switch {LEVEL_CAP_BYPASS_SWITCH} (bypass)", state.get("bypass"), False)
    result.expect("$DEBUG", bool(state.get("debug")), False)
    cap = state.get("cap")
    if not isinstance(cap, int) or not result.mark(cap > 1, f"level cap {cap}"):
        result.mark(isinstance(cap, int), f"level cap read: {cap!r}")
        return
    result.expect("GrowthRate.max_level", state.get("max_level"), cap)
    session = live.session
    name = f"{LEVEL_CAP_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    cap_badges(live, result, cap)
    cap_code_levels(live, result, cap, "")
    cap_trainers(live, result, cap, "")
    if cap_exp_probes(live, result, cap, ""):
        cap_bypass(live, result, cap, True)
        cap_code_levels(live, result, cap, CAP_BYPASS_LABEL)
        cap_trainers(live, result, cap, CAP_BYPASS_LABEL)
        if cap_exp_probes(live, result, cap, CAP_BYPASS_LABEL):
            cap_bypass(live, result, cap, False)
            cap_off(live, result, cap)
    restore_snapshot(session, name)


RANDOM_PRELUDE = """
mid = lambda { |m| m.respond_to?(:id) ? m.id : m }
mv = lambda { |m, pk| d = GameData::Move.get(mid.call(m)); [d.id, d.display_max_power(true), d.ohko?, pk ? d.display_power(pk) > 10 : nil] }
sp = lambda { |s| s = GameData::Species.get(s); b = GameData::Species.get(s.get_baby_species); [s.id, s.species, s.form, s.form_name.to_s, s.generation, b.generation, s.base_stats.values.sum, RandomizedChallenge::BLACKLISTED_POKEMON.include?(s.id), GameData::Species.get(s.species).base_stats.values.sum] }
it = lambda { |i| next nil if !i; d = GameData::Item.get(i); [d.id, d.is_key_item?, d.is_HM?, d.is_mega_stone?, d.is_mail?, d.is_snag_ball?, RandomizedChallenge::ITEM_BLACK_LIST.include?(d.id), d.is_machine?] }
ab = lambda { |s| s = GameData::Species.get(s); s.abilities + s.hidden_abilities }
brief = lambda { |pk| { "sp" => sp.call(pk.species_data.id), "level" => pk.level, "randomized" => pk.randomized?, "ability" => pk.ability_id, "abilities" => ab.call(pk.species_data.id), "moves" => pk.moves.map { |m| mv.call(m.id, pk) }, "item" => it.call(pk.item_id) } }
full = lambda { |pk| brief.call(pk).merge("learnset" => pk.getMoveList.map { |lv, m| [lv] + mv.call(m, nil) }, "levels" => pk.random_getMoveList.map(&:first)) }
badged = lambda { |n, &blk| saved = $player.badges.clone; begin; $player.badges.fill(false); n.times { |i| $player.badges[i] = true }; blk.call; ensure; $player.badges.replace(saved); end }
"""
RANDOM_RULES = """
{ "levels" => RandomizedChallenge::BADGES_MAX_LEVELS, "late" => MoveRandomizer::LATE_GAME_BANNED_MOVES.to_a,
  "blacklist" => RandomizedChallenge::MOVEBLACKLIST, "badges" => $player.badge_count,
  "paused" => RandomizedChallenge.wild_paused?, "enabled" => RandomizedChallenge.enabled? }
"""
RANDOM_SPECIES_BATCH = (
    "badged.call(BADGES) { (1..COUNT).map { pk = Pokemon.new(:SPECIES, LEVEL); "
    "[sp.call(pk.species_data.id), pk.randomized?] } }"
)
RANDOM_FULL_BATCH = "badged.call(BADGES) { (0...COUNT).map { |i| full.call(Pokemon.new(:SPECIES, LEVELS[i % LEVELS.size])) } }"
RANDOM_BRIEF_BATCH = "(1..COUNT).map { brief.call(Pokemon.new(:SPECIES, LEVEL)) }"
RANDOM_STARTERS = (
    "VARIABLES.map { |v| p = $game_variables[v]; s = p.species_data; full.call(p).merge("
    + (
        '"first" => s.get_previous_species == s.species, "family" => s.get_family_evolutions.size, '
        '"from_it" => s.get_family_evolutions.count { |e| e[0] == s.species }, '
        '"family_species" => s.get_family_species) }'
    )
)
RANDOM_ABILITY_TABLE = """
d = RandomizedChallenge::Ability.get_randomized_data; keys = GameData::Ability.keys; last = keys.index(:LAST_ABILITY)
v = d.values.select { |h| h.is_a?(Hash) }.flat_map { |h| h[:base] + h[:hidden] }.uniq
same = GameData::Species.keys.count { |k| h = d[k]; h.is_a?(Hash) && h[:base] == GameData::Species.get(k).real_abilities }
shape = GameData::Species.keys.count { |k| h = d[k]; s = GameData::Species.get(k); h.is_a?(Hash) && h[:base].size == s.real_abilities.size && h[:hidden].size == s.real_hidden_abilities.size }
kept = RandomizedChallenge::SPECIES_WITHOUT_RANDOM_ABS.map { |k| s = GameData::Species.get(k); [k, s.abilities == s.real_abilities && s.hidden_abilities == s.real_hidden_abilities] }
astray = GameData::Species.keys.reject { |k| RandomizedChallenge::SPECIES_WITHOUT_RANDOM_ABS.include?(k) }.reject { |k| h = d[k]; s = GameData::Species.get(k); h.is_a?(Hash) && s.abilities == h[:base] && s.hidden_abilities == h[:hidden] }
{ "species" => GameData::Species.keys.size, "missing" => GameData::Species.keys.count { |k| !d[k].is_a?(Hash) },
  "abilities" => keys.size, "used" => v.size, "used_list" => v, "excluded_used" => v & RandomizedChallenge::ABILITY_EXCLUSIONS,
  "excluded" => RandomizedChallenge::ABILITY_EXCLUSIONS.size, "past_last" => v.count { |a| keys.index(a) > last },
  "same_as_real" => same, "same_shape" => shape, "kept" => kept, "astray" => astray }
"""
RANDOM_TRAINER_PICK = """
keys = GameData::Trainer.keys
pick = keys.select.with_index { |_, i| i % EVERY == 0 } + keys.select { |k| GameData::Trainer.get(*k).pokemon.any? { |p| p[:item] } }.first(HELD)
pick.uniq.map { |k| k.map { |x| x.is_a?(Symbol) ? x.to_s : x } }
"""
RANDOM_TRAINERS = """
tf = lambda { |pk| [pk.species_data.id, pk.level, pk.moves.map(&:id), pk.item_id, pk.ability_id, pk.personalID] }
badged.call(BADGES) { KEYS.map { |k| k = [k[0].to_sym, k[1], k[2]]; d = GameData::Trainer.get(*k)
  stored = ($PokemonGlobal.random_trainer_teams || {}).key?(d.id)
  a = pbLoadTrainer(*k); b = pbLoadTrainer(*k)
  { "key" => k, "stored" => stored, "same" => a.party.map { |pk| tf.call(pk) } == b.party.map { |pk| tf.call(pk) },
    "pbs" => d.pokemon.map { |p| [p[:species], p[:level], p[:item], p[:item] ? GameData::Item.get(p[:item]).is_mega_stone? : false] },
    "party" => a.party.map { |pk| brief.call(pk) } } } }
"""
RANDOM_TM_MART_SOURCE = """
tm = lambda { |id, n| RandomizedChallenge.tm_mart(id, n).map { |t| t = GameData::Item.get(t); [t.id, t.is_TM?] + mv.call(t.move, nil) } }
existed = MARTS.map { |id, _| ($PokemonGlobal.tm_mart || {}).key?(id) }
first = MARTS.map { |id, n| tm.call(id, n) }; again = MARTS.map { |id, n| tm.call(id, n) }
{ "existed" => existed, "first" => first, "again" => again, "given" => $PokemonGlobal.given_tm_moves.to_a }
"""
RANDOM_COMPAT = """
moves = GameData::Move.keys.select.with_index { |_, i| i % EVERY == 0 }
mons = (1..COUNT).map { Pokemon.new(:SPECIES, LEVEL) }
table = $PokemonGlobal.tm_compatibility_random || {}
same = lambda { |pk| GameData::Move.keys.select { |m| pk.types.include?(GameData::Move.get(m).type) }.first(STAB) }
asked = mons.map { |pk| (moves + same.call(pk)).uniq }
pairs = mons.each_with_index.flat_map { |pk, i| asked[i].map { |m| fresh = !(table[pk.species] || []).any? { |x| x[0] == m }
  [pk.species, m, pk.types.include?(GameData::Move.get(m).type), fresh, pk.compatible_with_move?(m)] } }
again = mons.each_with_index.flat_map { |pk, i| asked[i].map { |m| pk.compatible_with_move?(m) } }
path = RandomizedChallenge.get_tm_compatibility_file_path
{ "pairs" => pairs, "again" => again, "file" => path, "file_matches" => File.exist?(path) && RandomizedChallenge.load_tm_compatibility_data == $PokemonGlobal.tm_compatibility_random }
"""
RANDOM_ITEMS = """
marts = lambda { ($PokemonGlobal.tm_mart || {}).map { |id, l| [id, l.map { |t| t = GameData::Item.get(t); [t.id, mid.call(t.move)] }] } }
before = marts.call; given = $PokemonGlobal.given_tm_moves.size
draws = (1..COUNT).map { x = GameData::Item.get(RandomizedChallenge.determine_random_item(:ORIGINAL)); [it.call(x.id), x.is_machine? ? mv.call(x.move, nil) : nil] }
kept = KEPT.map { |i| x = RandomizedChallenge.determine_random_item(i); [i, GameData::Item.get(x).id] }
gifts = (1..GIFTS).map { RandomizedChallenge.with_pokemon_item_randomization(:SPECIES, LEVEL) { |pk, _| [sp.call(pk.species_data.id), it.call(pk.item_id)] } }
{ "draws" => draws, "kept" => kept, "gifts" => gifts, "given_before" => given, "given_after" => $PokemonGlobal.given_tm_moves.size,
  "marts_before" => before, "marts_after" => marts.call }
"""
RANDOM_KEPT_ITEMS = """
[:TINYMUSHROOM, GameData::Item.keys.find { |i| GameData::Item.get(i).is_key_item? }, GameData::Item.keys.find { |i| GameData::Item.get(i).is_HM? }, GameData::Item.keys.find { |i| GameData::Item.get(i).is_mega_stone? }]
"""
RANDOM_WILD = """
table = lambda { ((($PokemonGlobal.random_encounter_table || {})[MAP] || {})[:TYPE]) }
existed = !table.call.nil?
draws = (1..COUNT).map { e = $PokemonEncounters.choose_wild_pokemon(:TYPE); pk = pbGenerateWildPokemon(e[0], e[1])
  s = pk.species_data; [e[0], e[1], pk.species, pk.level, it.call(pk.item_id), [s.wild_item_common, s.wild_item_uncommon, s.wild_item_rare].flatten.compact] }
{ "existed" => existed, "map" => $game_map.map_id, "original" => GameData::Encounter.get(MAP, $PokemonGlobal.encounter_version).types[:TYPE].map { |c, s, a, b| [c, sp.call(s), a, b] },
  "table" => table.call.map { |c, s, a, b| [c, sp.call(s), a, b] }, "draws" => draws,
  "paused" => RandomizedChallenge.wild_paused?, "after" => Pokemon.new(:SPECIES, LEVEL).species }
"""
RANDOM_WILD_TABLE = "((($PokemonGlobal.random_encounter_table || {})[MAP] || {})[:TYPE] || []).map { |c, s, a, b| [c, s, a, b] }"
RANDOM_FINGERPRINT = """
crc = lambda { |x| Zlib.crc32(Marshal.dump(x)) }
g = $PokemonGlobal
{ "encounters" => crc.call(g.random_encounter_table), "encounter_maps" => (g.random_encounter_table || {}).keys,
  "trainers" => crc.call(g.random_trainer_teams), "trainer_count" => (g.random_trainer_teams || {}).size,
  "marts" => (g.tm_mart || {}).map { |id, l| [id, l.map { |t| t = GameData::Item.get(t); [t.id, mid.call(t.move)] }] },
  "tm_moves" => (g.tm_move_map || {}).map { |i, m| [i, mid.call(m)] }, "given" => (g.given_tm_moves || []).to_a,
  "abilities" => crc.call(($randomized_data || {})[:abilities]), "learnsets" => crc.call(g.random_moves),
  "learnset_species" => (g.random_moves || {}).size, "compat" => crc.call(g.tm_compatibility_random),
  "compat_species" => (g.tm_compatibility_random || {}).size,
  "starters" => VARIABLES.map { |v| p = $game_variables[v]; [p.species, p.moves.map(&:id), p.ability_id] } }
"""
RANDOM_USE = """
g = $PokemonGlobal
tf = lambda { |pk| [pk.species_data.id, pk.level, pk.moves.map(&:id), pk.item_id, pk.ability_id, pk.personalID] }
enc = (((g.random_encounter_table || {})[$game_map.map_id] || {})[:TYPE] || []).map { |e| e[1] }
wild = enc.empty? ? [] : (1..COUNT).map { $PokemonEncounters.choose_wild_pokemon(:TYPE)[0] }
trainers = (g.random_trainer_teams || {}).map { |id, t| pbLoadTrainer(*id).party.map { |pk| tf.call(pk) } == t.party.map { |pk| tf.call(pk) } }
marts = (g.tm_mart || {}).map { |id, l| RandomizedChallenge.tm_mart(id, l.size).map { |t| GameData::Item.get(t).id } == l.map { |t| GameData::Item.get(t).id } }
compat = (g.tm_compatibility_random || {}).flat_map { |s, l| pk = Pokemon.new(s, 5, $player, true, true, false); l.map { |m, ok| pk.compatible_with_move?(m) == ok } }
abilities = (($randomized_data || {})[:abilities] || {}).keys.first(ABILITIES).map { |k| next true if RandomizedChallenge::SPECIES_WITHOUT_RANDOM_ABS.include?(k); h = $randomized_data[:abilities][k]; s = GameData::Species.get(k); s.abilities == h[:base] && s.hidden_abilities == h[:hidden] }
{ "encounter_species" => enc, "wild" => wild, "trainers" => trainers, "marts" => marts, "compat" => compat, "abilities" => abilities }
"""
RANDOM_PERTURB = """
g = $PokemonGlobal
g.random_encounter_table = {}; g.random_trainer_teams = {}; g.tm_mart = {}; g.random_moves = {}
g.tm_compatibility_random = {}; $randomized_data[:abilities] = nil; true
"""
RANDOM_SPECIES = TEST_SPECIES
RANDOM_LEVEL = 5
RANDOM_BATCH = 100
RANDOM_SPECIES_BATCHES = 3
RANDOM_SPECIES_BADGES = (0, 4)
RANDOM_LEARNSET_LEVELS = [5, 12, 20, 28, 36, 44, 52, 60]
RANDOM_LEARNSET_BATCHES = 2
RANDOM_GIFTS = 200
RANDOM_ITEM_DRAWS = 300
RANDOM_ITEM = "POTION"
RANDOM_TRAINER_EVERY = 35
RANDOM_TRAINER_HELD = 10
RANDOM_TRAINER_BATCH = 10
RANDOM_LATE_BADGES = 5
RANDOM_LATE_TRAINERS = 5
RANDOM_TM_MARTS = [[1, 12], [2, 10], [3, 7]]
RANDOM_TM_MART_EVENTS = ["78/19", "93/22", "132/23"]
RANDOM_WATCHED_MARTS = {"207/6": "Dojo Magenta", "207/9": "Dojo Magenta", "91/50": "Pueblo Marengo"}
RANDOM_MART_SCAN = """
marts = []; tm_events = []; priced = []
load_data("Data/MapInfos.rxdata").keys.sort.each do |mid|
  m = load_data(sprintf("Data/Map%03d.rxdata", mid)) rescue next
  m.events.keys.sort.each do |eid|
    m.events[eid].pages.each_with_index do |pg, pi|
      blocks = []
      pg.list.each_with_index do |c, ci|
        blocks << [ci, ci + 1, ""] if c.code == 355
        if [355, 655].include?(c.code) && !blocks.empty?
          blocks[-1][1] = ci + 1; blocks[-1][2] += c.parameters[0].to_s + "\\n"
        end
      end
      blocks.each do |from, to, s|
        key = "#{mid}/#{eid}"
        priced << key if s.include?("setPrice")
        tm_events << key if s.include?("tm_mart")
        next unless s.include?("pbPokemonMart")
        items = s.scan(/:(\\w+)/).flatten
        marts << { "key" => key, "page" => pi, "from" => from, "to" => to, "items" => items,
                   "missing" => items.reject { |i| GameData::Item.exists?(i.to_sym) },
                   "prices" => items.map { |i| d = GameData::Item.try_get(i.to_sym); d ? "$ " + d.price.to_s_formatted : nil } }
      end
    end
  end
end
{ "marts" => marts, "tm_events" => tm_events.uniq, "priced" => priced.uniq }
"""
RANDOM_MART_HOLDINGS = "[$player.money, $bag.pockets.flatten.map(&:to_s)]"
RANDOM_MART_RUN = (
    "l = load_data(sprintf('Data/Map%03d.rxdata', {map_id})).events[{event_id}].pages[{page}]"
    ".list[{start}...{end}]; $game_temp.clear_mart_prices; "
    "$game_system.map_interpreter.setup(l + [RPG::EventCommand.new(0, 0, [])], 0); true"
)
RANDOM_MART_SHOWN = (
    "w = " + SCENE_SPRITES + "; a = w && w.instance_variable_get(:@adapter); "
    "w ? w.instance_variable_get(:@stock).map {{ |i| [i.to_s, a.getDisplayPrice(i)] }} : []"
)
RANDOM_COMPAT_MOVES_EVERY = 30
RANDOM_COMPAT_POKEMON = 40
RANDOM_COMPAT_SAME_TYPE = 5
RANDOM_LAST_GEN5_ABILITY = "TERAVOLT"
RANDOM_WILD_MAP = 3
RANDOM_WILD_TILE = (10, 20)
RANDOM_OTHER_MAP = 2
RANDOM_OTHER_TILE = (9, 27)
RANDOM_WILD_TYPE = "Land"
RANDOM_WILD_DRAWS = 200
RANDOM_USE_DRAWS = 50
RANDOM_USE_ABILITIES = 200
RANDOM_RELOADS = 3
RANDOM_SNAPSHOT_PREFIX = "check-random-"
BST_MAX_CAPS = {1: 400, 2: 440, 3: 480, 4: 520, 5: 560, 6: 600, 7: 800}
BST_MIN_CAPS = {3: 350, 4: 375, 5: 420, 6: 440, 7: 460}
SIMILAR_BST_MARGIN = 0.12
EARLY_GAME_BADGES = 3
LATE_GAME_BADGES = 5
EARLY_POWER_LIMIT = 70
STAB_COMPAT_RATE = 0.70
OTHER_COMPAT_RATE = 0.40
COMPAT_RATE_SLACK = 0.10
GIFT_ITEM_RATE = 0.50
MEGA_FORM_WORD = "mega"
DAMAGING_PICK_POWER = 10
SHOWN = 5


def ruby(source: str, **values: Any) -> str:
    for name, value in sorted(values.items(), key=lambda item: -len(item[0])):
        source = source.replace(name, str(value))
    return source


def eval_data(live: Live, source: str) -> Any:
    text = eval_inspect(live.session, f"AnilJSON.encode(begin\n{RANDOM_PRELUDE}\n{source}\nend)")
    return json.loads(json.loads(text.replace("\\#", "#")))


@dataclass
class RandomRules:
    levels: dict[int, int]
    late: set[str]
    blacklist: set[str]
    badges: int
    paused: bool
    enabled: bool

    def badges_for_level(self, level: int) -> int:
        for badges in sorted(self.levels):
            if level <= self.levels[badges]:
                return badges
        return 0

    def move_problem(self, move: list[Any], badges: int) -> str | None:
        name, power, ohko = move[0], move[1], move[2]
        if name not in ALLOWED_MOVES:
            return f"{name} is not in the move allow-list"
        if ohko:
            return f"{name} is OHKO"
        if name in self.blacklist:
            return f"{name} is blacklisted"
        if badges < EARLY_GAME_BADGES and power > EARLY_POWER_LIMIT:
            return f"{name} power {power} at {badges} badges"
        if badges >= LATE_GAME_BADGES and name in self.late:
            return f"{name} banned late, at {badges} badges"
        return None


def random_rules(live: Live, result: CheckResult) -> RandomRules | None:
    raw = eval_data(live, RANDOM_RULES)
    rules = RandomRules(
        levels={int(badges): cap for badges, cap in raw["levels"].items()},
        late=set(raw["late"]),
        blacklist=set(raw["blacklist"]),
        badges=raw["badges"],
        paused=raw["paused"],
        enabled=raw["enabled"],
    )
    result.note(f"{rules.badges} badges, randomizer enabled {rules.enabled}")
    ready = result.expect("randomizer enabled", rules.enabled, True)
    return rules if ready else None


def random_ready(live: Live, result: CheckResult) -> RandomRules | None:
    rules = random_rules(live, result)
    if rules is None:
        return None
    if not result.expect("random species paused", rules.paused, False):
        return None
    return rules


def bst_window(badges: int) -> tuple[int, int]:
    top = BST_MAX_CAPS[min(max(badges, min(BST_MAX_CAPS)), max(BST_MAX_CAPS))]
    bottom = (
        BST_MIN_CAPS[max(BST_MIN_CAPS)]
        if badges > max(BST_MIN_CAPS)
        else BST_MIN_CAPS.get(badges, 0)
    )
    return bottom, top


def similar_bst(bst: int) -> tuple[int, int]:
    return int(bst * (1 - SIMILAR_BST_MARGIN)), int(bst * (1 + SIMILAR_BST_MARGIN))


def species_problem(facts: list[Any], window: tuple[int, int] | None = None) -> str | None:
    species_id, _, form, form_name, generation, _, bst, blacklisted, base_bst = facts
    if species_id not in ALLOWED_SPECIES:
        return f"{species_id} (generation {generation}) is not in the species allow-list"
    if form != 0 and MEGA_FORM_WORD in form_name.lower():
        return f"{species_id} is a mega form"
    if (
        window is not None
        and not window[0] <= bst <= window[1]
        and not (form != 0 and window[0] <= base_bst <= window[1])
    ):
        return f"{species_id} BST {bst} outside {window[0]}-{window[1]}"
    if blacklisted:
        return f"{species_id} is blacklisted"
    return None


def slot_key(entry: list[Any]) -> tuple[int, int, int]:
    return entry[0], entry[2], entry[3]


def match_slots(original: list[list[Any]], table: list[list[Any]]) -> dict[int, int]:
    def fits(table_index: int, slot_index: int) -> bool:
        slot, entry = original[slot_index], table[table_index]
        return slot_key(slot) == slot_key(entry) and (
            species_problem(entry[1], similar_bst(slot[1][6])) is None
        )

    owner = {index: index for index in range(min(len(table), len(original))) if fits(index, index)}

    def claim(table_index: int, tried: set[int]) -> bool:
        for slot_index in range(len(original)):
            if slot_index in tried or not fits(table_index, slot_index):
                continue
            tried.add(slot_index)
            if slot_index not in owner or claim(owner[slot_index], tried):
                owner[slot_index] = table_index
                return True
        return False

    for table_index in range(len(table)):
        if owner.get(table_index) != table_index:
            claim(table_index, set())
    return {table_index: slot_index for slot_index, table_index in owner.items()}


def random_slot_problems(original: list[list[Any]], table: list[list[Any]]) -> list[str]:
    matched = match_slots(original, table)
    taken = set(matched.values())
    problems: list[str] = []
    for index, entry in enumerate(table):
        if index in matched:
            continue
        candidates = [
            slot
            for slot_index, slot in enumerate(original)
            if slot_index not in taken and slot_key(slot) == slot_key(entry)
        ]
        slot = candidates[0] if candidates else original[min(index, len(original) - 1)]
        problem = species_problem(entry[1], similar_bst(slot[1][6]))
        problems.append(
            f"for {slot[1][0]} (BST {slot[1][6]}): "
            f"{problem or entry[1][0] + ' has no free slot of its chance and levels'}"
        )
    return problems


def mark_all(result: CheckResult, label: str, problems: list[str], total: int) -> None:
    shown = "; ".join(problems[:SHOWN])
    result.mark(
        not problems,
        f"{label}: {total - len(problems)} of {total} hold{', ' + shown if shown else ''}",
    )


def note_species(result: CheckResult, label: str, facts: list[list[Any]]) -> None:
    ids = [fact[0] for fact in facts]
    forms = sorted({fact[0] for fact in facts if fact[2] != 0})
    result.note(
        f"{label}: {len(set(ids))} distinct species in {len(ids)}; "
        f"non-zero forms: {', '.join(forms) or 'none'}"
    )


def check_random_species(live: Live, result: CheckResult) -> None:
    rules = random_ready(live, result)
    if rules is None:
        return
    for badges in RANDOM_SPECIES_BADGES:
        batches = RANDOM_SPECIES_BATCHES if badges == 0 else 1
        drawn: list[list[Any]] = []
        for _ in range(batches):
            source = ruby(
                RANDOM_SPECIES_BATCH,
                BADGES=badges,
                COUNT=RANDOM_BATCH,
                SPECIES=RANDOM_SPECIES,
                LEVEL=RANDOM_LEVEL,
            )
            drawn.extend(eval_data(live, source))
        facts = [entry[0] for entry in drawn]
        window = bst_window(badges)
        problems = [p for fact in facts if (p := species_problem(fact, window)) is not None]
        mark_all(
            result,
            f"Pokemon.new(:{RANDOM_SPECIES}) at {badges} badges, BST {window[0]}-{window[1]}",
            problems,
            len(facts),
        )
        kept = sum(1 for entry in drawn if not entry[1])
        result.note(f"{kept} of {len(drawn)} kept {RANDOM_SPECIES} (randomized? false)")
        note_species(result, f"at {badges} badges", facts)


def learnset_problems(rules: RandomRules, mon: dict[str, Any]) -> list[str]:
    species = mon["sp"][0]
    learnset = mon["learnset"]
    problems: list[str] = []
    if [entry[0] for entry in learnset] != mon["levels"]:
        problems.append(f"{species} learnset levels {[e[0] for e in learnset]} vs {mon['levels']}")
    names = [entry[1] for entry in learnset]
    if len(set(names)) != len(names):
        problems.append(f"{species} learnset repeats a move")
    for level, *move in learnset:
        problem = rules.move_problem(move, rules.badges_for_level(level))
        if problem is not None:
            problems.append(f"{species} level {level}: {problem}")
    return problems


def picked_as_damaging(move: list[Any]) -> bool:
    return bool(move[3]) or move[1] >= DAMAGING_PICK_POWER


def moveset_problems(rules: RandomRules, mon: dict[str, Any]) -> list[str]:
    species = mon["sp"][0]
    learned = {entry[1] for entry in mon["learnset"] if entry[0] <= mon["level"]}
    moves = mon["moves"]
    extra = [move for move in moves if move[0] not in learned]
    problems: list[str] = []
    if len(extra) > 1:
        problems.append(f"{species} knows {[m[0] for m in extra]} from outside its learnset")
    for move in extra:
        problem = rules.move_problem(move, rules.badges)
        if problem is not None or not picked_as_damaging(move):
            problems.append(f"{species} added {move[0]}: {problem or 'not damaging'}")
    if moves and not any(move[3] for move in moves) and not any(map(picked_as_damaging, extra)):
        problems.append(f"{species} has no damaging move: {[m[0] for m in moves]}")
    return problems


def check_random_starters(live: Live, result: CheckResult) -> None:
    rules = random_rules(live, result)
    if rules is None:
        return
    starters = eval_data(live, ruby(RANDOM_STARTERS, VARIABLES=list(STARTER_VARIABLES)))
    families: list[str] = []
    for variable, mon in zip(STARTER_VARIABLES, starters, strict=True):
        species, generation = mon["sp"][0], mon["sp"][4]
        result.note(
            f"variable {variable}: {species} level {mon['level']}, generation {generation}, "
            f"{mon['family']} evolutions in its family, moves {[m[0] for m in mon['moves']]}, "
            f"ability {mon['ability']}"
        )
        result.expect(f"{species} in the species allow-list", species in ALLOWED_SPECIES, True)
        outside = sorted(set(mon["family_species"]) - ALLOWED_SPECIES)
        result.expect(f"{species} family members outside the allow-list", outside, [])
        result.expect(f"{species} is its family's first stage", mon["first"], True)
        result.expect(f"{species} family has two or more evolutions", mon["family"] >= 2, True)
        result.expect(f"{species} evolves one way", mon["from_it"], 1)
        result.expect(f"{species} level", mon["level"], RANDOM_LEVEL)
        result.expect(f"{species} randomized?", mon["randomized"], True)
        result.expect(
            f"{species} ability from the table", mon["ability"] in (mon["abilities"] or []), True
        )
        problems = learnset_problems(rules, mon) + moveset_problems(rules, mon)
        mark_all(result, f"{species} learnset and moves", problems, 1)
        families.append(",".join(sorted(mon["family_species"])))
    result.expect("three different families", len(set(families)), len(STARTER_VARIABLES))


def check_random_learnsets(live: Live, result: CheckResult) -> None:
    rules = random_ready(live, result)
    if rules is None:
        return
    mons: list[dict[str, Any]] = []
    for _ in range(RANDOM_LEARNSET_BATCHES):
        source = ruby(
            RANDOM_FULL_BATCH,
            BADGES=rules.badges,
            COUNT=RANDOM_BATCH,
            SPECIES=RANDOM_SPECIES,
            LEVELS=RANDOM_LEARNSET_LEVELS,
        )
        mons.extend(eval_data(live, source))
    learnsets = [p for mon in mons for p in learnset_problems(rules, mon)]
    mark_all(
        result,
        "learnsets: levels kept, no repeats, OHKO, blacklist or badge-window break",
        learnsets,
        len(mons),
    )
    movesets = [p for mon in mons for p in moveset_problems(rules, mon)]
    mark_all(result, "creation movesets: from the learnset, one damaging move", movesets, len(mons))
    windows: dict[int, int] = {}
    for mon in mons:
        for level, *_ in mon["learnset"]:
            badges = rules.badges_for_level(level)
            windows[badges] = windows.get(badges, 0) + 1
    result.note(f"learnset entries by badge window: {dict(sorted(windows.items()))}")
    added = sum(
        1
        for mon in mons
        for move in mon["moves"]
        if move[0] not in {e[1] for e in mon["learnset"] if e[0] <= mon["level"]}
    )
    result.note(f"{added} of {len(mons)} Pokémon got a damaging move from outside their learnset")
    early = [
        e
        for mon in mons
        for e in mon["learnset"]
        if rules.badges_for_level(e[0]) < EARLY_GAME_BADGES
    ]
    result.note(f"strongest early-window move power: {max((e[2] for e in early), default=None)}")


def check_random_abilities(live: Live, result: CheckResult) -> None:
    if random_ready(live, result) is None:
        return
    table = eval_data(
        live,
        ruby(
            RANDOM_ABILITY_TABLE,
            LAST_ABILITY=RANDOM_LAST_GEN5_ABILITY,
        ),
    )
    result.expect("species without a table entry", table["missing"], 0)
    result.expect("excluded abilities in the table", table["excluded_used"], [])
    result.expect(
        "table abilities outside the allow-list",
        sorted(set(table["used_list"]) - ALLOWED_ABILITIES),
        [],
    )
    result.note(
        f"{table['species']} species; {table['used']} of {table['abilities']} abilities used "
        f"({table['excluded']} excluded); {table['past_last']} past TERAVOLT; "
        f"{table['same_as_real']} species keep their real abilities; "
        f"{table['same_shape']} keep the number of abilities"
    )
    astray = table["astray"]
    mark_all(
        result,
        "species answering their table entry",
        [str(species) for species in astray],
        table["species"] - len(table["kept"]),
    )
    for species, kept in table["kept"]:
        result.expect(f"{species} keeps its real abilities", kept, True)
    mons = eval_data(
        live,
        ruby(RANDOM_BRIEF_BATCH, COUNT=RANDOM_BATCH, SPECIES=RANDOM_SPECIES, LEVEL=RANDOM_LEVEL),
    )
    problems = [
        f"{mon['sp'][0]} has {mon['ability']}, table {mon['abilities']}"
        for mon in mons
        if mon["ability"] not in (mon["abilities"] or [])
    ] + [
        f"{mon['sp'][0]} has {mon['ability']}, not in the ability allow-list"
        for mon in mons
        if mon["ability"] not in ALLOWED_ABILITIES
    ]
    mark_all(
        result, "abilities of new Pokémon from their species' table entry", problems, len(mons)
    )


def trainer_problems(rules: RandomRules, trainer: dict[str, Any], badges: int) -> list[str]:
    key = "/".join(str(part) for part in trainer["key"])
    problems: list[str] = []
    if not trainer["same"]:
        problems.append(f"{key} loaded twice differently")
    pbs, party = trainer["pbs"], trainer["party"]
    if len(pbs) != len(party):
        problems.append(f"{key} has {len(party)} Pokémon, PBS {len(pbs)}")
    window = bst_window(badges)
    for (_, _, item, mega), mon in zip(pbs, party, strict=False):
        species = mon["sp"][0]
        problem = species_problem(mon["sp"], None if mega else window)
        if problem is not None:
            problems.append(f"{key} {problem}")
        if mon["ability"] not in (mon["abilities"] or []):
            problems.append(f"{key} {species} ability {mon['ability']} not from the table")
        if mon["ability"] not in ALLOWED_ABILITIES:
            problems.append(f"{key} {species} ability {mon['ability']} not in the allow-list")
        held = mon["item"]
        if item is None and held is not None:
            problems.append(f"{key} {species} holds {held[0]}, PBS none")
        if item is not None and not mega and (held is None or any(held[1:])):
            problems.append(f"{key} {species} holds {held}, for PBS {item}")
        if mega and (held is None or not held[3]):
            problems.append(f"{key} {species} lost the mega stone {item}: {held}")
        moves = mon["moves"]
        names = [move[0] for move in moves]
        if len(set(names)) != len(names) or len(names) > 4:
            problems.append(f"{key} {species} moves {names}")
        for move in moves:
            problem = rules.move_problem(move, badges)
            if problem is not None:
                problems.append(f"{key} {species}: {problem}")
        if moves and not any(move[3] for move in moves) and not picked_as_damaging(moves[0]):
            problems.append(f"{key} {species} has no damaging move: {names}")
    return problems


def check_random_trainers(live: Live, result: CheckResult) -> None:
    rules = random_rules(live, result)
    if rules is None:
        return
    keys = eval_data(
        live, ruby(RANDOM_TRAINER_PICK, EVERY=RANDOM_TRAINER_EVERY, HELD=RANDOM_TRAINER_HELD)
    )
    early, late = keys[:-RANDOM_LATE_TRAINERS], keys[-RANDOM_LATE_TRAINERS:]
    trainers: list[dict[str, Any]] = []
    for start in range(0, len(early), RANDOM_TRAINER_BATCH):
        batch = early[start : start + RANDOM_TRAINER_BATCH]
        source = ruby(RANDOM_TRAINERS, BADGES=rules.badges, KEYS=json.dumps(batch))
        trainers.extend(eval_data(live, source))
    late_trainers = eval_data(
        live, ruby(RANDOM_TRAINERS, BADGES=RANDOM_LATE_BADGES, KEYS=json.dumps(late))
    )
    fresh = [t for t in trainers if not t["stored"]]
    late_fresh = [t for t in late_trainers if not t["stored"]]
    result.note(
        f"{len(trainers)} trainers at {rules.badges} badges ({len(fresh)} not stored before), "
        f"{len(late_trainers)} at {RANDOM_LATE_BADGES} badges ({len(late_fresh)} not stored before)"
    )
    for badges, group in ((rules.badges, fresh), (RANDOM_LATE_BADGES, late_fresh)):
        problems = [p for t in group for p in trainer_problems(rules, t, badges)]
        party = sum(len(t["party"]) for t in group)
        mark_all(result, f"trainer Pokémon at {badges} badges", problems, party)
    same = [t for t in trainers + late_trainers if not t["same"]]
    result.expect("trainers loading differently the second time", len(same), 0)
    mons = [
        (pbs, mon)
        for t in fresh + late_fresh
        for pbs, mon in zip(t["pbs"], t["party"], strict=False)
    ]
    changed = sum(1 for pbs, mon in mons if pbs[0] != mon["sp"][0])
    levels = sorted({(pbs[1], mon["level"]) for pbs, mon in mons if pbs[1] != mon["level"]})
    result.note(
        f"{len(mons) - sum(1 for pbs, mon in mons if pbs[1] != mon['level'])} of {len(mons)} kept "
        f"their PBS level; changed (PBS, loaded): {levels}"
    )
    held = [(pbs, mon) for pbs, mon in mons if pbs[2] is not None]
    result.note(
        f"{changed} of {len(mons)} trainer Pokémon changed species; {len(held)} held a PBS item, "
        f"now {', '.join(f'{pbs[2]}->{mon["item"][0] if mon["item"] else None}' for pbs, mon in held[:SHOWN])}"
    )


def check_random_tms(live: Live, result: CheckResult) -> None:
    rules = random_ready(live, result)
    if rules is None:
        return
    marts = eval_data(live, ruby(RANDOM_TM_MART_SOURCE, MARTS=RANDOM_TM_MARTS))
    stocks = [[entry[0] for entry in stock] for stock in marts["first"]]
    result.expect("TM mart stock asked again", [[e[0] for e in s] for s in marts["again"]], stocks)
    moved = [
        f"{a[0]} {a[2]}->{b[2]}"
        for first, again in zip(marts["first"], marts["again"], strict=True)
        for a, b in zip(first, again, strict=True)
        if a[2] != b[2]
    ]
    result.note(f"TM moves changed between the two asks: {', '.join(moved) or 'none'}")
    moves: list[str] = []
    for (mart, amount), existed, stock in zip(
        RANDOM_TM_MARTS, marts["existed"], marts["first"], strict=True
    ):
        result.note(
            f"tm_mart({mart}, {amount}) {'cached' if existed else 'new'}: "
            + ", ".join(f"{entry[0]} {entry[2]} ({entry[3]})" for entry in stock)
        )
        result.expect(f"tm_mart({mart}) all TMs", all(entry[1] for entry in stock), True)
        result.mark(
            0 < len(stock) <= amount, f"tm_mart({mart}) holds {len(stock)} of up to {amount}"
        )
        if not existed:
            problems = [p for entry in stock if (p := rules.move_problem(entry[2:], rules.badges))]
            mark_all(result, f"tm_mart({mart}) moves", problems, len(stock))
        moves.extend(entry[2] for entry in stock)
    result.expect("TM moves repeated across the marts", len(moves) - len(set(moves)), 0)
    result.expect("TM moves among the given TM moves", set(moves) <= set(marts["given"]), True)
    compat = eval_data(
        live,
        ruby(
            RANDOM_COMPAT,
            EVERY=RANDOM_COMPAT_MOVES_EVERY,
            STAB=RANDOM_COMPAT_SAME_TYPE,
            COUNT=RANDOM_COMPAT_POKEMON,
            SPECIES=RANDOM_SPECIES,
            LEVEL=RANDOM_LEVEL,
        ),
    )
    pairs = compat["pairs"]
    result.expect(
        "compatibility answers the same when asked again",
        compat["again"] == [p[4] for p in pairs],
        True,
    )
    result.expect("compatibility file matches the table", compat["file_matches"], True)
    result.note(f"compatibility file {compat['file']}")
    for stab, rate in ((True, STAB_COMPAT_RATE), (False, OTHER_COMPAT_RATE)):
        fresh = [p[4] for p in pairs if p[2] == stab and p[3]]
        seen = sum(fresh) / len(fresh) if fresh else 0.0
        label = "same-type" if stab else "other-type"
        result.mark(
            abs(seen - rate) <= COMPAT_RATE_SLACK,
            f"{label} compatibility {sum(fresh)} of {len(fresh)} new answers ({seen:.2f}, expected about {rate})",
        )


def open_event_mart(live: Live, mart: dict[str, Any]) -> tuple[list[list[str]], str | None]:
    map_id, event_id = mart["key"].split("/")
    eval_inspect(
        live.session,
        RANDOM_MART_RUN.format(
            map_id=map_id, event_id=event_id, page=mart["page"], start=mart["from"], end=mart["to"]
        ),
    )
    live.driver.advance(SCRIPT_START_TICKS)
    live.driver.advance(SCRIPT_PAYLOAD_TICKS, until=["payloads"])
    opened = continue_dialog(live.driver, [MART_BUY])
    if opened.outcome != "handoff":
        return [], f"choosing to buy ended {opened.outcome}"
    wait_mart_item(live)
    shown = eval_data(live, RANDOM_MART_SHOWN.format(scene=MART_SCENE, name=MART_ITEMS, visible=""))
    wait_frame(live, MART_CHOOSING, MART_PAUSED)
    live.driver.advance(1, [buttons("B")])
    live.driver.advance(PRESS_GAP_TICKS)
    left = continue_dialog(live.driver, [MART_LEAVE])
    if left.outcome != "finished" or not wait_script_done(live):
        return shown, f"leaving ended {left.outcome}"
    return shown, None


def check_random_marts(live: Live, result: CheckResult) -> None:
    scan = eval_data(live, RANDOM_MART_SCAN)
    result.expect("events calling tm_mart", scan["tm_events"], RANDOM_TM_MART_EVENTS)
    result.expect("events calling setPrice", scan["priced"], [])
    marts = [mart for mart in scan["marts"] if mart["key"] not in RANDOM_TM_MART_EVENTS]
    result.note(
        f"{len(scan['marts'])} pbPokemonMart blocks in the map data; "
        f"{len(scan['marts']) - len(marts)} in the TM-mart events left out"
    )
    missing = [f"{mart['key']}: {mart['missing']}" for mart in marts if mart["missing"]]
    result.expect("stock items missing from the item data", missing, [])
    before = eval_data(live, RANDOM_MART_HOLDINGS)
    problems: list[str] = []
    for mart in marts:
        shown, problem = open_event_mart(live, mart)
        expected = [list(pair) for pair in zip(mart["items"], mart["prices"], strict=True)]
        label = f"{mart['key']} page {mart['page'] + 1}"
        if problem is not None:
            problems.append(f"{label}: {problem}")
        elif shown != expected:
            problems.append(f"{label}: shown {shown}, map data {expected}")
        if mart["key"] in RANDOM_WATCHED_MARTS:
            result.note(f"{label} ({RANDOM_WATCHED_MARTS[mart['key']]}): {shown}")
    mark_all(
        result,
        "marts opened showing the map data's stock at item-data prices",
        problems,
        len(marts),
    )
    result.expect("money and bag after", eval_data(live, RANDOM_MART_HOLDINGS), before)


def item_problem(item: list[Any] | None, *, machines: bool) -> str | None:
    if item is None:
        return None
    flags = ("key item", "HM", "mega stone", "mail", "snag ball", "blacklisted", "machine")
    bad = [
        flag
        for flag, on in zip(flags, item[1:], strict=True)
        if on and (flag != "machine" or not machines)
    ]
    return f"{item[0]} is {', '.join(bad)}" if bad else None


def check_random_items(live: Live, result: CheckResult) -> None:
    rules = random_ready(live, result)
    if rules is None:
        return
    source = ruby(
        RANDOM_ITEMS,
        COUNT=RANDOM_ITEM_DRAWS,
        ORIGINAL=RANDOM_ITEM,
        KEPT=RANDOM_KEPT_ITEMS.strip(),
        GIFTS=RANDOM_GIFTS,
        SPECIES=RANDOM_SPECIES,
        LEVEL=RANDOM_LEVEL,
    )
    data = eval_data(live, source)
    draws = data["draws"]
    problems = [p for item, _ in draws if (p := item_problem(item, machines=True))]
    mark_all(result, f"determine_random_item(:{RANDOM_ITEM}) draws", problems, len(draws))
    tms = [move for item, move in draws if move is not None]
    tm_problems = [p for move in tms if (p := rules.move_problem(move, rules.badges))]
    mark_all(result, "moves given to drawn TMs", tm_problems, len(tms))
    result.expect("drawn TM moves repeated", len(tms) - len({m[0] for m in tms}), 0)
    result.expect("given TM moves added", data["given_after"] - data["given_before"], len(tms))
    kept_items = sum(1 for item, _ in draws if item[0] == RANDOM_ITEM)
    result.note(
        f"{len({item[0] for item, _ in draws})} distinct items in {len(draws)}; {len(tms)} TMs; "
        f"{kept_items} {RANDOM_ITEM}"
    )
    for original, drawn in data["kept"]:
        result.expect(f"determine_random_item(:{original})", drawn, original)
    before = {mart: dict(stock) for mart, stock in data["marts_before"]}
    after = {mart: dict(stock) for mart, stock in data["marts_after"]}
    moved = [
        f"{tm} {before[m][tm]}->{after[m][tm]}"
        for m in before
        for tm in before[m]
        if after[m][tm] != before[m][tm]
    ]
    result.note(f"TM mart TMs whose move changed after the draws: {', '.join(moved) or 'none'}")
    gifts = data["gifts"]
    held = [item for _, item in gifts if item is not None]
    gift_problems = [p for item in held if (p := item_problem(item, machines=False))]
    mark_all(result, "gift Pokémon held items", gift_problems, len(held))
    rate = len(held) / len(gifts)
    result.mark(
        abs(rate - GIFT_ITEM_RATE) <= COMPAT_RATE_SLACK,
        f"gift Pokémon holding an item: {len(held)} of {len(gifts)} ({rate:.2f}, expected about {GIFT_ITEM_RATE})",
    )
    gift_species = [species for species, _ in gifts]
    species_problems = [
        p for fact in gift_species if (p := species_problem(fact, bst_window(rules.badges)))
    ]
    mark_all(result, "gift Pokémon species", species_problems, len(gift_species))


def check_random_wild(live: Live, result: CheckResult) -> None:
    rules = random_rules(live, result)
    if rules is None:
        return
    transfer(live, RANDOM_WILD_MAP, RANDOM_WILD_TILE, FACING_DOWN)
    source = ruby(
        RANDOM_WILD,
        MAP=RANDOM_WILD_MAP,
        TYPE=RANDOM_WILD_TYPE,
        COUNT=RANDOM_WILD_DRAWS,
        SPECIES=RANDOM_SPECIES,
        LEVEL=RANDOM_LEVEL,
    )
    data = eval_data(live, source)
    result.expect("map", data["map"], RANDOM_WILD_MAP)
    original, table = data["original"], data["table"]
    result.note(f"table {'cached before' if data['existed'] else 'made by the first draw'}")
    result.note("original: " + ", ".join(f"{e[1][0]} {e[0]}% {e[2]}-{e[3]}" for e in original))
    result.note("random:   " + ", ".join(f"{e[1][0]} {e[0]}% {e[2]}-{e[3]}" for e in table))
    result.expect("table slots", len(table), len(original))
    result.expect(
        "chances and levels kept",
        sorted(list(slot_key(e)) for e in table),
        sorted(list(slot_key(e)) for e in original),
    )
    moved = sorted(
        f"{table[t][1][0]} to {original[s][1][0]}"
        for t, s in match_slots(original, table).items()
        if t != s
    )
    result.note(f"species matched to a slot at another position: {', '.join(moved) or 'none'}")
    mark_all(
        result,
        "random slots: valid species within 12% of their original slot's BST",
        random_slot_problems(original, table),
        len(table),
    )
    species = {entry[1][0] for entry in table}
    bases = {entry[1][0]: entry[1][1] for entry in table}
    draws = data["draws"]
    outside = [d for d in draws if d[0] not in species or d[2] != bases[d[0]] or d[3] != d[1]]
    mark_all(
        result,
        "wild Pokémon generated from the table, base species and level kept",
        [str(d[:4]) for d in outside],
        len(draws),
    )
    seen = sorted({d[0] for d in draws})
    result.note(f"{len(seen)} of {len(species)} table species drawn: {', '.join(seen)}")
    held = [d for d in draws if d[4] is not None]
    item_problems = [p for d in held if (p := item_problem(d[4], machines=False))]
    mark_all(result, "wild held items", item_problems, len(held))
    own = sum(1 for d in held if d[4][0] in d[5])
    could = sum(1 for d in draws if d[5])
    result.note(
        f"{len(held)} of {len(draws)} held an item ({could} of species with wild items); {own} held one of their species' own"
    )
    result.expect("random species paused after the draws", data["paused"], True)
    result.expect(f"Pokemon.new(:{RANDOM_SPECIES}) after the draws", data["after"], RANDOM_SPECIES)
    transfer(live, RANDOM_OTHER_MAP, RANDOM_OTHER_TILE, FACING_DOWN)
    transfer(live, RANDOM_WILD_MAP, RANDOM_WILD_TILE, FACING_DOWN)
    again = eval_data(live, ruby(RANDOM_WILD_TABLE, MAP=RANDOM_WILD_MAP, TYPE=RANDOM_WILD_TYPE))
    result.expect(
        f"table after leaving for map {RANDOM_OTHER_MAP} and coming back",
        [e[1] for e in again],
        [e[1][0] for e in table],
    )


def check_random_reload(live: Live, result: CheckResult) -> None:
    if random_rules(live, result) is None:
        return
    session = live.session
    fingerprint = ruby(RANDOM_FINGERPRINT, VARIABLES=list(STARTER_VARIABLES))
    use = ruby(
        RANDOM_USE, TYPE=RANDOM_WILD_TYPE, COUNT=RANDOM_USE_DRAWS, ABILITIES=RANDOM_USE_ABILITIES
    )
    saved = eval_data(live, fingerprint)
    result.note(
        f"encounter tables for maps {saved['encounter_maps']}, {saved['trainer_count']} trainer teams, "
        f"{len(saved['marts'])} TM marts, {len(saved['tm_moves'])} TM moves, "
        f"{saved['learnset_species']} learnsets, {saved['compat_species']} species' TM compatibility"
    )
    name = f"{RANDOM_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    taken = save_snapshot(session, name)
    result.note(f"saved {name} at tick {taken.value.tick}")
    for reload in range(1, RANDOM_RELOADS + 1):
        eval_inspect(session, RANDOM_PERTURB)
        cleared = eval_data(live, fingerprint)
        result.mark(cleared != saved, f"reload {reload}: caches cleared before the restore")
        restored = restore_snapshot(session, name)
        result.expect(f"reload {reload}: snapshot tick", restored.value.tick, taken.value.tick)
        back = eval_data(live, fingerprint)
        differs = sorted(key for key in saved if back.get(key) != saved[key])
        result.expect(f"reload {reload}: fields differing from the saved caches", differs, [])
        used = eval_data(live, use)
        table = set(used["encounter_species"])
        result.expect(
            f"reload {reload}: wild draws outside the table",
            [s for s in used["wild"] if s not in table],
            [],
        )
        for key in ("trainers", "marts", "compat", "abilities"):
            answers = used[key]
            result.expect(
                f"reload {reload}: {key} answering as stored ({len(answers)})", all(answers), True
            )
    restore_snapshot(session, name)


EVOLUTION_LIST = """
GameData::Species.keys.filter_map { |k| s = GameData::Species.get(k)
  e = s.get_evolutions(true).reject { |x| x[3] }.map { |x| [x[0], x[1], x[2].is_a?(Integer) ? x[2] : x[2].to_s] }
  [k, e] unless e.empty? }
"""
EVOLUTION_TRY = """
gr = GameData::GrowthRate.singleton_class; bypass = $game_switches[BYPASS]
gr.send(:alias_method, :anil_check_max_level, :max_level)
begin
  gr.send(:define_method, :max_level) { LEVEL }
  $game_switches[BYPASS] = true
  CASES.map { |k, target, method, param|
    sd = GameData::Species.get(k.to_sym); pk = Pokemon.new(sd.species, LEVEL, $player, false, true, false)
    pk.form_simple = sd.form if sd.form != 0
    param = param.to_sym if param.is_a?(String) && !param.empty?
    ev = GameData::Evolution.get(method.to_sym)
    lv = !!(ev.call_level_up(pk, param) rescue nil)
    item = param.is_a?(Symbol) && GameData::Item.exists?(param)
    used = item && !!(ev.call_use_item(pk, param, param) rescue nil)
    [k, target, method, param.to_s, pk.level, lv, used,
     lv ? pk.check_evolution_on_level_up&.to_s : nil, used ? pk.check_evolution_on_use_item(param)&.to_s : nil] }
ensure
  gr.send(:alias_method, :max_level, :anil_check_max_level); gr.send(:remove_method, :anil_check_max_level)
  $game_switches[BYPASS] = bypass
end
"""
EVOLUTION_LEVEL = 100
EVOLUTION_NONE = "None"
EVOLUTION_CONTROL_EVERY = 12
MEGA_SNAPSHOT_PREFIX = "check-megas-"
MEGA_RING_FLAG = "MegaRing"
MEGA_LEAD_SPECIES = "VENUSAUR"
MEGA_LEAD_STONE = "VENUSAURITEX"
MEGA_LEAD_MOVE = "EMBER"
MEGA_FOE_MOVE = "SPLASH"
MEGA_RING = "MEGARING"
MEGA_ABILITY = "RUNAWAY"
MEGA_TRAINER_VAR = "$anil_check_trainer"
MEGA_SETUP = f"""
ring = lambda {{ |i| GameData::Item.get(i).has_flag?("{MEGA_RING_FLAG}") }}
stone = lambda {{ |i| i && GameData::Item.get(i).is_mega_stone? }}
key = GameData::Trainer.keys.find {{ |k| d = GameData::Trainer.get(*k); (d.items || []).any? {{ |i| ring.call(i) }} && d.pokemon.any? {{ |p| stone.call(p[:item]) }} }}
t = pbLoadTrainer(*key); h = t.party.find {{ |p| stone.call(p.item_id) }}
pbs = GameData::Trainer.get(*key).pokemon.find {{ |p| stone.call(p[:item]) }}
info = {{ "key" => key.map(&:to_s), "pbs" => [pbs[:species].to_s, pbs[:item].to_s], "party" => t.party.map {{ |p| [p.species_data.id.to_s, p.item_id.to_s] }} }}
if h
  t.party.replace([h]); t.items.replace(t.items.select {{ |i| ring.call(i) }})
  h.ability = :{MEGA_ABILITY}; h.forget_all_moves; h.learn_move(:{MEGA_FOE_MOVE}); h.hp = 1
  x = Pokemon.new(:{MEGA_LEAD_SPECIES}, CAP, $player, true, true, false); x.ability = :{MEGA_ABILITY}
  x.item = :{MEGA_LEAD_STONE}; x.forget_all_moves; x.learn_move(:{MEGA_LEAD_MOVE}); x.heal
  $player.party.replace([x]); $bag.add(:{MEGA_RING})
  {MEGA_TRAINER_VAR} = t
  info.merge!("foe" => [h.species_data.id.to_s, h.item_id.to_s, h.hasMegaForm?, h.level], "rings" => t.items.map(&:to_s),
    "lead" => [x.species_data.id.to_s, x.item_id.to_s, x.hasMegaForm?, x.level])
end
info
"""
MEGA_BATTLE_SCRIPT = f"TrainerBattle.start_core({MEGA_TRAINER_VAR})"
MEGA_ASK = f"""
b = AnilBridge.battle; was = $game_switches[{NO_MEGA_SWITCH}]
ask = lambda {{ [0, 1].map {{ |i| b.pbCanMegaEvolve?(i) }} }}
begin
  on = ask.call; $game_switches[{NO_MEGA_SWITCH}] = false; off = ask.call
ensure
  $game_switches[{NO_MEGA_SWITCH}] = was
end
{{ "on" => on, "off" => off, "switch" => $game_switches[{NO_MEGA_SWITCH}],
  "battlers" => [0, 1].map {{ |i| x = b.battlers[i]; [x.pokemon.species_data.id.to_s, x.item_id.to_s, x.hasMega?, x.mega?] }} }}
"""
MEGA_AFTER = (
    f"p = $player.party[0]; [p.species_data.id.to_s, p.form, p.mega?, "
    f"{MEGA_TRAINER_VAR}.party.map {{ |x| [x.species_data.id.to_s, x.form, x.mega?] }}]"
)
MEGA_SEEN_WORDS = ("megaevol", "irradia energía")
BATTLE_SNAPSHOT_PREFIX = "check-battle-"
BATTLE_GENERATION = 9
BATTLE_SETTINGS = {
    "MECHANICS_GENERATION": BATTLE_GENERATION,
    "NEW_CRITICAL_HIT_RATE_MECHANICS": True,
    "MORE_TYPE_EFFECTS": True,
    "FIXED_DURATION_WEATHER_FROM_ABILITY": True,
    "HAIL_WEATHER_TYPE": 1,
    "FREEZE_EFFECTS_CAUSE_FROSTBITE": False,
}
BATTLE_CRIT_RATIOS = [24, 8, 2, 1]
BATTLE_FAIRY_SPECIES = {"CLEFAIRY": ["FAIRY"], "TOGEPI": ["FAIRY"]}
BATTLE_FAIRY_MOVES = {"CHARM": "FAIRY", "MOONLIGHT": "FAIRY", "SWEETKISS": "FAIRY"}
BATTLE_TYPE_CHART = {
    "NORMAL": ((), ("ROCK", "STEEL"), ("GHOST",)),
    "FIGHTING": (
        ("NORMAL", "ICE", "ROCK", "DARK", "STEEL"),
        ("POISON", "FLYING", "PSYCHIC", "BUG", "FAIRY"),
        ("GHOST",),
    ),
    "FLYING": (("GRASS", "FIGHTING", "BUG"), ("ELECTRIC", "ROCK", "STEEL"), ()),
    "POISON": (("GRASS", "FAIRY"), ("POISON", "GROUND", "ROCK", "GHOST"), ("STEEL",)),
    "GROUND": (("FIRE", "ELECTRIC", "POISON", "ROCK", "STEEL"), ("GRASS", "BUG"), ("FLYING",)),
    "ROCK": (("FIRE", "ICE", "FLYING", "BUG"), ("FIGHTING", "GROUND", "STEEL"), ()),
    "BUG": (
        ("GRASS", "PSYCHIC", "DARK"),
        ("FIRE", "FIGHTING", "POISON", "FLYING", "GHOST", "STEEL", "FAIRY"),
        (),
    ),
    "GHOST": (("PSYCHIC", "GHOST"), ("DARK",), ("NORMAL",)),
    "STEEL": (("ICE", "ROCK", "FAIRY"), ("FIRE", "WATER", "ELECTRIC", "STEEL"), ()),
    "FIRE": (("GRASS", "ICE", "BUG", "STEEL"), ("FIRE", "WATER", "ROCK", "DRAGON"), ()),
    "WATER": (("FIRE", "GROUND", "ROCK"), ("WATER", "GRASS", "DRAGON"), ()),
    "GRASS": (
        ("WATER", "GROUND", "ROCK"),
        ("FIRE", "GRASS", "POISON", "FLYING", "BUG", "DRAGON", "STEEL"),
        (),
    ),
    "ELECTRIC": (("WATER", "FLYING"), ("ELECTRIC", "GRASS", "DRAGON"), ("GROUND",)),
    "PSYCHIC": (("FIGHTING", "POISON"), ("PSYCHIC", "STEEL"), ("DARK",)),
    "ICE": (("GRASS", "GROUND", "FLYING", "DRAGON"), ("FIRE", "WATER", "ICE", "STEEL"), ()),
    "DRAGON": (("DRAGON",), ("STEEL",), ("FAIRY",)),
    "DARK": (("PSYCHIC", "GHOST"), ("FIGHTING", "DARK", "FAIRY"), ()),
    "FAIRY": (("FIGHTING", "DRAGON", "DARK"), ("FIRE", "POISON", "STEEL"), ()),
}
BATTLE_RESTORED_TYPES = {
    "ARBOK": ["POISON"],
    "GOLDUCK": ["WATER"],
    "CHIKORITA": ["GRASS"],
    "BAYLEEF": ["GRASS"],
    "MEGANIUM": ["GRASS"],
    "CYNDAQUIL": ["FIRE"],
    "QUILAVA": ["FIRE"],
    "TYPHLOSION": ["FIRE"],
    "FERALIGATR": ["WATER"],
    "SUNFLORA": ["GRASS"],
    "MISDREAVUS": ["GHOST"],
    "GRANBULL": ["FAIRY"],
    "STANTLER": ["NORMAL"],
    "SCEPTILE": ["GRASS"],
    "MASQUERAIN": ["BUG", "FLYING"],
    "SKITTY": ["NORMAL"],
    "DELCATTY": ["NORMAL"],
    "VOLBEAT": ["BUG"],
    "ILLUMISE": ["BUG"],
    "GLALIE": ["ICE"],
    "LUVDISC": ["WATER"],
    "LOPUNNY": ["NORMAL"],
    "MISMAGIUS": ["GHOST"],
    "SHAYMIN": ["GRASS"],
    "SERPERIOR": ["GRASS"],
    "PIGNITE": ["FIRE", "FIGHTING"],
    "EMBOAR": ["FIRE", "FIGHTING"],
    "SAMUROTT": ["WATER"],
    "GARBODOR": ["POISON"],
    "VANILLITE": ["ICE"],
    "VANILLISH": ["ICE"],
    "VANILLUXE": ["ICE"],
    "HEATMOR": ["FIRE"],
}
BATTLE_DATA = f"""
sp = lambda {{ |k| GameData::Species.get(k).types.map(&:to_s) }}
{{ "settings" => {list(BATTLE_SETTINGS)!r}.to_h {{ |n| [n, Settings.const_get(n)] }},
  "crit_ratios" => Battle::Move::CRITICAL_HIT_RATIOS,
  "fairy" => GameData::Type.exists?(:FAIRY),
  "fairy_name" => (GameData::Type.get(:FAIRY).name rescue nil),
  "species" => {[*BATTLE_FAIRY_SPECIES, *BATTLE_RESTORED_TYPES]!r}.to_h {{ |k| [k, sp.call(k.to_sym)] }},
  "moves" => {list(BATTLE_FAIRY_MOVES)!r}.to_h {{ |k| [k, GameData::Move.get(k.to_sym).type.to_s] }},
  "fairy_species" => GameData::Species.keys.select {{ |k| GameData::Species.get(k).types.include?(:FAIRY) }}.map(&:to_s),
  "fairy_moves" => GameData::Move.keys.select {{ |k| GameData::Move.get(k).type == :FAIRY }}.map(&:to_s),
  "types" => GameData::Type.keys.reject {{ |k| GameData::Type.get(k).pseudo_type }}.map(&:to_s),
  "chart" => {list(BATTLE_TYPE_CHART)!r}.to_h {{ |a| [a, {list(BATTLE_TYPE_CHART)!r}.to_h {{ |d| [d, Effectiveness.calculate(a.to_sym, d.to_sym)] }}] }},
  "snow_name" => GameData::BattleWeather.get(:Hail).name }}
"""
OFFICIAL_TYPES_DATA = """
RandomlockeAllowLists::SPECIES.to_h { |k| [k.to_s, GameData::Species.get(k).types.map(&:to_s)] }
"""
BATTLE_LEAD_SPECIES = "CHANSEY"
BATTLE_LEAD_MOVE = "TACKLE"
BATTLE_FOE_SPECIES = TEST_SPECIES
BATTLE_FOE_MOVE = "SPLASH"
BATTLE_PHYSICAL = "TACKLE"
BATTLE_SPECIAL = "SWIFT"
BATTLE_STAT = 999
BATTLE_SPEED = 200
BATTLE_SLEEP_DRAWS = 300
BATTLE_TOXIC_ROUNDS = 3
BATTLE_RATIO_SLACK = 0.03
BATTLE_PROBE = """
b = AnilBridge.battle; u = b.battlers[0]; t = b.battlers[1]; stubs = []
quiet = lambda { |o, names| names.each { |m| next unless o.respond_to?(m, true); o.define_singleton_method(m) { |*a, **k, &blk| nil }; stubs << [o, m] } }
fresh = lambda { |x| x.status = :NONE; x.statusCount = 0; x.effects[PBEffects::Toxic] = 0; x.hp = x.totalhp }
mod = lambda { |type, target| t.pbChangeTypes(target); m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(:PHYSICAL)); r = m.pbCalcTypeMod(type, u, t); t.pbChangeTypes(:NORMAL); r }
calc = lambda { |id, crit|
  m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id))
  m.define_singleton_method(:pbCritialOverride) { |*a| crit ? 1 : -1 }
  type = m.pbCalcType(u); m.instance_variable_set(:@calcType, type)
  t.damageState.reset; t.damageState.typeMod = m.pbCalcTypeMod(type, u, t)
  m.pbCalcDamage(u, t); t.damageState.calcDamage }
hit = lambda { |id, status| u.status = status; r = [calc.call(id, false), calc.call(id, true)]; u.status = :NONE; r }
eor = lambda { |status, count, rounds| fresh.call(u); u.status = status; u.statusCount = count
  r = (1..rounds).map { hp = u.hp; b.pbEORStatusProblemDamage([u]); hp - u.hp }; fresh.call(u); r }
weather = lambda { |w| b.field.weather = :None; b.field.weatherDuration = 0; b.pbStartWeatherAbility(w, u); d = b.field.weatherDuration
  b.field.weather = :None; b.field.weatherDuration = 0; d }
out = {}
begin
  quiet.call(b, %i[pbDisplay pbDisplayPaused pbDisplayBrief pbCommonAnimation pbAnimation pbShowAbilitySplash pbHideAbilitySplash pbReplaceAbilitySplash])
  quiet.call(b.scene, %i[pbHPChanged pbDamageAnimation pbCommonAnimation pbAnimation pbRefresh pbRefreshOne])
  [u, t].each { |x| x.ability = :RUNAWAY; x.item = nil; fresh.call(x); x.pbChangeTypes(:NORMAL) }
  out["sleep"] = (1..DRAWS).map { u.pbSleepDuration }.uniq.sort
  u.speed = SPEED; s = u.pbSpeed; u.status = :PARALYSIS; out["speed"] = [s, u.pbSpeed]; fresh.call(u)
  out["paralysis"] = [t.pbCanParalyze?(u, false), (t.pbChangeTypes(:ELECTRIC); t.pbCanParalyze?(u, false))]
  t.pbChangeTypes(:NORMAL)
  out["freeze"] = [t.pbCanFreeze?(u, false), (t.pbFreeze; t.status.to_s), (fresh.call(t); t.pbChangeTypes(:ICE); t.pbCanFreeze?(u, false))]
  fresh.call(t); t.pbChangeTypes(:NORMAL)
  out["hp"] = u.totalhp
  out["eor"] = { "BURN" => eor.call(:BURN, 0, 1), "POISON" => eor.call(:POISON, 0, 1),
    "TOXIC" => eor.call(:POISON, 1, ROUNDS), "FROZEN" => eor.call(:FROZEN, 0, 1) }
  b.define_singleton_method(:pbRandom) { |x| x - 1 }; stubs << [b, :pbRandom]
  u.attack = STAT; u.spatk = STAT
  out["damage"] = { "physical" => hit.call(:PHYSICAL, :NONE), "physical burned" => hit.call(:PHYSICAL, :BURN),
    "physical frozen" => hit.call(:PHYSICAL, :FROZEN), "special" => hit.call(:SPECIAL, :NONE),
    "special burned" => hit.call(:SPECIAL, :BURN), "special frozen" => hit.call(:SPECIAL, :FROZEN) }
  t.pbChangeTypes(:ICE); clear = calc.call(:PHYSICAL, false); b.field.weather = :Hail; snowy = calc.call(:PHYSICAL, false)
  out["snow"] = [clear, snowy, u.takesHailDamage?, t.takesHailDamage?]; b.field.weather = :None; t.pbChangeTypes(:NORMAL)
  out["weather"] = %i[Rain Sun Sandstorm Hail].to_h { |w| [w.to_s, weather.call(w)] }
  out["type_mods"] = { "FAIRY>DRAGON" => mod.call(:FAIRY, :DRAGON), "FAIRY>STEEL" => mod.call(:FAIRY, :STEEL),
    "GHOST>STEEL" => mod.call(:GHOST, :STEEL), "DARK>STEEL" => mod.call(:DARK, :STEEL) }
ensure
  stubs.reverse_each { |o, m| o.singleton_class.send(:remove_method, m) }
  [u, t].each { |x| fresh.call(x); x.pbResetTypes }
  b.field.weather = :None; b.field.weatherDuration = 0
end
out
"""
BATTLE_WEATHER_TURNS = {"Rain": 5, "Sun": 5, "Sandstorm": 5, "Hail": 5}
BATTLE_TYPE_MODS = {"FAIRY>DRAGON": 2.0, "FAIRY>STEEL": 0.5, "GHOST>STEEL": 1.0, "DARK>STEEL": 1.0}
FREEZE_STATUSES = ["NONE", "SLEEP", "POISON", "BURN", "PARALYSIS", "FROZEN"]
FREEZE_FROZEN = ["Congelado", "Frozen", 4]
FREEZE_DATA = """
f = GameData::Status.try_get(:FROZEN)
{ "setting" => Settings::FREEZE_EFFECTS_CAUSE_FROSTBITE, "statuses" => GameData::Status.keys.map(&:to_s),
  "frozen" => f && [f.name, f.animation, f.icon_position] }
"""
FREEZE_DRAWS = 2000
FREEZE_THAW_CHANCE = 0.2
FREEZE_SIGMAS = 4
FREEZE_WEATHERS = {"None": True, "Rain": True, "Sun": False, "HarshSun": False}
FREEZE_PROBE = """
b = AnilBridge.battle; u = b.battlers[0]; t = b.battlers[1]; stubs = []
quiet = lambda { |o, names| names.each { |m| next unless o.respond_to?(m, true); o.define_singleton_method(m) { |*a, **k, &blk| nil }; stubs << [o, m] } }
fresh = lambda { |x| x.status = :NONE; x.statusCount = 0; x.effects[PBEffects::Toxic] = 0; x.hp = x.totalhp }
can = lambda { |type, w| fresh.call(t); t.pbChangeTypes(type); b.field.weather = w; r = t.pbCanFreeze?(u, false)
  b.field.weather = :None; t.pbChangeTypes(:NORMAL); r }
out = {}
begin
  quiet.call(b, %i[pbDisplay pbDisplayPaused pbDisplayBrief pbCommonAnimation pbAnimation pbShowAbilitySplash pbHideAbilitySplash pbReplaceAbilitySplash])
  quiet.call(b.scene, %i[pbHPChanged pbDamageAnimation pbCommonAnimation pbAnimation pbRefresh pbRefreshOne])
  [u, t].each { |x| x.ability = :RUNAWAY; x.item = nil; fresh.call(x); x.pbChangeTypes(:NORMAL) }
  out["normal"] = WEATHERS.to_h { |w| [w.to_s, can.call(:NORMAL, w)] }
  out["ice"] = can.call(:ICE, :None)
  fresh.call(t); t.pbFreeze; out["inflicted"] = [t.status.to_s, t.pokemon.status.to_s, t.pbHasStatus?(:FROZEN)]; fresh.call(t)
  move = u.moves[0]; choice = [:UseMove, 0, move, t.index, 0]
  out["tries"] = (1..DRAWS).map { u.status = :FROZEN; u.statusCount = 0; moved = u.pbTryUseMove(choice, move, false, false)
    [u.status == :NONE, moved] }.tally.map { |k, v| k + [v] }
ensure
  stubs.reverse_each { |o, m| o.singleton_class.send(:remove_method, m) }
  [u, t].each { |x| fresh.call(x); x.pbResetTypes }
  b.field.weather = :None
end
out
"""
FREEZE_TURN_SETUP = """
b = AnilBridge.battle; u = b.battlers[0]; t = b.battlers[1]
[u, t].each { |x| x.ability = :RUNAWAY; x.item = nil; x.hp = x.totalhp; x.status = :NONE; x.statusCount = 0 }
u.status = :USER; t.status = :FOE
m = Pokemon::Move.new(:MOVE); u.pokemon.moves[0] = m; u.moves[0] = Battle::Move.from_pokemon_move(b, m)
b.define_singleton_method(:pbRandom) { |x| [ROLL, x - 1].min }
[u.status.to_s, t.status.to_s, u.moves[0].id.to_s, u.moves[0].thawsUser?, t.hp]
"""
FREEZE_TURN_AFTER = """
b = AnilBridge.battle; u = b.battlers[0]; t = b.battlers[1]
b.singleton_class.send(:remove_method, :pbRandom) if b.singleton_methods.include?(:pbRandom)
[u.status.to_s, t.status.to_s, t.hp, t.totalhp]
"""
FREEZE_HELD = 99
FREEZE_THAWED = 0
FREEZE_STILL = "está congelado"
FREEZE_THAW = "se ha descongelado"
FREEZE_MELT = "derritió el hielo"


@dataclass(frozen=True)
class FreezeTurn:
    label: str
    user: str
    foe: str
    move: str
    roll: int
    user_after: str
    foe_after: str
    hit: bool
    words: tuple[str, ...]


FREEZE_TURNS = (
    FreezeTurn(
        "frozen lead, thaw roll failed",
        "FROZEN",
        "NONE",
        "TACKLE",
        FREEZE_HELD,
        "FROZEN",
        "NONE",
        False,
        (FREEZE_STILL,),
    ),
    FreezeTurn(
        "frozen lead, thaw roll passed",
        "FROZEN",
        "NONE",
        "TACKLE",
        FREEZE_THAWED,
        "NONE",
        "NONE",
        True,
        (FREEZE_THAW,),
    ),
    FreezeTurn(
        "frozen lead using Flame Wheel",
        "FROZEN",
        "NONE",
        "FLAMEWHEEL",
        FREEZE_HELD,
        "NONE",
        "NONE",
        True,
        (FREEZE_MELT,),
    ),
    FreezeTurn(
        "frozen foe hit by Tackle",
        "NONE",
        "FROZEN",
        "TACKLE",
        FREEZE_HELD,
        "NONE",
        "FROZEN",
        True,
        (FREEZE_STILL,),
    ),
    FreezeTurn(
        "frozen foe hit by Ember",
        "NONE",
        "FROZEN",
        "EMBER",
        FREEZE_HELD,
        "NONE",
        "NONE",
        True,
        (FREEZE_STILL, FREEZE_THAW),
    ),
)
SHINY_SNAPSHOT_PREFIX = "check-shiny-"
SHINY_CHANCE = 65
SHINY_RANGE = 65536
SHINY_SETTINGS = {
    "SHINY_POKEMON_CHANCE": SHINY_CHANCE,
    "HIGHER_SHINY_CHANCES_WITH_NUMBER_BATTLED": True,
    "SUPER_SHINY": True,
}
SHINY_CHAIN_LENGTH = 10
SHINY_CHAIN_ODDS = 1000
SHINY_CHAIN_TOP = 4
SHINY_CHARM = "SHINYCHARM"
SHINY_POTION = "SHINYZADOR"
SHINY_POTION_SWITCH = 122
SHINY_SWITCHES = (31, 38, SHINY_POTION_SWITCH)
SHINY_HANDLERS = ("make_shiny_switch", "shinyzador", "hacer_shiny_a_salvajes")
SHINY_CHARM_RETRIES = 2
SHINY_CHARM_EVENT = (29, 20)
SHINY_CHARM_DEX = 1027
SHINY_PRELUDE = """
roll = lambda { |pk| a = pk.personalID ^ pk.owner.id; ((a & 0xFFFF) ^ ((a >> 16) & 0xFFFF)) < Settings::SHINY_POKEMON_CHANCE }
tally = lambda { |n, &make| t = [0, 0, 0, 0, 0]; seen = {}
  n.times { pk = make.call; base = roll.call(pk); t[0] += 1; t[1] += 1 if base; t[2] += 1 if pk.shiny?
    t[3] += 1 if pk.shiny? && !base; t[4] += 1 if pk.super_shiny?; seen[pk.species.to_s] = true }
  t + [seen.keys] }
"""
SHINY_DATA = f"""
ev = EventHandlers.class_variable_get(:@@events)
item = lambda {{ |i| d = GameData::Item.get(i); [d.name, d.pocket, d.is_key_item?, d.price, d.bp_price,
  RandomizedChallenge.unrandomizable_item?(i), RandomizedChallenge::HELD_ITEM_BLACK_LIST.include?(i)] }}
pool = GameData::Item.keys.reject {{ |i| RandomizedChallenge.excluded_item?(GameData::Item.get(i)) }}
tp = GameData::Trainer.keys.flat_map {{ |k| GameData::Trainer.get(*k).pokemon }}
{{ "settings" => {list(SHINY_SETTINGS)!r}.to_h {{ |n| [n, Settings.const_get(n)] }},
  "chain" => [CHAINLENGTH, SHINYPROBABILITY], "wild_option" => $PokemonSystem.salvajes_visibles_en_ow,
  "visible" => $PokemonSystem.salvajes_visibles_en_ow?, "messages" => $PokemonSystem.mensaje_shinys,
  "switches" => {list(SHINY_SWITCHES)!r}.map {{ |s| $game_switches[s] }},
  "wild_handlers" => ev[:on_wild_pokemon_created].instance_variable_get(:@callbacks).keys.map(&:to_s),
  "end_handlers" => ev[:on_wild_battle_end].instance_variable_get(:@callbacks).keys.map(&:to_s),
  "charm" => item.call(:{SHINY_CHARM}), "potion" => item.call(:{SHINY_POTION}),
  "pool" => pool.size, "potion_in_pool" => pool.include?(:{SHINY_POTION}), "has_charm" => $bag.has?(:{SHINY_CHARM}),
  "trainer_pokemon" => tp.size, "trainer_shiny" => tp.count {{ |p| p[:shininess] || p[:super_shininess] }},
  "unrandomizable_trainers" => RandomizedChallenge::UNRANDOMIZABLE_TRAINERS.size,
  "unrandomizable_slots" => RandomizedChallenge::UNRANDOMIZABLE_TRAINER_POKEMON.values.sum {{ |h| h.size }},
  "battled" => $player.pokedex.battled_count(:{TEST_SPECIES}),
  "dex_species" => GameData::Species.keys.to_h {{ |k| [k.to_s, GameData::Species.get(k).species.to_s] }},
  "starters" => {list(STARTER_VARIABLES)!r}.map {{ |v| p = $game_variables[v]; [p.species.to_s, p.shiny?, roll.call(p)] }} }}
"""
SHINY_TYPE = "Land"
SHINY_SPECIES = TEST_SPECIES
SHINY_LEVEL = 5
SHINY_BATCH = 2000
SHINY_SAMPLES = {"wild": 100000, "visible": 20000, "chain": 20000, "charm": 20000, "gift": 40000}
SHINY_SETUP = {
    "wild": "$PokemonGlobal.catchcombo = [0, 0]",
    "visible": "$PokemonGlobal.catchcombo = [0, 0]; $PokemonSystem.instance_variable_set(:@salvajes_visibles_en_ow, 0)",
    "chain": (
        "RandomizedChallenge.pause_random_species; $PokemonGlobal.dont_randomize = [:SPECIES]; "
        "$PokemonGlobal.catchcombo = [COMBO, :SPECIES]"
    ),
    "charm": "$PokemonGlobal.catchcombo = [0, 0]; $bag.add(:CHARM) unless $bag.has?(:CHARM)",
    "gift": "true",
}
SHINY_MAKE = {
    "wild": "e = $PokemonEncounters.choose_wild_pokemon(:TYPE); pbGenerateWildPokemon(e[0], e[1])",
    "chain": "$PokemonGlobal.catchcombo = [COMBO, :SPECIES]; pbGenerateWildPokemon(:SPECIES, LEVEL)",
    "gift": "Pokemon.new(:SPECIES, LEVEL)",
}
SHINY_CLEANUP = (
    "$PokemonSystem.instance_variable_set(:@salvajes_visibles_en_ow, OPTION); $PokemonGlobal.dont_randomize = []; "
    "RandomizedChallenge.resume_random_species; $bag.remove(:CHARM) if $bag.has?(:CHARM); "
    "$PokemonGlobal.catchcombo = [0, 0]"
)
SHINY_BATCH_SOURCE = "begin; SETUP; tally.call(COUNT) { MAKE }; ensure; CLEANUP; end"
SHINY_POTION_SOURCE = """
$PokemonGlobal.catchcombo = [0, 0]; $game_switches[SWITCH] = true
e = $PokemonEncounters.choose_wild_pokemon(:TYPE); a = pbGenerateWildPokemon(e[0], e[1]); after = $game_switches[SWITCH]
b = (1..TRIES).map { e = $PokemonEncounters.choose_wild_pokemon(:TYPE); pbGenerateWildPokemon(e[0], e[1]).shiny? }
$game_switches[SWITCH] = false
[a.shiny?, a.super_shiny?, roll.call(a), after, b.count(true)]
"""
SHINY_POTION_TRIES = 20
SHINY_COUNTER = """
h = EventHandlers.class_variable_get(:@@events)[:on_wild_battle_end].instance_variable_get(:@callbacks)[:shiny_chain_aumenta]
saved = $PokemonSystem.mensaje_shinys; $PokemonSystem.mensaje_shinys = 1; $PokemonGlobal.catchcombo = [0, 0]
begin
  STEPS.map { |s, d| h.call(s.to_sym, LEVEL, d); [$PokemonGlobal.catchcombo[0], $PokemonGlobal.catchcombo[1].to_s] }
ensure
  $PokemonSystem.mensaje_shinys = saved; $PokemonGlobal.catchcombo = [0, 0]
end
"""
SHINY_COUNTER_STEPS = [
    [TEST_SPECIES, 1],
    [TEST_SPECIES, 1],
    [TEST_SPECIES, 4],
    [TEST_SPECIES, 3],
    [TEST_SPECIES, 2],
    ["PIDGEY", 1],
]
SHINY_COUNTER_EXPECTED = [
    [1, TEST_SPECIES],
    [2, TEST_SPECIES],
    [3, TEST_SPECIES],
    [3, TEST_SPECIES],
    [3, TEST_SPECIES],
    [1, "PIDGEY"],
]
SHINY_TRAINER_EVERY = 25
SHINY_TRAINERS = """
pick = GameData::Trainer.keys.select.with_index { |_, i| i % EVERY == 0 }
pick.map { |k| t = pbLoadTrainer(*k); t ? t.party.map { |pk| [pk.species.to_s, pk.shiny?] } : [] }
"""
SHINY_SIGMAS = 4
SHINY_BATTLES = (100, 300, 1000)


def evolution_cases(
    evolutions: list[list[Any]],
) -> tuple[list[list[Any]], list[list[Any]]]:
    blocked: list[list[Any]] = []
    allowed: list[list[Any]] = []
    for species, evos in evolutions:
        if species not in ALLOWED_SPECIES:
            continue
        for target, method, param in evos:
            if method == EVOLUTION_NONE:
                continue
            case = [species, target, method, "" if param is None else param]
            (allowed if target in ALLOWED_SPECIES else blocked).append(case)
    return blocked, allowed[::EVOLUTION_CONTROL_EVERY]


def try_evolutions(live: Live, cases: list[list[Any]]) -> list[list[Any]]:
    source = ruby(
        EVOLUTION_TRY,
        CASES=json.dumps(cases),
        LEVEL=EVOLUTION_LEVEL,
        BYPASS=LEVEL_CAP_BYPASS_SWITCH,
    )
    return eval_data(live, source)


def check_evolutions(live: Live, result: CheckResult) -> None:
    blocked, controls = evolution_cases(eval_data(live, EVOLUTION_LIST))
    result.note(
        f"{len(blocked)} evolutions of allowed species lead outside the allow-list: "
        + ", ".join(f"{c[0]}->{c[1]} ({c[2]} {c[3]})" for c in blocked)
    )
    result.mark(bool(blocked), f"evolutions out of the allow-list found: {len(blocked)}")
    tried = try_evolutions(live, blocked)
    exercised = [t for t in tried if t[5] or t[6]]
    result.note(
        "condition not met at level "
        f"{EVOLUTION_LEVEL}, so not exercised: "
        + (", ".join(f"{t[0]}->{t[1]} ({t[2]})" for t in tried if not (t[5] or t[6])) or "none")
    )
    for species, target, method, param, level, _, _, by_level, by_item in exercised:
        answers = [a for a in (by_level, by_item) if a is not None]
        result.mark(
            all(a in ALLOWED_SPECIES for a in answers),
            f"{species} level {level} ({method} {param}) toward {target}: "
            f"level-up answers {by_level!r}, item answers {by_item!r}",
        )
    result.mark(bool(exercised), f"blocked evolutions exercised: {len(exercised)} of {len(tried)}")
    answered = [t for t in try_evolutions(live, controls) if t[5] or t[6]]
    problems = [
        f"{t[0]} ({t[2]} {t[3]}) answered {t[7]!r}/{t[8]!r}, expected {t[1]}"
        for t in answered
        if (t[5] and t[7] is None) or (t[6] and t[8] is None)
    ]
    mark_all(
        result, "allowed evolutions with their condition met still evolve", problems, len(answered)
    )


def check_megas(live: Live, result: CheckResult) -> None:
    switch = read_checked(live, result, [("switch", f"$game_switches[{NO_MEGA_SWITCH}]")])
    result.expect(f"switch {NO_MEGA_SWITCH}", switch.get("switch"), True)
    state = read_checked(live, result, LEVEL_CAP_PATHS)
    cap = state.get("cap")
    if not isinstance(cap, int) or not result.mark(cap > 1, f"level cap {cap}"):
        result.mark(isinstance(cap, int), f"level cap read: {cap!r}")
        return
    session = live.session
    name = f"{MEGA_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        mega_battle(live, result, cap)
    finally:
        restore_snapshot(session, name)


def mega_battle(live: Live, result: CheckResult, cap: int) -> None:
    setup = eval_data(live, ruby(MEGA_SETUP, CAP=cap))
    result.note(
        f"trainer {'/'.join(setup['key'])}: PBS {setup['pbs'][0]} holding {setup['pbs'][1]}; "
        f"loaded party {setup['party']}"
    )
    foe, lead = setup.get("foe"), setup.get("lead")
    if not result.mark(foe is not None, "the loaded team has a Mega Stone holder"):
        return
    result.note(
        f"foe {foe[0]} level {foe[3]} holding {foe[1]}, has a mega form {foe[2]}; rings {setup['rings']}"
    )
    result.note(f"lead {lead[0]} level {lead[3]} holding {lead[1]}, has a mega form {lead[2]}")
    result.expect(f"foe {foe[0]} in the species allow-list", foe[0] in ALLOWED_SPECIES, True)
    result.expect("foe has a mega form for its stone", foe[2], True)
    result.expect("lead has a mega form for its stone", lead[2], True)
    run_script(live, MEGA_BATTLE_SCRIPT)
    if reached(live, result, at_command, "trainer battle at its command menu") is None:
        return
    asked = eval_data(live, MEGA_ASK)
    result.note(f"battlers (species, item, hasMega?, mega?): {asked['battlers']}")
    result.expect(
        f"pbCanMegaEvolve? (player, trainer) with switch {NO_MEGA_SWITCH} on",
        asked["on"],
        [False, False],
    )
    result.expect(
        f"pbCanMegaEvolve? (player, trainer) with switch {NO_MEGA_SWITCH} off",
        asked["off"],
        [True, True],
    )
    result.expect(f"switch {NO_MEGA_SWITCH} after asking", asked["switch"], True)
    if not result.mark(choose_command(live, result, FIGHT_COMMAND), "chose Luchar"):
        return
    if reached(live, result, lambda now, _: now.context.name == BATTLE_FIGHT, "move menu") is None:
        return
    press(live, CONFIRM)
    texts = win_battle(live, result, "the trainer battle")
    if texts is None:
        return
    seen = [text for text in texts if any(word in text.lower() for word in MEGA_SEEN_WORDS)]
    result.expect("mega evolution messages", seen, [])
    after = json.loads(eval_inspect(live.session, MEGA_AFTER))
    result.note(f"after the battle: lead {after[:3]}, trainer party {after[3]}")
    result.expect("lead mega evolved", after[2], False)
    result.expect("trainer Pokémon mega evolved", any(x[2] for x in after[3]), False)


def check_battle_mechanics(live: Live, result: CheckResult) -> None:
    data = eval_data(live, BATTLE_DATA)
    for name, expected in BATTLE_SETTINGS.items():
        result.expect(f"Settings::{name}", data["settings"].get(name), expected)
    result.expect("Battle::Move::CRITICAL_HIT_RATIOS", data["crit_ratios"], BATTLE_CRIT_RATIOS)
    result.expect("Fairy type exists", data["fairy"], True)
    result.note(f"the Fairy type's name: {data['fairy_name']!r}")
    for species, types in BATTLE_FAIRY_SPECIES.items():
        result.expect(f"{species} types", data["species"].get(species), types)
    for move, type_ in BATTLE_FAIRY_MOVES.items():
        result.expect(f"{move} type", data["moves"].get(move), type_)
    fairies = sorted(s for s in data["fairy_species"] if s in ALLOWED_SPECIES)
    result.note(f"{len(fairies)} allowed species with the Fairy type: {', '.join(fairies)}")
    moves = sorted(m for m in data["fairy_moves"] if m in ALLOWED_MOVES)
    result.note(f"{len(moves)} allowed Fairy moves: {', '.join(moves)}")
    result.expect("battle types", sorted(data["types"]), sorted(BATTLE_TYPE_CHART))
    battle_chart(result, data["chart"])
    for species, types in BATTLE_RESTORED_TYPES.items():
        result.expect(f"{species} types", data["species"].get(species), types)
    result.note(f"the Hail weather's name: {data['snow_name']!r}")
    in_battle_snapshot(live, result, battle_probes)


def in_battle_snapshot(
    live: Live, result: CheckResult, body: Callable[[Live, CheckResult, int], None]
) -> None:
    state = read_checked(live, result, LEVEL_CAP_PATHS)
    cap = state.get("cap")
    if not isinstance(cap, int) or not result.mark(cap > 1, f"level cap {cap}"):
        result.mark(isinstance(cap, int), f"level cap read: {cap!r}")
        return
    session = live.session
    name = f"{BATTLE_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        body(live, result, cap)
    finally:
        restore_snapshot(session, name)


def start_probe_battle(live: Live, result: CheckResult, cap: int) -> bool:
    lead = CAP_MON.format(species=BATTLE_LEAD_SPECIES, level=cap, move=BATTLE_LEAD_MOVE)
    result.note(
        "the party is one "
        + eval_inspect(
            live.session, f"x = ({lead}); $player.party.replace([x]); [x.species, x.level]"
        )
    )
    foe = CAP_MON.format(species=BATTLE_FOE_SPECIES, level=cap, move=BATTLE_FOE_MOVE)
    run_script(live, WILD_SCRIPT.format(wild=foe))
    return reached(live, result, at_command, "wild battle at its command menu") is not None


def check_official_types(live: Live, result: CheckResult) -> None:
    data = eval_data(live, OFFICIAL_TYPES_DATA)
    result.expect("species read", sorted(data), sorted(OFFICIAL_TYPES))
    wrong = [
        f"{species} {'/'.join(data.get(species, []))}, official {'/'.join(types)}"
        for species, types in OFFICIAL_TYPES.items()
        if data.get(species) != types
    ]
    mark_all(
        result, "allowed species with their official types, in order", wrong, len(OFFICIAL_TYPES)
    )
    for species in ("CHIKORITA", "BAYLEEF", "MEGANIUM", "FERALIGATR", "CLEFAIRY", "TOGEPI"):
        result.note(f"{species}: {'/'.join(data.get(species, []))}")


def battle_chart(result: CheckResult, chart: dict[str, dict[str, float]]) -> None:
    wrong = []
    for attack, (strong, weak, none) in BATTLE_TYPE_CHART.items():
        for defend in BATTLE_TYPE_CHART:
            expected = (
                2.0
                if defend in strong
                else 0.5
                if defend in weak
                else 0.0
                if defend in none
                else 1.0
            )
            actual = chart.get(attack, {}).get(defend)
            if actual != expected:
                wrong.append(f"{attack} against {defend}: {actual}, expected {expected}")
    total = len(BATTLE_TYPE_CHART) ** 2
    result.mark(not wrong, f"type chart matches Gen 6+ in {total - len(wrong)} of {total} pairs")
    for line in wrong:
        result.note(line)


def near(actual: Any, expected: float) -> bool:
    return isinstance(actual, int | float) and abs(actual - expected) <= BATTLE_RATIO_SLACK


def ratio(top: int, bottom: int) -> float:
    return round(top / bottom, 3)


def battle_probes(live: Live, result: CheckResult, cap: int) -> None:
    if not start_probe_battle(live, result, cap):
        return
    probe = eval_data(
        live,
        ruby(
            BATTLE_PROBE,
            PHYSICAL=BATTLE_PHYSICAL,
            SPECIAL=BATTLE_SPECIAL,
            STAT=BATTLE_STAT,
            SPEED=BATTLE_SPEED,
            DRAWS=BATTLE_SLEEP_DRAWS,
            ROUNDS=BATTLE_TOXIC_ROUNDS,
        ),
    )
    battle_statuses(result, probe)
    battle_damage(result, probe)
    for weather, turns in BATTLE_WEATHER_TURNS.items():
        result.expect(f"{weather} from an ability lasts", probe["weather"].get(weather), turns)
    for pair, expected in BATTLE_TYPE_MODS.items():
        result.expect(f"in battle, {pair}", probe["type_mods"].get(pair), expected)
    flee(live, result)


def battle_statuses(result: CheckResult, probe: dict[str, Any]) -> None:
    result.expect(f"sleep counters over {BATTLE_SLEEP_DRAWS} draws", probe["sleep"], [2, 3, 4])
    speed, paralysed = probe["speed"]
    result.mark(
        abs(paralysed - speed / 2) <= 1, f"speed {speed}, paralysed {paralysed} (half is expected)"
    )
    result.expect(
        "paralysis on a Normal, then an Electric target", probe["paralysis"], [True, False]
    )
    result.expect(
        "freeze allowed on Normal, status after pbFreeze, freeze allowed on Ice",
        probe["freeze"],
        [True, "FROZEN", False],
    )
    hp = probe["hp"]
    expected = {
        "BURN": [hp // 16],
        "POISON": [hp // 8],
        "TOXIC": [hp * n // 16 for n in range(1, BATTLE_TOXIC_ROUNDS + 1)],
        "FROZEN": [0],
    }
    result.note(f"end-of-round damage on {hp} max HP")
    for status, losses in expected.items():
        result.expect(f"{status} end-of-round HP lost", probe["eor"].get(status), losses)


def battle_damage(result: CheckResult, probe: dict[str, Any]) -> None:
    damage = probe["damage"]
    result.note(f"damage (no crit, crit) at fixed top roll: {damage}")
    plain_hit, crit_hit = damage["physical"]
    result.mark(near(ratio(crit_hit, plain_hit), 1.5), f"crit ratio {ratio(crit_hit, plain_hit)}")
    for label, base, factor in (
        ("physical burned", "physical", 0.5),
        ("physical frozen", "physical", 1.0),
        ("special burned", "special", 1.0),
        ("special frozen", "special", 1.0),
    ):
        got = ratio(damage[label][0], damage[base][0])
        result.mark(near(got, factor), f"{label} against {base}: {got} (expected {factor})")
    clear, snowy, user_hurt, ice_hurt = probe["snow"]
    got = ratio(snowy, clear)
    result.mark(
        near(got, 2 / 3), f"physical hit on Ice in snow against clear: {got} ({snowy}/{clear})"
    )
    result.expect("snow hurts a Normal or an Ice Pokémon", [user_hurt, ice_hurt], [False, False])


CALC_BADGE_SETTINGS = (
    "NUM_BADGES_BOOST_ATTACK",
    "NUM_BADGES_BOOST_DEFENSE",
    "NUM_BADGES_BOOST_SPATK",
    "NUM_BADGES_BOOST_SPDEF",
    "NUM_BADGES_BOOST_SPEED",
)
CALC_BADGE_THRESHOLD = 999
CALC_ALL_BADGES = 16
CALC_METHODS = (
    "pbCalcDamage",
    "pbCalcDamageMultipliers",
    "pbCalcDamageMults_Badges",
    "pbCalcDamageMults_Random",
)
CALC_DATA = f"""
{{ "badges" => {list(CALC_BADGE_SETTINGS)!r}.to_h {{ |n| [n, Settings.const_get(n)] }},
  "methods" => {list(CALC_METHODS)!r}.to_h {{ |n| l = Battle::Move.instance_method(n.to_sym).source_location
    [n, l ? [File.basename(File.dirname(l[0])) + "/" + File.basename(l[0]), l[1]] : nil] }},
  "no_grinding" => $game_switches[149] }}
"""
CALC_DAMAGE_METHODS = (
    "pbBaseDamage",
    "pbBaseDamageMultiplier",
    "pbModifyDamage",
    "pbBaseType",
    "pbCalcType",
    "pbCalcTypeModSingle",
    "pbCalcTypeMod",
    "pbGetAttackStats",
    "pbGetDefenseStats",
    "pbCalcDamage",
    "pbCalcDamageMultipliers",
    "pbOnStartUse",
    "pbFixedDamage",
    "pbNumHits",
    "multiHitMove?",
    "recoilMove?",
    "ignoresReflect?",
    "damageReducedByBurn?",
    "pbCritialOverride",
    "pbIsCritical?",
    "physicalMove?",
    "specialMove?",
    "pbTarget",
    "pbBaseDamageTera",
    "nonLethal?",
    "pbReduceDamage",
    "initialize",
)
CALC_UNIMPLEMENTED = "Unimplemented"
CALC_FUNCTIONS = f"""
names = {list(CALC_DAMAGE_METHODS)!r}.map(&:to_sym); out = {{}}
GameData::Move.each {{ |m| next if m.category == 2
  code = m.function_code; name = code[/^\\d/] ? "Battle::Move::Effect#{{code}}" : "Battle::Move::#{{code}}"
  k = Object.const_defined?(name) ? Object.const_get(name) : nil
  out[code] = k.nil? ? ["{CALC_UNIMPLEMENTED}"] : names.select {{ |n| k.method_defined?(n) &&
    k.instance_method(n).owner != Battle::Move && k.instance_method(n).owner <= Battle::Move }}.map(&:to_s) }}
out
"""
CALC_HIT_METHODS = (
    "pbNumHits",
    "pbRepeatHit?",
    "multiHitMove?",
    "recoilMove?",
    "chargingTurnMove?",
)
CALC_HIT_CLASSES = f"""
names = {list(CALC_HIT_METHODS)!r}.map(&:to_sym); out = {{}}
GameData::Move.each {{ |m| next if m.category == 2
  code = m.function_code; name = code[/^\\d/] ? "Battle::Move::Effect#{{code}}" : "Battle::Move::#{{code}}"
  next if !Object.const_defined?(name); k = Object.const_get(name)
  out[code] = names.select {{ |n| k.instance_method(n).owner != Battle::Move }}.map(&:to_s) }}
out
"""
CALC_UNLOSABLE = """
abil = lambda { |a| a.empty? ? nil : GameData::Ability.try_get(a.to_sym) }; items = []; GameData::Item.each { |i| items << i }
table = __TABLE__; held = table.values.flatten.uniq; cands = items.select { |i| held.include?(i.id.to_s) }
own = lambda { |s, a| items.select { |i| i.unlosable?(s.to_sym, abil.call(a)) }.map { |i| i.id.to_s } }
{ "table" => table.to_h { |s, _| [s, own.call(s, __ABILITIES__.fetch(s, ""))] },
  "other_ability" => table.to_h { |s, _| [s, own.call(s, "__OTHER__")] },
  "sweep" => GameData::Species.keys.select { |k| GameData::Species.get(k).form == 0 }.flat_map { |k|
    a = abil.call(__ABILITIES__.fetch(k.to_s, "__PARADOX__"))
    cands.select { |i| i.unlosable?(k, a) }.map { |i| [k.to_s, i.id.to_s] } },
  "booster" => items.select { |i| i.id == :__BOOSTER__ }.map { |i| i.unlosable?(:__PARADOX_SPECIES__, :__PARADOX__) },
  "mail" => items.select(&:is_mail?).map { |i| i.id.to_s } }
"""
CALC_OTHER_ABILITY = "RUNAWAY"
CALC_PARADOX = ("GREATTUSK", "PROTOSYNTHESIS")
CALC_BOOSTER = "BOOSTERENERGY"
CALC_PLAIN_MOVE = "BITE"
CALC_MODELLED_MOVES = (
    "KNOCKOFF",
    "TERASTARSTORM",
    "PAYBACK",
    "FIREPLEDGE",
    "COUNTER",
    "FURYCUTTER",
    "GYROBALL",
)
CALC_SPEED_MOVES = ("GYROBALL", "ELECTROBALL")
CALC_SLOW_ITEM = "IRONBALL"
CALC_BOTH_WAYS_MOVE = "PAYBACK"
CALC_COUNTER_MOVES = ("COUNTER", "MIRRORCOAT", "METALBURST", "BIDE")
CALC_HIDDEN_POWER = "HIDDENPOWER"
CALC_PRELUDE = """
b = AnilBridge.battle; u = b.battlers[0]; t = b.battlers[1]; stubs = []; roll = 0; draw = nil; held_pp = nil
hap = u.pokemon.happiness; forms = [u.form, t.form]; kinds = [u.species, t.species]
mold = lambda { |m, user, target| b.moldBreaker = (user.hasMoldBreaker? || m.is_a?(Battle::Move::IgnoreTargetAbility)) && !target.hasActiveItem?(:ABILITYSHIELD) }
failed = lambda { |m, user, target| m.pbCheckFlingSuccess(user) if m.is_a?(Battle::Move::ThrowUserItemAtTarget)
  if [Battle::Move::CounterPhysicalDamage, Battle::Move::CounterSpecialDamage, Battle::Move::CounterDamagePlusHalf,
      Battle::Move::MultiTurnAttackBideThenReturnDoubleDamage].any? { |k| m.is_a?(k) }
    ts = []; m.pbAddTarget(ts, user); next m.pbMoveFailed?(user, ts) || !ts.include?(target) end
  [Battle::Move::HitOncePerUserTeamMember, Battle::Move::PowerDependsOnUserStockpile, Battle::Move::UserFaintsExplosive, Battle::Move::ThrowUserItemAtTarget].any? { |k| m.is_a?(k) } && m.pbMoveFailed?(user, [target]) }
usage = lambda { |m, user| next unless [Battle::Move::DoublePowerAfterFusionFlare, Battle::Move::DoublePowerAfterFusionBolt].any? { |k| m.is_a?(k) }
  kept = [b.field.effects.dup, user.effects.dup, user.proteanTrigger]; m.pbChangeUsageCounters(user, false)
  b.field.effects.replace(kept[0]); user.effects.replace(kept[1]); user.proteanTrigger = kept[2] }
counters = lambda { |m, user, target| kept = [b.field.effects.dup, user.effects.dup, user.pbOwnSide.effects.dup, user.proteanTrigger]
  if [Battle::Move::PowerHigherWithConsecutiveUse, Battle::Move::PowerHigherWithConsecutiveUseOnUserSide].any? { |k| m.is_a?(k) }
    m.pbChangeUsageCounters(user, false) end
  if m.is_a?(Battle::Move::PowerHigherWithLessPP)
    m.pp = held_pp unless held_pp.nil?; user.pbReducePP(m); user.pbReducePP(m) if target.opposes?(user) && target.hasActiveAbility?(:PRESSURE) end
  lambda { b.field.effects.replace(kept[0]); user.effects.replace(kept[1]); user.pbOwnSide.effects.replace(kept[2]); user.proteanTrigger = kept[3] } }
quiet = lambda { |o, names| names.each { |m| next unless o.respond_to?(m, true); o.define_singleton_method(m) { |*a, **k, &blk| nil }; stubs << [o, m] } }
stat = lambda { |x| { "level" => x.level, "species" => x.species.to_s, "form" => x.form, "HP" => x.totalhp, "ATTACK" => x.attack, "DEFENSE" => x.defense,
  "SPECIAL_ATTACK" => x.spatk, "SPECIAL_DEFENSE" => x.spdef, "SPEED" => x.speed } }
inputs = lambda { |x| p = x.pokemon; mods = Hash.new(100); (p.nature_for_stats&.stat_changes || []).each { |s, c| mods[s] += c }
  ivs = p.calcIV; h = {}; GameData::Stat.each_main { |s| h[s.id.to_s] = [p.baseStats[s.id], ivs[s.id], p.ev[s.id], mods[s.id]] }; h }
rolls = lambda { |user, target, id, crit, n|
  m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id))
  m.define_singleton_method(:pbCritialOverride) { |*a| crit ? 1 : -1 } unless crit.nil?
  type = m.pbCalcType(user); m.instance_variable_set(:@calcType, type)
  mold.call(m, user, target); usage.call(m, user); counted = counters.call(m, user, target)
  hp = target.hp; item = target.item_id
  r = (0..15).map { |r| roll = r; target.hp = hp; target.item = item; user.effects[PBEffects::ParentalBond] = 0
    m.pbMoveFailed?(user, [target]) if m.is_a?(Battle::Move::HitOncePerUserTeamMember)
    m.pbOnStartUse(user, [target]); count = m.pbNumHits(user, Array.new(n, target)); count += 1 if m.pbRepeatHit?
    hits = (0...count).map { |i| user.effects[PBEffects::ParentalBond] -= 1 if user.effects[PBEffects::ParentalBond] > 0
      target.damageState.reset; target.damageState.typeMod = m.pbCalcTypeMod(type, user, target)
      m.pbCalcDamage(user, target, n); d = target.damageState.calcDamage
      target.hp -= [d, target.hp - 1].min; target.item = nil if target.damageState.berryWeakened; d }
    user.effects[PBEffects::GemConsumed] = nil; hits }
  target.hp = hp; target.item = item; counted.call; user.effects[PBEffects::ParentalBond] = 0
  b.moldBreaker = false; r }
immune = lambda { |user, target, id|
  m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id))
  type = m.pbCalcType(user); m.instance_variable_set(:@calcType, type)
  mold.call(m, user, target); target.damageState.reset
  target.damageState.typeMod = m.pbCalcTypeMod(type, user, target)
  r = [target.damageState.typeMod, m.pbImmunityByAbility(user, target, false) || (type == :GROUND && target.airborne? && !m.hitsFlyingTargets? &&
    ((target.hasActiveAbility?(:LEVITATE) && !b.moldBreaker) || target.hasActiveItem?(:AIRBALLOON) ||
    target.effects[PBEffects::MagnetRise] > 0 || target.effects[PBEffects::Telekinesis] > 0)),
    (m.pbOnStartUse(user, [target]); m.pbFailsAgainstTarget?(user, target, false) || failed.call(m, user, target))]
  b.moldBreaker = false; r }
after = lambda { |user, target, id, plain|
  m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id)); h = user.hp; th = target.hp
  lost = lambda { l = h - user.hp; user.hp = h; l }
  cover = target.effects[PBEffects::Substitute] > 0 && !m.ignoresSubstitute?(user) ? target.effects[PBEffects::Substitute] : th
  recoil = !m.is_a?(Battle::Move::RecoilMove) ? nil : plain.map { |hits| target.damageState.reset
    target.damageState.totalHPLost = [hits.sum, cover].min; m.pbEffectAfterAllHits(user, target); lost.call }
  crash = m.recoilMove? && !m.is_a?(Battle::Move::RecoilMove) ? (m.pbCrashDamage(user); lost.call) : nil
  kept = !m.nonLethal?(user, target) ? nil : plain.map { |hits| target.hp = th
    hits.sum { |d| target.damageState.reset; target.damageState.calcDamage = d; m.pbReduceDamage(user, target)
      l = target.damageState.hpLost; target.hp -= l; l } }
  target.hp = th; target.stopBoostedHPScaling = false; target.damageState.reset; [recoil, crash, kept] }
both = lambda { |user, target, id, n, own = false| plain = rolls.call(user, target, id, own ? nil : false, n)
  { "plain" => plain, "crit" => rolls.call(user, target, id, true, n), "immune" => immune.call(user, target, id),
    "after" => after.call(user, target, id, plain) } }
clear = lambda { draw = nil; u.pokemon.happiness = hap; [u, t].each_with_index { |x, i| x.instance_variable_set(:@form, forms[i]); x.species = kinds[i]; x.status = :NONE; x.statusCount = 0; x.pbResetTypes; x.stages.each_key { |k| x.stages[k] = 0 }
    x.ability = :RUNAWAY; x.item = nil; x.hp = x.totalhp; x.effects[PBEffects::GemConsumed] = nil }
  b.field.weather = :None; b.field.weatherDuration = 0; b.field.terrain = :None; b.field.terrainDuration = 0
  %i[MudSportField WaterSportField Gravity MagicRoom TrickRoom].each { |e| b.field.effects[PBEffects.const_get(e)] = 0 }
  t.pbOwnSide.effects[PBEffects::Reflect] = 0; t.pbOwnSide.effects[PBEffects::LightScreen] = 0
  t.pbOwnSide.effects[PBEffects::AuroraVeil] = 0 }
species = lambda { |x, id| base, form = id.split("_"); x.instance_variable_set(:@form, form.to_i); x.species = base.to_sym
  x.define_singleton_method(:isSpecies?) { |s| s == base.to_sym }; stubs << [x, :isSpecies?]
  x.pokemon.define_singleton_method(:species_data) { GameData::Species.get(id.to_sym) }; stubs << [x.pokemon, :species_data] }
unstub = lambda { |keep| while stubs.length > keep; o, n = stubs.pop; o.singleton_class.send(:remove_method, n); end }
out = {}
begin
  quiet.call(b, %i[pbDisplay pbDisplayPaused pbDisplayBrief pbCommonAnimation pbAnimation pbShowAbilitySplash pbHideAbilitySplash pbReplaceAbilitySplash])
  quiet.call(b.scene, %i[pbHPChanged pbDamageAnimation pbCommonAnimation pbAnimation pbRefresh pbRefreshOne])
  b.define_singleton_method(:pbRandom) { |x| x == 16 || draw.nil? ? roll : draw % x }; stubs << [b, :pbRandom]
  clear.call
  __BODY__
ensure
  stubs.reverse_each { |o, m| o.singleton_class.send(:remove_method, m) }
  b.singleton_class.send(:remove_method, :pbSideBattlerCount) if b.singleton_methods.include?(:pbSideBattlerCount)
  clear.call
end
out
"""
CALC_CASES_BODY = """
  hist = lambda { |key, v, undo|
    slot = lambda { |h, k, x| old = h[k]; undo << lambda { h[k] = old }; h[k] = x }
    ivar = lambda { |o, n, x| old = o.instance_variable_get(n); undo << lambda { o.instance_variable_set(n, old) }; o.instance_variable_set(n, x) }
    case key
    when "target_acted"
      choice, moved = { "moved" => [:UseMove, true], "waiting" => [:UseMove, false], "item" => [:UseItem, false], "switched_in" => [:None, false] }[v]
      slot.call(b.choices[t.index], 0, choice); ivar.call(t, :@lastRoundMoved, moved ? b.turnCount : b.turnCount - 1)
    when "target_damaged" then ivar.call(t, :@tookDamageThisRound, v)
    when "hurt_by_target" then ivar.call(u, :@lastAttacker, v ? [t.index] : [])
    when "stats_lowered" then ivar.call(u, :@statsLoweredThisRound, v)
    when "switching" then ivar.call(b, :@switching, v)
    when "round_used" then slot.call(u.pbOwnSide.effects, PBEffects::Round, v)
    when "fusion_bolt" then slot.call(b.field.effects, PBEffects::FusionBolt, v)
    when "fusion_flare" then slot.call(b.field.effects, PBEffects::FusionFlare, v)
    when "pledge" then slot.call(u.effects, PBEffects::FirstPledge, v == "" ? nil : v)
    when "counter", "mirror_coat"
      pair = key == "counter" ? [PBEffects::Counter, PBEffects::CounterTarget] : [PBEffects::MirrorCoat, PBEffects::MirrorCoatTarget]
      slot.call(u.effects, pair[0], v == "" ? -1 : v); slot.call(u.effects, pair[1], v == "" ? -1 : t.index)
    when "foe_hp_lost" then ivar.call(u, :@lastHPLostFromFoe, v == "" ? 0 : v); ivar.call(u, :@lastFoeAttacker, v == "" ? [] : [t.index])
    when "bide"
      slot.call(u.effects, PBEffects::Bide, 1); slot.call(u.effects, PBEffects::BideDamage, v); slot.call(u.effects, PBEffects::BideTarget, t.index)
    when "last_move_failed" then ivar.call(u, :@lastRoundMoveFailed, v)
    when "ally_fainted" then ivar.call(b, :@turnCount, 5); slot.call(u.pbOwnSide.effects, PBEffects::LastRoundFainted, v ? 4 : 5)
    when "echoed_voice" then slot.call(u.pbOwnSide.effects, PBEffects::EchoedVoiceCounter, v)
    when "echoed_voice_used" then slot.call(u.pbOwnSide.effects, PBEffects::EchoedVoiceUsed, v)
    when "times_hit" then slot.call(b.instance_variable_get(:@rage_hit_count)[u.index & 1], u.pokemonIndex, v)
    when "fainted_allies" then slot.call(b.instance_variable_get(:@fainted_count), u.index & 1, v)
    end }
  odds = lambda { |user, target, id, foe_id|
    m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id)); m.instance_variable_set(:@calcType, m.pbCalcType(user))
    mold.call(m, user, target); kept = [draw, roll]; draw = nil
    hits = (0..99).count { |r| roll = r; target.damageState.reset; user.pbSuccessCheckPerHit(m, user, target, false) }
    crits = [1, 24, 2, 8].map { |k| draw = k; m.pbIsCritical?(user, target) }
    b.moldBreaker = false; target.damageState.reset
    f = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(foe_id))
    held = [b.choices[user.index].dup, b.choices[target.index].dup, user.effects.dup, target.effects.dup]
    b.choices[user.index] = [:UseMove, 0, m, target.index, 0]; b.choices[target.index] = [:UseMove, 0, f, user.index, 0]
    firsts = [0, 1, 30, 31].map { |k| draw = k; b.pbCalculatePriority(true); b.pbPriority.first.index }
    b.choices[user.index] = held[0]; b.choices[target.index] = held[1]; user.effects.replace(held[2]); target.effects.replace(held[3])
    draw, roll = kept
    { "hits" => hits, "crits" => crits, "firsts" => firsts.uniq.sort } }
  [u, t].each { |x| x.pbUpdate }
  out["owned"] = [b.internalBattle, u.pbOwnedByPlayer?, t.pbOwnedByPlayer?]
  badge = lambda { %w[TACKLE WATERGUN].flat_map { |m| [rolls.call(u, t, m.to_sym, false, 1)[-1], rolls.call(t, u, m.to_sym, false, 1)[-1]] } }
  before = [$player.badge_count, badge.call]
  __ALL__.times { |i| $player.badges[i] = true }
  out["badges"] = [before, [$player.badge_count, badge.call]]
  pass = lambda { { "user" => stat.call(u), "target" => stat.call(t), "user_inputs" => inputs.call(u),
    "target_inputs" => inputs.call(t), "cases" => __CASES__.map { |c|
    clear.call; keep = stubs.length
    u.types = c[:user_types].map(&:to_sym); t.types = c[:target_types].map(&:to_sym)
    u.status = c[:status].to_sym; b.field.weather = c[:weather].to_sym; b.field.terrain = c[:terrain].to_sym
    t.status = c[:target_status].to_sym
    u.ability = c[:user_ability].to_sym if !c[:user_ability].empty?; t.ability = c[:target_ability].to_sym if !c[:target_ability].empty?
    u.item = c[:user_item].to_sym if !c[:user_item].empty?; t.item = c[:target_item].to_sym if !c[:target_item].empty?
    u.hp = u.totalhp / c[:user_hp_divisor]; t.hp = t.totalhp / c[:target_hp_divisor]
    species.call(u, c[:user_species]) if !c[:user_species].empty?; species.call(t, c[:target_species]) if !c[:target_species].empty?
    c[:field].each { |e| b.field.effects[PBEffects.const_get(e.to_sym)] = 5 }
    draw = c[:draw] if c[:draw] != ""; u.pokemon.happiness = c[:user_happiness] if c[:user_happiness] != ""
    u.stages[c[:attack_stat].to_sym] = c[:attack_stage]; t.stages[c[:defense_stat].to_sym] = c[:defense_stage]
    c[:user_stages].each { |s, v| u.stages[s.to_sym] = v }; c[:target_stages].each { |s, v| t.stages[s.to_sym] = v }
    t.pbOwnSide.effects[PBEffects::Reflect] = 5 if c[:reflect]
    t.pbOwnSide.effects[PBEffects::LightScreen] = 5 if c[:light_screen]
    t.pbOwnSide.effects[PBEffects::AuroraVeil] = 5 if c[:aurora_veil]
    b.define_singleton_method(:pbSideBattlerCount) { |*a| c[:side_size] } if c[:side_size] > 1
    saved = []; held_pp = c[:pp] == "" ? nil : c[:pp]
    [[u, c[:user_effects]], [t, c[:target_effects]]].each { |x, list| list.each { |e, v| v = v.to_sym if v.is_a?(String)
      if e.start_with?("@") then was = x.instance_variable_get(e); saved << lambda { x.instance_variable_set(e, was) }; x.instance_variable_set(e, v)
      else k = PBEffects.const_get(e.to_sym); was = x.effects[k]; saved << lambda { x.effects[k] = was }; x.effects[k] = v end } }
    [[u, c[:user_side]], [t, c[:target_side]]].each { |x, list| list.each { |e| h = x.pbOwnSide.effects; k = PBEffects.const_get(e.to_sym)
      was = h[k]; saved << lambda { h[k] = was }; h[k] = 4 } }
    if c[:same_speed] then sp = t.speed; saved << lambda { t.speed = sp }; t.speed = u.speed end
    undo = []; c[:history].each { |key, v| hist.call(key, v, undo) }
    r = c[:odds_only] ? {} : both.call(u, t, c[:move].to_sym, c[:targets], c[:own_crit])
    r["odds"] = odds.call(u, t, c[:move].to_sym, c[:foe_move].to_sym) if c[:odds]
    undo.reverse_each(&:call)
    saved.reverse_each(&:call); held_pp = nil
    r["team"] = b.pbParty(u.index).select { |p| p.able? && p.status == :NONE }.map { |p| p.baseStats[:ATTACK] }
    b.singleton_class.send(:remove_method, :pbSideBattlerCount) if c[:side_size] > 1
    unstub.call(keep); r } } }
  out["passes"] = [pass.call]
  $game_variables[__CAPVAR__] = 0; mon = u.pokemon; mon.level = __LEVEL__; mon.ev[:ATTACK] = __EV__; mon.ev[:SPECIAL_ATTACK] = __EV__; u.pbUpdate
  out["passes"] << pass.call
"""
CALC_FOE_BODY = """
  t.hp = __HP__
  out["to_foe"] = both.call(u, t, :__MOVE__, 1); out["from_foe"] = both.call(t, u, :__MOVE__, 1)
"""
CALC_EXTREME_BODY = """
  p = t.pokemon
  out["extremes"] = __EXTREMES__.map { |iv, ev, nature|
    GameData::Stat.each_main { |s| p.iv[s.id] = iv; p.ev[s.id] = ev }; p.nature = nature.to_sym; p.calc_stats
    t.attack = p.attack; t.defense = p.defense; t.spatk = p.spatk; t.spdef = p.spdef; t.speed = p.speed
    t.instance_variable_set(:@totalhp, p.totalhp); t.hp = p.totalhp
    { "config" => [iv, ev, nature], "stats" => stat.call(t), "inputs" => inputs.call(t),
      "to_foe" => both.call(u, t, :__MOVE__, 1), "from_foe" => both.call(t, u, :__MOVE__, 1) } }
"""
CALC_FOE_MOVE = "TACKLE"
CALC_OWN_EFFECTS = """
b = AnilBridge.battle; u = b.battlers[0]; side = u.pbOwnSide.effects; e = u.effects
slots = [[side, PBEffects::LastRoundFainted], [side, PBEffects::EchoedVoiceCounter], [side, PBEffects::EchoedVoiceUsed],
  [b.instance_variable_get(:@rage_hit_count)[0], u.pokemonIndex], [b.instance_variable_get(:@fainted_count), 0],
  *__EFFECTS__.map { |n| [e, PBEffects.const_get(n)] }]
ivars = [[b, :@turnCount], [u, :@lastRoundMoveFailed], [u, :@turnCount], [u, :@statusCount]]
old = slots.map { |h, k| h[k] } + ivars.map { |o, n| o.instance_variable_get(n) }
new = __VALUES__
slots.each_with_index { |(h, k), i| h[k] = new[i] }
ivars.each_with_index { |(o, n), i| o.instance_variable_set(n, new[slots.length + i]) }
old
"""
CALC_OWN_EFFECT_SLOTS = {
    "HelpingHand": True,
    "MagnetRise": 3,
    "TwoTurnAttack": "DIG",
    "FuryCutter": 2,
    "Rollout": 3,
    "DefenseCurl": True,
    "Stockpile": 2,
    "Unburden": True,
    "SlowStart": 3,
    "ParadoxStat": "SPEED",
    "FocusEnergy": 2,
    "Confusion": 3,
    "Toxic": 5,
    "HealBlock": 3,
    "AquaRing": True,
    "LeechSeed": 1,
    "Curse": True,
    "Nightmare": True,
    "SaltCure": True,
    "Trapping": 3,
}
CALC_OWN_EFFECT_VALUES = {
    "helping_hand": True,
    "magnet_rise": 3,
    "two_turn_attack": "DIG",
    "fury_cutter": 2,
    "rollout": 3,
    "defense_curl": True,
    "stockpile": 2,
    "unburden": True,
    "slow_start": 3,
    "paradox_stat": "SPEED",
    "focus_energy": 2,
    "confusion": 3,
    "last_round_move_failed": True,
    "ally_fainted_last_round": True,
    "echoed_voice": 2,
    "echoed_voice_used": True,
    "times_hit": 3,
    "fainted_allies": 1,
    "turn_count": 4,
    "toxic": 5,
    "heal_block": 3,
    "aqua_ring": True,
    "leech_seed": 1,
    "curse": True,
    "nightmare": True,
    "salt_cure": True,
    "trapping": 3,
    "status_count": 1,
}
CALC_HP_MOVES = ("BRINE", "CRUSHGRIP", "FLAIL", "SUPERFANG", "ENDEAVOR")
CALC_GROUND_MOVE = "EARTHQUAKE"
CALC_GROUND_RISKS = ("ability LEVITATE", "held item AIRBALLOON")
CALC_UNMODELLED_ABILITY = "FRIENDGUARD"
CALC_FOE_PERCENT = 37
CALC_FOE_HP = """
t = AnilBridge.battle.battlers[1]; t.hp = [t.totalhp * __PERCENT__ / 100, 1].max; [t.hp, t.totalhp]
"""
CALC_STRONG_LEVEL = 60
CALC_STRONG_EV = 252
CALC_EXTREMES = (
    (31, 85, "ADAMANT"),
    (31, 85, "IMPISH"),
    (0, 0, "LONELY"),
    (0, 0, "MODEST"),
)


@dataclass(frozen=True)
class CalcCase:
    name: str
    move: str
    user_types: tuple[str, ...]
    target_types: tuple[str, ...]
    status: str = "NONE"
    weather: str = "None"
    terrain: str = "None"
    attack_stage: int = 0
    defense_stage: int = 0
    targets: int = 1
    reflect: bool = False
    light_screen: bool = False
    aurora_veil: bool = False
    side_size: int = 1
    user_ability: str | None = None
    target_ability: str | None = None
    user_item: str | None = None
    target_item: str | None = None
    target_status: str = "NONE"
    user_hp_divisor: int = 1
    target_hp_divisor: int = 1
    user_species: str | None = None
    target_species: str | None = None
    field: tuple[str, ...] = ()
    draw: int | None = None
    user_happiness: int | None = None
    ranged: bool = False
    own_crit: bool = False
    user_stages: tuple[tuple[str, int], ...] = ()
    target_stages: tuple[tuple[str, int], ...] = ()
    user_effects: tuple[tuple[str, Any], ...] = ()
    target_effects: tuple[tuple[str, Any], ...] = ()
    history: tuple[tuple[str, Any], ...] = ()
    user_hidden: bool = False
    pp: int | None = None
    user_side: tuple[str, ...] = ()
    target_side: tuple[str, ...] = ()
    odds: bool = False
    odds_only: bool = False
    foe_move: str = "TACKLE"
    same_speed: bool = False


CALC_CASES = (
    CalcCase("physical, STAB, neutral", "TACKLE", ("NORMAL",), ("NORMAL",)),
    CalcCase("physical, no STAB, neutral", "TACKLE", ("WATER",), ("NORMAL",)),
    CalcCase("physical, STAB, resisted", "TACKLE", ("NORMAL",), ("ROCK",)),
    CalcCase("special, STAB, super effective", "WATERGUN", ("WATER",), ("FIRE",)),
    CalcCase("special, no STAB, resisted", "WATERGUN", ("NORMAL",), ("GRASS",)),
    CalcCase("physical, STAB, 4x", "VINEWHIP", ("GRASS",), ("WATER", "GROUND")),
    CalcCase("physical, no STAB, 0.25x", "VINEWHIP", ("NORMAL",), ("FIRE", "FLYING")),
    CalcCase("special Water in rain", "WATERGUN", ("WATER",), ("NORMAL",), weather="Rain"),
    CalcCase("special Fire in rain", "EMBER", ("FIRE",), ("NORMAL",), weather="Rain"),
    CalcCase("special Fire in sun", "EMBER", ("FIRE",), ("NORMAL",), weather="Sun"),
    CalcCase("special Water in sun", "WATERGUN", ("WATER",), ("NORMAL",), weather="Sun"),
    CalcCase("physical, burned attacker", "TACKLE", ("NORMAL",), ("NORMAL",), status="BURN"),
    CalcCase("special, burned attacker", "WATERGUN", ("WATER",), ("NORMAL",), status="BURN"),
    CalcCase("Rock in sandstorm, special", "WATERGUN", ("NORMAL",), ("ROCK",), weather="Sandstorm"),
    CalcCase("Ice in snow, physical", "TACKLE", ("NORMAL",), ("ICE",), weather="Hail"),
    CalcCase(
        "stages +2 attack, -1 defense",
        "TACKLE",
        ("NORMAL",),
        ("NORMAL",),
        attack_stage=2,
        defense_stage=-1,
    ),
    CalcCase(
        "stages -2 attack, +2 defense",
        "WATERGUN",
        ("WATER",),
        ("NORMAL",),
        attack_stage=-2,
        defense_stage=2,
    ),
    CalcCase("Grass in Grassy Terrain", "VINEWHIP", ("GRASS",), ("NORMAL",), terrain="Grassy"),
    CalcCase("spread over two targets", "TACKLE", ("NORMAL",), ("NORMAL",), targets=2),
    CalcCase("physical into Reflect", "TACKLE", ("NORMAL",), ("NORMAL",), reflect=True),
    CalcCase("special into Light Screen", "WATERGUN", ("WATER",), ("NORMAL",), light_screen=True),
    CalcCase("physical into Aurora Veil", "TACKLE", ("NORMAL",), ("NORMAL",), aurora_veil=True),
    CalcCase(
        "special into Light Screen, two on the side",
        "WATERGUN",
        ("WATER",),
        ("NORMAL",),
        light_screen=True,
        side_size=2,
    ),
    CalcCase("Water in heavy rain", "WATERGUN", ("WATER",), ("NORMAL",), weather="HeavyRain"),
    CalcCase("Water in harsh sun", "WATERGUN", ("WATER",), ("NORMAL",), weather="HarshSun"),
    CalcCase(
        "Electric in Electric Terrain",
        "THUNDERSHOCK",
        ("ELECTRIC",),
        ("NORMAL",),
        terrain="Electric",
    ),
    CalcCase(
        "Psychic in Psychic Terrain", "CONFUSION", ("PSYCHIC",), ("NORMAL",), terrain="Psychic"
    ),
    CalcCase("Dragon in Misty Terrain", "DRAGONBREATH", ("DRAGON",), ("NORMAL",), terrain="Misty"),
)
NORMAL_PAIR = (("NORMAL",), ("NORMAL",))
WATER_PAIR = (("WATER",), ("NORMAL",))
FIRE_PAIR = (("FIRE",), ("NORMAL",))


def effect_case(
    name: str, move: str, pair: tuple[tuple[str, ...], tuple[str, ...]], **values: Any
) -> CalcCase:
    return CalcCase(name, move, pair[0], pair[1], **values)


CALC_EFFECT_CASES = (
    effect_case("Huge Power", "TACKLE", NORMAL_PAIR, user_ability="HUGEPOWER"),
    effect_case("Huge Power, special", "WATERGUN", WATER_PAIR, user_ability="HUGEPOWER"),
    effect_case("Hustle, special", "WATERGUN", WATER_PAIR, user_ability="HUSTLE"),
    effect_case("Gorilla Tactics", "TACKLE", NORMAL_PAIR, user_ability="GORILLATACTICS"),
    effect_case("Poder Sabio", "WATERGUN", WATER_PAIR, user_ability="PODERSABIO"),
    effect_case("Guts, burned", "TACKLE", NORMAL_PAIR, user_ability="GUTS", status="BURN"),
    effect_case("Blaze at a third", "EMBER", FIRE_PAIR, user_ability="BLAZE", user_hp_divisor=3),
    effect_case("Torrent at full HP", "WATERGUN", WATER_PAIR, user_ability="TORRENT"),
    effect_case(
        "Defeatist at half", "TACKLE", NORMAL_PAIR, user_ability="DEFEATIST", user_hp_divisor=2
    ),
    effect_case("Steelworker", "CUT", NORMAL_PAIR, user_ability="STEELWORKER"),
    effect_case("Transistor", "THUNDERSHOCK", NORMAL_PAIR, user_ability="TRANSISTOR"),
    effect_case("Water Bubble, user", "WATERGUN", WATER_PAIR, user_ability="WATERBUBBLE"),
    effect_case("Flare Boost", "EMBER", FIRE_PAIR, user_ability="FLAREBOOST", status="BURN"),
    effect_case("Toxic Boost", "TACKLE", NORMAL_PAIR, user_ability="TOXICBOOST", status="POISON"),
    effect_case("Solar Power in sun", "EMBER", FIRE_PAIR, user_ability="SOLARPOWER", weather="Sun"),
    effect_case(
        "Flower Gift in sun", "TACKLE", NORMAL_PAIR, user_ability="FLOWERGIFT", weather="Sun"
    ),
    effect_case(
        "Orichalcum Pulse in sun",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="ORICHALCUMPULSE",
        weather="Sun",
    ),
    effect_case(
        "Hadron Engine, Electric Terrain",
        "WATERGUN",
        WATER_PAIR,
        user_ability="HADRONENGINE",
        terrain="Electric",
    ),
    effect_case(
        "Silvano, Grassy Terrain", "TACKLE", NORMAL_PAIR, user_ability="SILVANO", terrain="Grassy"
    ),
    effect_case(
        "Poder Gelido in snow",
        "POWDERSNOW",
        (("ICE",), ("NORMAL",)),
        user_ability="PODERGELIDO",
        weather="Hail",
    ),
    effect_case("Realeza, no STAB", "WATERGUN", NORMAL_PAIR, user_ability="REALEZA"),
    effect_case("Iron Fist", "MEGAPUNCH", NORMAL_PAIR, user_ability="IRONFIST"),
    effect_case("Camorrista", "DOUBLEKICK", NORMAL_PAIR, user_ability="CAMORRISTA"),
    effect_case("Mega Launcher", "WATERPULSE", WATER_PAIR, user_ability="MEGALAUNCHER"),
    effect_case("Strong Jaw", "BITE", NORMAL_PAIR, user_ability="STRONGJAW"),
    effect_case("Sharpness", "CUT", NORMAL_PAIR, user_ability="SHARPNESS"),
    effect_case("Tough Claws", "TACKLE", NORMAL_PAIR, user_ability="TOUGHCLAWS"),
    effect_case("Punk Rock, user", "HYPERVOICE", NORMAL_PAIR, user_ability="PUNKROCK"),
    effect_case(
        "Sand Force in sandstorm",
        "ROCKTHROW",
        NORMAL_PAIR,
        user_ability="SANDFORCE",
        weather="Sandstorm",
    ),
    effect_case("Sheer Force", "EMBER", FIRE_PAIR, user_ability="SHEERFORCE"),
    effect_case("Technician, 40 power", "TACKLE", NORMAL_PAIR, user_ability="TECHNICIAN"),
    effect_case("Technician, 80 power", "MEGAPUNCH", NORMAL_PAIR, user_ability="TECHNICIAN"),
    effect_case(
        "Tinted Lens, resisted", "TACKLE", (("NORMAL",), ("ROCK",)), user_ability="TINTEDLENS"
    ),
    effect_case("Sniper", "TACKLE", NORMAL_PAIR, user_ability="SNIPER"),
    effect_case("Neuroforce", "WATERGUN", (("WATER",), ("FIRE",)), user_ability="NEUROFORCE"),
    effect_case("Steely Spirit", "CUT", NORMAL_PAIR, user_ability="STEELYSPIRIT"),
    effect_case("Adaptability", "TACKLE", NORMAL_PAIR, user_ability="ADAPTABILITY"),
    effect_case(
        "Infiltrator into Reflect", "TACKLE", NORMAL_PAIR, user_ability="INFILTRATOR", reflect=True
    ),
    effect_case("Scrappy into Ghost", "TACKLE", (("NORMAL",), ("GHOST",)), user_ability="SCRAPPY"),
    effect_case(
        "Mind's Eye into Ghost", "TACKLE", (("NORMAL",), ("GHOST",)), user_ability="MINDSEYE"
    ),
    effect_case(
        "Unaware user, +2 Defense", "TACKLE", NORMAL_PAIR, user_ability="UNAWARE", defense_stage=2
    ),
    effect_case(
        "Unaware target, +2 Attack", "TACKLE", NORMAL_PAIR, target_ability="UNAWARE", attack_stage=2
    ),
    effect_case(
        "Mold Breaker into Thick Fat",
        "EMBER",
        FIRE_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="THICKFAT",
    ),
    effect_case("Dark Aura", "BITE", NORMAL_PAIR, user_ability="DARKAURA"),
    effect_case(
        "Fairy Aura with Aura Break",
        "DAZZLINGGLEAM",
        NORMAL_PAIR,
        user_ability="FAIRYAURA",
        target_ability="AURABREAK",
    ),
    effect_case(
        "Tablets of Ruin on the target", "TACKLE", NORMAL_PAIR, target_ability="TABLETSOFRUIN"
    ),
    effect_case("Sword of Ruin on the user", "TACKLE", NORMAL_PAIR, user_ability="SWORDOFRUIN"),
    effect_case(
        "Vessel of Ruin on the target", "WATERGUN", WATER_PAIR, target_ability="VESSELOFRUIN"
    ),
    effect_case("Beads of Ruin on the user", "WATERGUN", WATER_PAIR, user_ability="BEADSOFRUIN"),
    effect_case(
        "Cloud Nine in rain", "WATERGUN", WATER_PAIR, target_ability="CLOUDNINE", weather="Rain"
    ),
    effect_case(
        "Neutralizing Gas against Huge Power",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="HUGEPOWER",
        target_ability="NEUTRALIZINGGAS",
    ),
    effect_case("Dry Skin, Fire", "EMBER", FIRE_PAIR, target_ability="DRYSKIN"),
    effect_case(
        "Filter, super effective", "WATERGUN", (("WATER",), ("FIRE",)), target_ability="FILTER"
    ),
    effect_case(
        "Prism Armor through Mold Breaker",
        "WATERGUN",
        (("WATER",), ("FIRE",)),
        user_ability="MOLDBREAKER",
        target_ability="PRISMARMOR",
    ),
    effect_case(
        "Flower Gift target in sun",
        "WATERGUN",
        WATER_PAIR,
        target_ability="FLOWERGIFT",
        weather="Sun",
    ),
    effect_case("Fluffy, contact", "TACKLE", NORMAL_PAIR, target_ability="FLUFFY"),
    effect_case("Fluffy, Fire", "EMBER", FIRE_PAIR, target_ability="FLUFFY"),
    effect_case(
        "Fluffy, Punching Glove",
        "MEGAPUNCH",
        NORMAL_PAIR,
        target_ability="FLUFFY",
        user_item="PUNCHINGGLOVE",
    ),
    effect_case("Fur Coat", "TACKLE", NORMAL_PAIR, target_ability="FURCOAT"),
    effect_case(
        "Grass Pelt, Grassy Terrain",
        "TACKLE",
        NORMAL_PAIR,
        target_ability="GRASSPELT",
        terrain="Grassy",
    ),
    effect_case("Heatproof", "EMBER", FIRE_PAIR, target_ability="HEATPROOF"),
    effect_case("Ice Scales", "WATERGUN", WATER_PAIR, target_ability="ICESCALES"),
    effect_case(
        "Marvel Scale, burned",
        "TACKLE",
        NORMAL_PAIR,
        target_ability="MARVELSCALE",
        target_status="BURN",
    ),
    effect_case("Multiscale at full HP", "TACKLE", NORMAL_PAIR, target_ability="MULTISCALE"),
    effect_case(
        "Multiscale at half",
        "TACKLE",
        NORMAL_PAIR,
        target_ability="MULTISCALE",
        target_hp_divisor=2,
    ),
    effect_case(
        "Shadow Shield through Mold Breaker",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="SHADOWSHIELD",
    ),
    effect_case("Punk Rock, target", "HYPERVOICE", NORMAL_PAIR, target_ability="PUNKROCK"),
    effect_case("Thick Fat, Ice", "POWDERSNOW", (("ICE",), ("NORMAL",)), target_ability="THICKFAT"),
    effect_case(
        "Purifying Salt", "SHADOWSNEAK", (("GHOST",), ("PSYCHIC",)), target_ability="PURIFYINGSALT"
    ),
    effect_case("Water Bubble, target", "EMBER", FIRE_PAIR, target_ability="WATERBUBBLE"),
    effect_case("Levitate, Ground", "EARTHQUAKE", NORMAL_PAIR, target_ability="LEVITATE"),
    effect_case(
        "Levitate through Mold Breaker",
        "EARTHQUAKE",
        NORMAL_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="LEVITATE",
    ),
    effect_case("Air Balloon, Ground", "EARTHQUAKE", NORMAL_PAIR, target_item="AIRBALLOON"),
    effect_case(
        "Iron Ball on a Flying target",
        "EARTHQUAKE",
        (("NORMAL",), ("FLYING",)),
        target_item="IRONBALL",
    ),
    effect_case(
        "Gravity on a Flying target", "EARTHQUAKE", (("NORMAL",), ("FLYING",)), field=("Gravity",)
    ),
    effect_case("Flash Fire", "EMBER", FIRE_PAIR, target_ability="FLASHFIRE"),
    effect_case("Well-Baked Body", "EMBER", FIRE_PAIR, target_ability="WELLBAKEDBODY"),
    effect_case("Water Absorb", "WATERGUN", WATER_PAIR, target_ability="WATERABSORB"),
    effect_case("Dry Skin, Water", "WATERGUN", WATER_PAIR, target_ability="DRYSKIN"),
    effect_case("Storm Drain", "WATERGUN", WATER_PAIR, target_ability="STORMDRAIN"),
    effect_case("Volt Absorb", "THUNDERSHOCK", NORMAL_PAIR, target_ability="VOLTABSORB"),
    effect_case("Lightning Rod", "THUNDERSHOCK", NORMAL_PAIR, target_ability="LIGHTNINGROD"),
    effect_case("Motor Drive", "THUNDERSHOCK", NORMAL_PAIR, target_ability="MOTORDRIVE"),
    effect_case("Sap Sipper", "VINEWHIP", NORMAL_PAIR, target_ability="SAPSIPPER"),
    effect_case("Earth Eater", "EARTHQUAKE", NORMAL_PAIR, target_ability="EARTHEATER"),
    effect_case("Bulletproof", "SLUDGEBOMB", NORMAL_PAIR, target_ability="BULLETPROOF"),
    effect_case("Soundproof", "HYPERVOICE", NORMAL_PAIR, target_ability="SOUNDPROOF"),
    effect_case("Wind Rider", "GUST", NORMAL_PAIR, target_ability="WINDRIDER"),
    effect_case("Wonder Guard, neutral", "TACKLE", NORMAL_PAIR, target_ability="WONDERGUARD"),
    effect_case(
        "Wonder Guard, super effective",
        "WATERGUN",
        (("WATER",), ("FIRE",)),
        target_ability="WONDERGUARD",
    ),
    effect_case(
        "Ring Target into Ghost", "TACKLE", (("NORMAL",), ("GHOST",)), target_item="RINGTARGET"
    ),
    effect_case("Charcoal", "EMBER", FIRE_PAIR, user_item="CHARCOAL"),
    effect_case("Flame Plate", "EMBER", FIRE_PAIR, user_item="FLAMEPLATE"),
    effect_case("Fire Gem", "EMBER", FIRE_PAIR, user_item="FIREGEM"),
    effect_case("Choice Band", "TACKLE", NORMAL_PAIR, user_item="CHOICEBAND"),
    effect_case("Choice Specs", "WATERGUN", WATER_PAIR, user_item="CHOICESPECS"),
    effect_case("Muscle Band", "TACKLE", NORMAL_PAIR, user_item="MUSCLEBAND"),
    effect_case("Wise Glasses", "WATERGUN", WATER_PAIR, user_item="WISEGLASSES"),
    effect_case("Punching Glove", "MEGAPUNCH", NORMAL_PAIR, user_item="PUNCHINGGLOVE"),
    effect_case("Life Orb", "TACKLE", NORMAL_PAIR, user_item="LIFEORB"),
    effect_case("Expert Belt", "WATERGUN", (("WATER",), ("FIRE",)), user_item="EXPERTBELT"),
    effect_case(
        "Light Ball on Pikachu",
        "TACKLE",
        NORMAL_PAIR,
        user_item="LIGHTBALL",
        user_species="PIKACHU",
    ),
    effect_case(
        "Thick Club on Cubone", "TACKLE", NORMAL_PAIR, user_item="THICKCLUB", user_species="CUBONE"
    ),
    effect_case(
        "Deep Sea Tooth on Clamperl",
        "WATERGUN",
        WATER_PAIR,
        user_item="DEEPSEATOOTH",
        user_species="CLAMPERL",
    ),
    effect_case(
        "Adamant Orb on Dialga",
        "DRAGONBREATH",
        (("DRAGON",), ("NORMAL",)),
        user_item="ADAMANTORB",
        user_species="DIALGA",
    ),
    effect_case(
        "Soul Dew on Latias",
        "CONFUSION",
        (("PSYCHIC",), ("NORMAL",)),
        user_item="SOULDEW",
        user_species="LATIAS",
    ),
    effect_case(
        "Super Eviolite, user with two evolutions",
        "TACKLE",
        NORMAL_PAIR,
        user_item="SUPEREVIOLITE",
        user_species="EEVEE",
    ),
    effect_case(
        "Super Eviolite, user with one evolution", "TACKLE", NORMAL_PAIR, user_item="SUPEREVIOLITE"
    ),
    effect_case(
        "Utility Umbrella in rain",
        "WATERGUN",
        WATER_PAIR,
        user_item="UTILITYUMBRELLA",
        weather="Rain",
    ),
    effect_case(
        "Klutz with Choice Band",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="KLUTZ",
        user_item="CHOICEBAND",
    ),
    effect_case("Assault Vest", "WATERGUN", WATER_PAIR, target_item="ASSAULTVEST"),
    effect_case(
        "Occa Berry, super effective", "EMBER", (("FIRE",), ("GRASS",)), target_item="OCCABERRY"
    ),
    effect_case("Occa Berry, neutral", "EMBER", FIRE_PAIR, target_item="OCCABERRY"),
    effect_case(
        "Occa Berry with Ripen",
        "EMBER",
        (("FIRE",), ("GRASS",)),
        target_item="OCCABERRY",
        target_ability="RIPEN",
    ),
    effect_case("Chilan Berry", "TACKLE", NORMAL_PAIR, target_item="CHILANBERRY"),
    effect_case(
        "Deep Sea Scale on Clamperl",
        "WATERGUN",
        WATER_PAIR,
        target_item="DEEPSEASCALE",
        target_species="CLAMPERL",
    ),
    effect_case("Eviolite on a target that evolves", "TACKLE", NORMAL_PAIR, target_item="EVIOLITE"),
    effect_case(
        "Eviolite on Ditto", "TACKLE", NORMAL_PAIR, target_item="EVIOLITE", target_species="DITTO"
    ),
    effect_case(
        "Super Eviolite, target with two evolutions",
        "TACKLE",
        NORMAL_PAIR,
        target_item="SUPEREVIOLITE",
        target_species="EEVEE",
    ),
    effect_case(
        "Metal Powder on Ditto",
        "TACKLE",
        NORMAL_PAIR,
        target_item="METALPOWDER",
        target_species="DITTO",
    ),
    effect_case(
        "Magic Room with Choice Band",
        "TACKLE",
        NORMAL_PAIR,
        user_item="CHOICEBAND",
        field=("MagicRoom",),
    ),
    effect_case("Mud Sport", "THUNDERSHOCK", NORMAL_PAIR, field=("MudSportField",)),
    effect_case("Pure Power", "TACKLE", NORMAL_PAIR, user_ability="PUREPOWER"),
    effect_case(
        "Overgrow at a third", "VINEWHIP", NORMAL_PAIR, user_ability="OVERGROW", user_hp_divisor=3
    ),
    effect_case(
        "Torrent at a third", "WATERGUN", WATER_PAIR, user_ability="TORRENT", user_hp_divisor=3
    ),
    effect_case(
        "Swarm at a third", "XSCISSOR", NORMAL_PAIR, user_ability="SWARM", user_hp_divisor=3
    ),
    effect_case(
        "Sobrecarga at a third",
        "THUNDERSHOCK",
        NORMAL_PAIR,
        user_ability="SOBRECARGA",
        user_hp_divisor=3,
    ),
    effect_case("Dragon's Maw", "DRAGONBREATH", NORMAL_PAIR, user_ability="DRAGONSMAW"),
    effect_case("Rocky Payload", "ROCKTHROW", NORMAL_PAIR, user_ability="ROCKYPAYLOAD"),
    effect_case("Coleoptero", "XSCISSOR", NORMAL_PAIR, user_ability="COLEOPTERO"),
    effect_case("Inflamable", "EMBER", NORMAL_PAIR, user_ability="INFLAMABLE"),
    effect_case("Albinismo", "POWDERSNOW", NORMAL_PAIR, user_ability="ALBINISMO"),
    effect_case("Floracion", "VINEWHIP", NORMAL_PAIR, user_ability="FLORACION"),
    effect_case("Solid Rock", "WATERGUN", (("WATER",), ("FIRE",)), target_ability="SOLIDROCK"),
    effect_case(
        "Teravolt into Thick Fat",
        "EMBER",
        FIRE_PAIR,
        user_ability="TERAVOLT",
        target_ability="THICKFAT",
    ),
    effect_case(
        "Turboblaze into Levitate",
        "EARTHQUAKE",
        NORMAL_PAIR,
        user_ability="TURBOBLAZE",
        target_ability="LEVITATE",
    ),
    effect_case(
        "Mold Breaker into Unaware, +2 Attack",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="UNAWARE",
        attack_stage=2,
    ),
    effect_case(
        "Ability Shield against Mold Breaker, Levitate",
        "EARTHQUAKE",
        NORMAL_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="LEVITATE",
        target_item="ABILITYSHIELD",
    ),
    effect_case(
        "Ability Shield against Mold Breaker, Thick Fat",
        "EMBER",
        FIRE_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="THICKFAT",
        target_item="ABILITYSHIELD",
    ),
    effect_case("Air Lock in sun", "EMBER", FIRE_PAIR, user_ability="AIRLOCK", weather="Sun"),
    effect_case(
        "Long Reach into Fluffy",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="LONGREACH",
        target_ability="FLUFFY",
    ),
    effect_case(
        "Light Ball on Raichu", "TACKLE", NORMAL_PAIR, user_item="LIGHTBALL", user_species="RAICHU"
    ),
    effect_case(
        "Thick Club on Marowak",
        "TACKLE",
        NORMAL_PAIR,
        user_item="THICKCLUB",
        user_species="MAROWAK",
    ),
    effect_case(
        "Soul Dew on Latios",
        "DRAGONBREATH",
        (("DRAGON",), ("NORMAL",)),
        user_item="SOULDEW",
        user_species="LATIOS",
    ),
    effect_case(
        "Utility Umbrella in sun", "EMBER", FIRE_PAIR, user_item="UTILITYUMBRELLA", weather="Sun"
    ),
    effect_case(
        "Utility Umbrella on the target in rain",
        "WATERGUN",
        WATER_PAIR,
        target_item="UTILITYUMBRELLA",
        weather="Rain",
    ),
    effect_case(
        "Metal Powder, special",
        "WATERGUN",
        WATER_PAIR,
        target_item="METALPOWDER",
        target_species="DITTO",
    ),
    effect_case(
        "Iron Ball on a Steel and Flying target",
        "EARTHQUAKE",
        (("NORMAL",), ("STEEL", "FLYING")),
        target_item="IRONBALL",
    ),
    effect_case(
        "Ring Target with Levitate on a Flying target",
        "EARTHQUAKE",
        (("NORMAL",), ("FLYING",)),
        target_item="RINGTARGET",
        target_ability="LEVITATE",
    ),
    effect_case(
        "Ring Target on a Flying target",
        "EARTHQUAKE",
        (("NORMAL",), ("FLYING",)),
        target_item="RINGTARGET",
    ),
    effect_case("Water Sport", "EMBER", FIRE_PAIR, field=("WaterSportField",)),
)
FIGHTING_PAIR = (("FIGHTING",), ("NORMAL",))
GROUND_PAIR = (("GROUND",), ("NORMAL",))
PSYCHIC_PAIR = (("PSYCHIC",), ("NORMAL",))
GHOST_INTO_PSYCHIC = (("GHOST",), ("PSYCHIC",))
CALC_MOVE_CASES = (
    effect_case("Sonic Boom", "SONICBOOM", NORMAL_PAIR),
    effect_case("Dragon Rage", "DRAGONRAGE", (("DRAGON",), ("NORMAL",))),
    effect_case("Super Fang at a third", "SUPERFANG", NORMAL_PAIR, target_hp_divisor=3),
    effect_case("Seismic Toss", "SEISMICTOSS", FIGHTING_PAIR),
    effect_case("Night Shade into Normal", "NIGHTSHADE", (("GHOST",), ("NORMAL",))),
    effect_case("Psywave", "PSYWAVE", PSYCHIC_PAIR, draw=5, ranged=True),
    effect_case("Endeavor at a third", "ENDEAVOR", NORMAL_PAIR, user_hp_divisor=3),
    effect_case("Endeavor into half, fails", "ENDEAVOR", NORMAL_PAIR, target_hp_divisor=2),
    effect_case("Final Gambit at half", "FINALGAMBIT", FIGHTING_PAIR, user_hp_divisor=2),
    effect_case("Horn Drill", "HORNDRILL", NORMAL_PAIR),
    effect_case("Horn Drill into Sturdy", "HORNDRILL", NORMAL_PAIR, target_ability="STURDY"),
    effect_case("Fissure", "FISSURE", GROUND_PAIR),
    effect_case("Sheer Cold", "SHEERCOLD", (("ICE",), ("NORMAL",))),
    effect_case("Sheer Cold into Ice", "SHEERCOLD", (("ICE",), ("ICE",))),
    effect_case("Eruption at half", "ERUPTION", FIRE_PAIR, user_hp_divisor=2),
    effect_case("Flail at a fifth", "FLAIL", NORMAL_PAIR, user_hp_divisor=5),
    effect_case(
        "Flail at half, Technician",
        "FLAIL",
        NORMAL_PAIR,
        user_hp_divisor=2,
        user_ability="TECHNICIAN",
    ),
    effect_case("Crush Grip into a third", "CRUSHGRIP", NORMAL_PAIR, target_hp_divisor=3),
    effect_case(
        "Hard Press into half", "HARDPRESS", (("STEEL",), ("NORMAL",)), target_hp_divisor=2
    ),
    effect_case("Stored Power at +2", "STOREDPOWER", PSYCHIC_PAIR, attack_stage=2),
    effect_case("Punishment into +2", "PUNISHMENT", (("DARK",), ("NORMAL",)), defense_stage=2),
    effect_case("Low Kick into Snorlax", "LOWKICK", FIGHTING_PAIR, target_species="SNORLAX"),
    effect_case(
        "Grass Knot into Light Metal Onix",
        "GRASSKNOT",
        (("GRASS",), ("NORMAL",)),
        target_species="ONIX",
        target_ability="LIGHTMETAL",
    ),
    effect_case(
        "Heavy Slam, Snorlax into Onix with Float Stone",
        "HEAVYSLAM",
        (("STEEL",), ("NORMAL",)),
        user_species="SNORLAX",
        target_species="ONIX",
        target_item="FLOATSTONE",
    ),
    effect_case("Return at 255", "RETURN", NORMAL_PAIR, user_happiness=255),
    effect_case("Frustration at 0", "FRUSTRATION", NORMAL_PAIR, user_happiness=0),
    effect_case("Brine into half", "BRINE", WATER_PAIR, target_hp_divisor=2),
    effect_case(
        "Venoshock into poison", "VENOSHOCK", (("POISON",), ("NORMAL",)), target_status="POISON"
    ),
    effect_case("Hex into paralysis", "HEX", GHOST_INTO_PSYCHIC, target_status="PARALYSIS"),
    effect_case(
        "Smelling Salts into paralysis", "SMELLINGSALTS", NORMAL_PAIR, target_status="PARALYSIS"
    ),
    effect_case("Wake-Up Slap into sleep", "WAKEUPSLAP", FIGHTING_PAIR, target_status="SLEEP"),
    effect_case(
        "Barb Barrage into poison",
        "BARBBARRAGE",
        (("POISON",), ("NORMAL",)),
        target_status="POISON",
    ),
    effect_case(
        "Infernal Parade into burn", "INFERNALPARADE", GHOST_INTO_PSYCHIC, target_status="BURN"
    ),
    effect_case("Facade, burned", "FACADE", NORMAL_PAIR, status="BURN"),
    effect_case("Acrobatics, no item", "ACROBATICS", (("FLYING",), ("NORMAL",))),
    effect_case(
        "Acrobatics, Leftovers", "ACROBATICS", (("FLYING",), ("NORMAL",)), user_item="LEFTOVERS"
    ),
    effect_case(
        "Rising Voltage, Electric Terrain",
        "RISINGVOLTAGE",
        (("ELECTRIC",), ("NORMAL",)),
        terrain="Electric",
    ),
    effect_case(
        "Expanding Force, Psychic Terrain", "EXPANDINGFORCE", PSYCHIC_PAIR, terrain="Psychic"
    ),
    effect_case("Grav Apple, Gravity", "GRAVAPPLE", (("GRASS",), ("NORMAL",)), field=("Gravity",)),
    effect_case("Bulldoze, Grassy Terrain", "BULLDOZE", GROUND_PAIR, terrain="Grassy"),
    effect_case("Earthquake, Grassy Terrain", "EARTHQUAKE", GROUND_PAIR, terrain="Grassy"),
    effect_case("Collision Course, super effective", "COLLISIONCOURSE", FIGHTING_PAIR),
    effect_case("Solar Beam in rain", "SOLARBEAM", (("GRASS",), ("NORMAL",)), weather="Rain"),
    effect_case("Psyblade, Electric Terrain", "PSYBLADE", PSYCHIC_PAIR, terrain="Electric"),
    effect_case("Hydro Steam in sun", "HYDROSTEAM", WATER_PAIR, weather="Sun"),
    effect_case("Magnitude 10", "MAGNITUDE", GROUND_PAIR, draw=19, ranged=True),
    effect_case("Present, 120", "PRESENT", NORMAL_PAIR, draw=75, ranged=True),
    effect_case(
        "Fickle Beam, doubled", "FICKLEBEAM", (("DRAGON",), ("NORMAL",)), draw=10, ranged=True
    ),
    effect_case(
        "Acrobatics, Flying Gem", "ACROBATICS", (("FLYING",), ("NORMAL",)), user_item="FLYINGGEM"
    ),
    effect_case("Surf", "SURF", WATER_PAIR),
    effect_case("Whirlpool", "WHIRLPOOL", WATER_PAIR),
    effect_case("Gust", "GUST", (("FLYING",), ("NORMAL",))),
    effect_case("Twister", "TWISTER", (("DRAGON",), ("NORMAL",))),
)
NORMAL_INTO_GRASS = (("NORMAL",), ("GRASS",))
CALC_TYPE_CASES = (
    effect_case("Hidden Power, the user's IVs", "HIDDENPOWER", NORMAL_PAIR),
    effect_case(
        "Judgment, Flame Plate into Grass", "JUDGMENT", NORMAL_INTO_GRASS, user_item="FLAMEPLATE"
    ),
    effect_case("Judgment, no item", "JUDGMENT", NORMAL_PAIR),
    effect_case(
        "Techno Blast, Douse Drive into Fire",
        "TECHNOBLAST",
        (("NORMAL",), ("FIRE",)),
        user_item="DOUSEDRIVE",
    ),
    effect_case(
        "Multi-Attack, Fire Memory into Grass",
        "MULTIATTACK",
        NORMAL_INTO_GRASS,
        user_item="FIREMEMORY",
    ),
    effect_case(
        "Aura Wheel, Hangry Morpeko into Psychic",
        "AURAWHEEL",
        (("ELECTRIC", "DARK"), ("PSYCHIC",)),
        user_species="MORPEKO_1",
    ),
    effect_case(
        "Aura Wheel, Full Belly Morpeko into Water",
        "AURAWHEEL",
        (("ELECTRIC", "DARK"), ("WATER",)),
        user_species="MORPEKO",
    ),
    effect_case(
        "Revelation Dance from a Fire type into Grass",
        "REVELATIONDANCE",
        (("FIRE", "FLYING"), ("GRASS",)),
    ),
    effect_case(
        "Ivy Cudgel, Wellspring Ogerpon into Fire",
        "IVYCUDGEL",
        (("GRASS", "WATER"), ("FIRE",)),
        user_species="OGERPON_1",
    ),
    effect_case(
        "Raging Bull, Blaze Tauros into Grass through Reflect",
        "RAGINGBULL",
        (("FIGHTING", "FIRE"), ("GRASS",)),
        user_species="TAUROS_2",
        reflect=True,
    ),
    effect_case("Raging Bull, not Tauros", "RAGINGBULL", NORMAL_PAIR),
    effect_case("Weather Ball in sun", "WEATHERBALL", NORMAL_PAIR, weather="Sun"),
    effect_case(
        "Weather Ball in sandstorm into Fire",
        "WEATHERBALL",
        (("NORMAL",), ("FIRE",)),
        weather="Sandstorm",
    ),
    effect_case(
        "Weather Ball in snow into Grass", "WEATHERBALL", NORMAL_INTO_GRASS, weather="Hail"
    ),
    effect_case(
        "Terrain Pulse, Misty Terrain into Dragon",
        "TERRAINPULSE",
        (("NORMAL",), ("DRAGON",)),
        terrain="Misty",
    ),
    effect_case("Terrain Pulse, Electric Terrain", "TERRAINPULSE", NORMAL_PAIR, terrain="Electric"),
    effect_case(
        "Natural Gift, Cheri Berry into Grass",
        "NATURALGIFT",
        NORMAL_INTO_GRASS,
        user_item="CHERIBERRY",
    ),
    effect_case("Flying Press into Grass", "FLYINGPRESS", (("FIGHTING",), ("GRASS",))),
    effect_case("Flying Press into Ghost", "FLYINGPRESS", (("FIGHTING",), ("GHOST",))),
    effect_case("Freeze-Dry into Water", "FREEZEDRY", (("ICE",), ("WATER",))),
    effect_case("Freeze-Dry into Water and Grass", "FREEZEDRY", (("ICE",), ("WATER", "GRASS"))),
    effect_case("Atrapabicho into Bug", "ATRAPAMOSCAS", (("GRASS",), ("BUG",))),
    effect_case("Smack Down into Flying", "SMACKDOWN", (("ROCK",), ("FLYING",))),
    effect_case("Thousand Arrows into Flying", "THOUSANDARROWS", (("GROUND",), ("FLYING",))),
    effect_case(
        "Thousand Arrows into Levitate", "THOUSANDARROWS", GROUND_PAIR, target_ability="LEVITATE"
    ),
    effect_case("Sky Drop", "SKYDROP", (("FLYING",), ("NORMAL",))),
    effect_case("Sky Drop into Flying", "SKYDROP", (("FLYING",), ("FLYING",))),
    effect_case(
        "Sky Drop into Snorlax, fails",
        "SKYDROP",
        (("FLYING",), ("NORMAL",)),
        target_species="SNORLAX",
    ),
    effect_case(
        "Pixilate Tackle into Dragon",
        "TACKLE",
        (("NORMAL",), ("DRAGON",)),
        user_ability="PIXILATE",
    ),
    effect_case("Aerilate Tackle into Grass", "TACKLE", NORMAL_INTO_GRASS, user_ability="AERILATE"),
    effect_case(
        "Galvanize Tackle into Water",
        "TACKLE",
        (("NORMAL",), ("WATER",)),
        user_ability="GALVANIZE",
    ),
    effect_case(
        "Refrigerate Tackle into Grass", "TACKLE", NORMAL_INTO_GRASS, user_ability="REFRIGERATE"
    ),
    effect_case(
        "Piel Tetrica Tackle into Psychic",
        "TACKLE",
        (("NORMAL",), ("PSYCHIC",)),
        user_ability="PIELMALDITA",
    ),
    effect_case(
        "Piel Herbacea Tackle into Water",
        "TACKLE",
        (("NORMAL",), ("WATER",)),
        user_ability="PIELHERBACEA",
    ),
    effect_case("Pixilate Ember, not Normal", "EMBER", FIRE_PAIR, user_ability="PIXILATE"),
    effect_case("Pixilate Weather Ball", "WEATHERBALL", NORMAL_PAIR, user_ability="PIXILATE"),
    effect_case(
        "Normalize Ember into Rock", "EMBER", (("FIRE",), ("ROCK",)), user_ability="NORMALIZE"
    ),
    effect_case(
        "Liquid Voice Hyper Voice into Fire",
        "HYPERVOICE",
        (("NORMAL",), ("FIRE",)),
        user_ability="LIQUIDVOICE",
    ),
    effect_case(
        "Liquid Voice Bug Buzz into Fire",
        "BUGBUZZ",
        (("BUG",), ("FIRE",)),
        user_ability="LIQUIDVOICE",
    ),
    effect_case(
        "Tintineo Hyper Voice into Fighting",
        "HYPERVOICE",
        (("NORMAL",), ("FIGHTING",)),
        user_ability="TINTINEO",
    ),
)
GRASS_PAIR = (("GRASS",), ("NORMAL",))
DRAGON_PAIR = (("DRAGON",), ("NORMAL",))
CALC_HIT_CASES = (
    effect_case("Double Kick", "DOUBLEKICK", FIGHTING_PAIR),
    effect_case("Twineedle", "TWINEEDLE", (("BUG",), ("NORMAL",))),
    effect_case("Double Iron Bash", "DOUBLEIRONBASH", (("STEEL",), ("NORMAL",))),
    effect_case("Triple Dive", "TRIPLEDIVE", WATER_PAIR),
    effect_case("Surging Strikes", "SURGINGSTRIKES", WATER_PAIR, own_crit=True),
    effect_case(
        "Surging Strikes into Battle Armor",
        "SURGINGSTRIKES",
        WATER_PAIR,
        target_ability="BATTLEARMOR",
        own_crit=True,
    ),
    effect_case("Triple Kick", "TRIPLEKICK", FIGHTING_PAIR),
    effect_case("Triple Axel", "TRIPLEAXEL", (("ICE",), ("NORMAL",))),
    effect_case("Triple Hit", "TRIPLEHIT", NORMAL_PAIR),
    effect_case("Triple Kick, Technician", "TRIPLEKICK", FIGHTING_PAIR, user_ability="TECHNICIAN"),
    effect_case("Bullet Seed, 2 hits", "BULLETSEED", GRASS_PAIR, draw=0),
    effect_case("Bullet Seed, 3 hits", "BULLETSEED", GRASS_PAIR, draw=10),
    effect_case("Bullet Seed, 5 hits", "BULLETSEED", GRASS_PAIR, draw=19),
    effect_case(
        "Bullet Seed, Skill Link", "BULLETSEED", GRASS_PAIR, draw=0, user_ability="SKILLLINK"
    ),
    effect_case("Bullet Seed, Loaded Dice", "BULLETSEED", GRASS_PAIR, user_item="LOADEDDICE"),
    effect_case(
        "Bullet Seed into a Rindo Berry, 4 hits",
        "BULLETSEED",
        (("GRASS",), ("WATER",)),
        draw=15,
        target_item="RINDOBERRY",
    ),
    effect_case(
        "Bullet Seed into Multiscale, 3 hits",
        "BULLETSEED",
        GRASS_PAIR,
        draw=10,
        target_ability="MULTISCALE",
    ),
    effect_case("Scale Shot, 4 hits", "SCALESHOT", DRAGON_PAIR, draw=15),
    effect_case("Water Shuriken, 2 hits", "WATERSHURIKEN", WATER_PAIR, draw=0),
    effect_case(
        "Water Shuriken, Ash-Greninja",
        "WATERSHURIKEN",
        (("WATER", "DARK"), ("NORMAL",)),
        user_species="GRENINJA_2",
    ),
    effect_case("Population Bomb", "POPULATIONBOMB", NORMAL_PAIR),
    effect_case(
        "Population Bomb, Loaded Dice", "POPULATIONBOMB", NORMAL_PAIR, user_item="LOADEDDICE"
    ),
    effect_case("Beat Up", "BEATUP", (("DARK",), ("NORMAL",))),
    effect_case("Beat Up, burned user, fails", "BEATUP", (("DARK",), ("NORMAL",)), status="BURN"),
    effect_case("Dragon Darts", "DRAGONDARTS", DRAGON_PAIR),
    effect_case("Parental Bond Tackle", "TACKLE", NORMAL_PAIR, user_ability="PARENTALBOND"),
    effect_case(
        "Parental Bond Double Kick", "DOUBLEKICK", FIGHTING_PAIR, user_ability="PARENTALBOND"
    ),
    effect_case(
        "Parental Bond Tackle, two targets",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="PARENTALBOND",
        targets=2,
    ),
    effect_case(
        "Parental Bond Seismic Toss", "SEISMICTOSS", FIGHTING_PAIR, user_ability="PARENTALBOND"
    ),
    effect_case(
        "Parental Bond Super Fang",
        "SUPERFANG",
        NORMAL_PAIR,
        user_ability="PARENTALBOND",
        ranged=True,
    ),
    effect_case(
        "Parental Bond Solar Beam in sun",
        "SOLARBEAM",
        GRASS_PAIR,
        user_ability="PARENTALBOND",
        weather="Sun",
    ),
    effect_case(
        "Parental Bond Tackle into Multiscale",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="PARENTALBOND",
        target_ability="MULTISCALE",
    ),
    effect_case(
        "Parental Bond Tackle, Silk Scarf",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="PARENTALBOND",
        user_item="SILKSCARF",
    ),
    effect_case("Double-Edge", "DOUBLEEDGE", NORMAL_PAIR),
    effect_case("Double-Edge, Reckless", "DOUBLEEDGE", NORMAL_PAIR, user_ability="RECKLESS"),
    effect_case("Double-Edge, Rock Head", "DOUBLEEDGE", NORMAL_PAIR, user_ability="ROCKHEAD"),
    effect_case("Double-Edge, Magic Guard", "DOUBLEEDGE", NORMAL_PAIR, user_ability="MAGICGUARD"),
    effect_case("Double-Edge into a third", "DOUBLEEDGE", NORMAL_PAIR, target_hp_divisor=3),
    effect_case(
        "Parental Bond Double-Edge", "DOUBLEEDGE", NORMAL_PAIR, user_ability="PARENTALBOND"
    ),
    effect_case("Tackle, Reckless", "TACKLE", NORMAL_PAIR, user_ability="RECKLESS"),
    effect_case("Take Down", "TAKEDOWN", NORMAL_PAIR),
    effect_case("Brave Bird", "BRAVEBIRD", (("FLYING",), ("NORMAL",))),
    effect_case("Flare Blitz, Reckless", "FLAREBLITZ", FIRE_PAIR, user_ability="RECKLESS"),
    effect_case("Volt Tackle", "VOLTTACKLE", (("ELECTRIC",), ("NORMAL",)), user_ability="RECKLESS"),
    effect_case("Head Smash", "HEADSMASH", (("ROCK",), ("NORMAL",))),
    effect_case("Chloroblast, Reckless", "CHLOROBLAST", GRASS_PAIR, user_ability="RECKLESS"),
    effect_case("Chloroblast, Rock Head", "CHLOROBLAST", GRASS_PAIR, user_ability="ROCKHEAD"),
    effect_case("High Jump Kick", "HIGHJUMPKICK", FIGHTING_PAIR),
    effect_case("High Jump Kick, Reckless", "HIGHJUMPKICK", FIGHTING_PAIR, user_ability="RECKLESS"),
    effect_case(
        "High Jump Kick, Rock Head", "HIGHJUMPKICK", FIGHTING_PAIR, user_ability="ROCKHEAD"
    ),
    effect_case(
        "High Jump Kick, Magic Guard", "HIGHJUMPKICK", FIGHTING_PAIR, user_ability="MAGICGUARD"
    ),
    effect_case("Axe Kick, Reckless", "AXEKICK", FIGHTING_PAIR, user_ability="RECKLESS"),
    effect_case(
        "Supercell Slam, Reckless",
        "SUPERCELLSLAM",
        (("ELECTRIC",), ("NORMAL",)),
        user_ability="RECKLESS",
    ),
)
DARK_PAIR = (("DARK",), ("NORMAL",))
STEEL_PAIR = (("STEEL",), ("NORMAL",))
GHOST_PAIR = (("GHOST",), ("PSYCHIC",))
POISON_PAIR = (("POISON",), ("NORMAL",))
RAISED_ATTACK = (("ATTACK", 2),)
CALC_STAT_CASES = (
    effect_case("Foul Play, +2 foe Attack", "FOULPLAY", DARK_PAIR, target_stages=RAISED_ATTACK),
    effect_case(
        "Foul Play, -2 foe Attack, -2 own",
        "FOULPLAY",
        DARK_PAIR,
        attack_stage=-2,
        target_stages=(("ATTACK", -2),),
    ),
    effect_case(
        "Foul Play, Huge Power",
        "FOULPLAY",
        DARK_PAIR,
        user_ability="HUGEPOWER",
        target_stages=RAISED_ATTACK,
    ),
    effect_case(
        "Foul Play into Unaware",
        "FOULPLAY",
        DARK_PAIR,
        target_ability="UNAWARE",
        target_stages=RAISED_ATTACK,
    ),
    effect_case(
        "Body Press, +2 Defense, -2 Attack",
        "BODYPRESS",
        FIGHTING_PAIR,
        attack_stage=-2,
        user_stages=(("DEFENSE", 2),),
    ),
    effect_case(
        "Body Press, -1 Defense", "BODYPRESS", FIGHTING_PAIR, user_stages=(("DEFENSE", -1),)
    ),
    effect_case(
        "Psyshock, +1 foe Defense, +2 Sp. Def",
        "PSYSHOCK",
        PSYCHIC_PAIR,
        defense_stage=2,
        target_stages=(("DEFENSE", 1),),
    ),
    effect_case(
        "Psyshock in sandstorm into Rock",
        "PSYSHOCK",
        (("PSYCHIC",), ("ROCK",)),
        weather="Sandstorm",
    ),
    effect_case("Psyshock in snow into Ice", "PSYSHOCK", (("PSYCHIC",), ("ICE",)), weather="Hail"),
    effect_case(
        "Psyshock into an Assault Vest", "PSYSHOCK", PSYCHIC_PAIR, target_item="ASSAULTVEST"
    ),
    effect_case("Psystrike", "PSYSTRIKE", PSYCHIC_PAIR),
    effect_case("Secret Sword", "SECRETSWORD", FIGHTING_PAIR),
    effect_case("Chip Away into +2 Defense", "CHIPAWAY", NORMAL_PAIR, defense_stage=2),
    effect_case("Sacred Sword into -2 Defense", "SACREDSWORD", FIGHTING_PAIR, defense_stage=-2),
    effect_case("Darkest Lariat into +6 Defense", "DARKESTLARIAT", DARK_PAIR, defense_stage=6),
    effect_case(
        "Nihil Light into Fairy, -2 Sp. Def",
        "NIHILLIGHT",
        (("DRAGON",), ("FAIRY",)),
        defense_stage=-2,
    ),
    effect_case(
        "Nihil Light into Fairy and Dragon", "NIHILLIGHT", (("DRAGON",), ("FAIRY", "DRAGON"))
    ),
    effect_case(
        "Sunsteel Strike into Multiscale",
        "SUNSTEELSTRIKE",
        STEEL_PAIR,
        target_ability="MULTISCALE",
    ),
    effect_case(
        "Sunsteel Strike into Multiscale, Ability Shield",
        "SUNSTEELSTRIKE",
        STEEL_PAIR,
        target_ability="MULTISCALE",
        target_item="ABILITYSHIELD",
    ),
    effect_case(
        "Moongeist Beam into Ice Scales", "MOONGEISTBEAM", GHOST_PAIR, target_ability="ICESCALES"
    ),
    effect_case(
        "Photon Geyser into Ice Scales", "PHOTONGEYSER", PSYCHIC_PAIR, target_ability="ICESCALES"
    ),
    effect_case(
        "Photon Geyser, +6 Attack, -6 Sp. Atk",
        "PHOTONGEYSER",
        PSYCHIC_PAIR,
        user_stages=(("ATTACK", 6), ("SPECIAL_ATTACK", -6)),
    ),
    effect_case("Shell Side Arm", "SHELLSIDEARM", POISON_PAIR),
    effect_case(
        "Shell Side Arm, physical, Tough Claws",
        "SHELLSIDEARM",
        POISON_PAIR,
        user_ability="TOUGHCLAWS",
        user_stages=(("ATTACK", 6), ("SPECIAL_ATTACK", -6)),
    ),
    effect_case(
        "Tera Starstorm, Pixilate",
        "TERASTARSTORM",
        (("FAIRY",), ("NORMAL",)),
        user_ability="PIXILATE",
    ),
    effect_case(
        "Tera Starstorm from Terapagos form 2",
        "TERASTARSTORM",
        NORMAL_PAIR,
        user_species="TERAPAGOS_2",
    ),
    effect_case("Storm Throw", "STORMTHROW", FIGHTING_PAIR, own_crit=True),
    effect_case("Frost Breath", "FROSTBREATH", (("ICE",), ("NORMAL",)), own_crit=True),
    effect_case(
        "Storm Throw into Battle Armor",
        "STORMTHROW",
        FIGHTING_PAIR,
        target_ability="BATTLEARMOR",
        own_crit=True,
    ),
    effect_case("Brick Break into Reflect", "BRICKBREAK", FIGHTING_PAIR, reflect=True),
    effect_case("Psychic Fangs into Aurora Veil", "PSYCHICFANGS", PSYCHIC_PAIR, aurora_veil=True),
    effect_case("Knock Off into no item", "KNOCKOFF", DARK_PAIR),
    effect_case("Knock Off into Leftovers", "KNOCKOFF", DARK_PAIR, target_item="LEFTOVERS"),
    effect_case(
        "Knock Off into Leftovers, Klutz",
        "KNOCKOFF",
        DARK_PAIR,
        target_item="LEFTOVERS",
        target_ability="KLUTZ",
    ),
    effect_case(
        "Knock Off into Arceus's Flame Plate, Multitype",
        "KNOCKOFF",
        DARK_PAIR,
        target_species="ARCEUS",
        target_ability="MULTITYPE",
        target_item="FLAMEPLATE",
    ),
    effect_case(
        "Knock Off into Arceus's Flame Plate, no Multitype",
        "KNOCKOFF",
        DARK_PAIR,
        target_species="ARCEUS",
        target_item="FLAMEPLATE",
    ),
    effect_case(
        "Knock Off into Charizard's Charizardite X",
        "KNOCKOFF",
        DARK_PAIR,
        target_species="CHARIZARD",
        target_item="CHARIZARDITEX",
    ),
    effect_case(
        "Knock Off into another's Charizardite X",
        "KNOCKOFF",
        DARK_PAIR,
        target_item="CHARIZARDITEX",
    ),
    effect_case("Knock Off into Air Mail", "KNOCKOFF", DARK_PAIR, target_item="AIRMAIL"),
    effect_case(
        "Knock Off into Great Tusk's Booster Energy, Protosynthesis",
        "KNOCKOFF",
        DARK_PAIR,
        target_species="GREATTUSK",
        target_ability="PROTOSYNTHESIS",
        target_item="BOOSTERENERGY",
    ),
    effect_case(
        "Parental Bond Knock Off into Leftovers",
        "KNOCKOFF",
        DARK_PAIR,
        user_ability="PARENTALBOND",
        target_item="LEFTOVERS",
    ),
    effect_case("Fling, no item, fails", "FLING", DARK_PAIR),
    effect_case("Fling an Iron Ball", "FLING", DARK_PAIR, user_item="IRONBALL"),
    effect_case(
        "Fling Leftovers, Technician",
        "FLING",
        DARK_PAIR,
        user_item="LEFTOVERS",
        user_ability="TECHNICIAN",
    ),
    effect_case("Fling an Oran Berry", "FLING", DARK_PAIR, user_item="ORANBERRY"),
    effect_case(
        "Fling an Oran Berry into Unnerve, fails",
        "FLING",
        DARK_PAIR,
        user_item="ORANBERRY",
        target_ability="UNNERVE",
    ),
    effect_case(
        "Fling Leftovers, Klutz, fails",
        "FLING",
        DARK_PAIR,
        user_item="LEFTOVERS",
        user_ability="KLUTZ",
    ),
    effect_case("Fling a Black Apricorn, fails", "FLING", DARK_PAIR, user_item="BLACKAPRICORN"),
    effect_case("Fling Air Mail, fails", "FLING", DARK_PAIR, user_item="AIRMAIL"),
    effect_case(
        "Fling Arceus's Flame Plate, Multitype, fails",
        "FLING",
        DARK_PAIR,
        user_species="ARCEUS",
        user_ability="MULTITYPE",
        user_item="FLAMEPLATE",
    ),
    effect_case("False Swipe", "FALSESWIPE", NORMAL_PAIR),
    effect_case("False Swipe into an eighth", "FALSESWIPE", NORMAL_PAIR, target_hp_divisor=8),
    effect_case("Hold Back into an eighth", "HOLDBACK", NORMAL_PAIR, target_hp_divisor=8),
    effect_case("Explosion", "EXPLOSION", NORMAL_PAIR),
    effect_case("Explosion into Damp, fails", "EXPLOSION", NORMAL_PAIR, target_ability="DAMP"),
    effect_case(
        "Explosion, Mold Breaker, into Damp",
        "EXPLOSION",
        NORMAL_PAIR,
        user_ability="MOLDBREAKER",
        target_ability="DAMP",
    ),
    effect_case("Self-Destruct, Damp, fails", "SELFDESTRUCT", NORMAL_PAIR, user_ability="DAMP"),
    effect_case(
        "Spectral Thief into +2 Attack and Defense",
        "SPECTRALTHIEF",
        GHOST_PAIR,
        target_stages=(("ATTACK", 2), ("DEFENSE", 2)),
    ),
    effect_case(
        "Spectral Thief at +5 into +2, Simple",
        "SPECTRALTHIEF",
        GHOST_PAIR,
        attack_stage=5,
        user_ability="SIMPLE",
        target_stages=(("ATTACK", 2), ("DEFENSE", 2)),
    ),
    effect_case(
        "Spectral Thief into +2, Contrary",
        "SPECTRALTHIEF",
        GHOST_PAIR,
        user_ability="CONTRARY",
        target_stages=(("ATTACK", 2), ("DEFENSE", 2)),
    ),
    effect_case("Secret Power", "SECRETPOWER", NORMAL_PAIR),
    effect_case("Secret Power in Electric Terrain", "SECRETPOWER", NORMAL_PAIR, terrain="Electric"),
    effect_case("Pollen Puff into a foe", "POLLENPUFF", (("BUG",), ("NORMAL",))),
)
ELECTRIC_PAIR = (("ELECTRIC",), ("NORMAL",))
CALC_BATTLER_CASES = (
    effect_case("Helping Hand", "TACKLE", NORMAL_PAIR, user_effects=(("helping_hand", True),)),
    effect_case("Me First", "TACKLE", NORMAL_PAIR, user_effects=(("me_first", True),)),
    effect_case("Charge, Electric", "THUNDERSHOCK", ELECTRIC_PAIR, user_effects=(("charge", 2),)),
    effect_case("Charge, not Electric", "TACKLE", NORMAL_PAIR, user_effects=(("charge", 2),)),
    effect_case(
        "Helping Hand and Charge",
        "THUNDERSHOCK",
        ELECTRIC_PAIR,
        user_effects=(("helping_hand", True), ("charge", 2)),
    ),
    effect_case("Stomp into Minimize", "STOMP", NORMAL_PAIR, target_effects=(("minimize", True),)),
    effect_case(
        "Tackle into Minimize", "TACKLE", NORMAL_PAIR, target_effects=(("minimize", True),)
    ),
    effect_case("into Glaive Rush", "TACKLE", NORMAL_PAIR, target_effects=(("glaive_rush", 2),)),
    effect_case(
        "Hex into a burned substitute",
        "HEX",
        GHOST_INTO_PSYCHIC,
        target_status="BURN",
        target_effects=(("substitute", 20),),
    ),
    effect_case(
        "Hex into a burned substitute, Infiltrator",
        "HEX",
        GHOST_INTO_PSYCHIC,
        target_status="BURN",
        user_ability="INFILTRATOR",
        target_effects=(("substitute", 20),),
    ),
    effect_case(
        "Take Down into a 5 HP substitute",
        "TAKEDOWN",
        NORMAL_PAIR,
        target_effects=(("substitute", 5),),
    ),
    effect_case(
        "Earthquake into Dig",
        "EARTHQUAKE",
        GROUND_PAIR,
        target_effects=(("two_turn_attack", "DIG"),),
    ),
    effect_case(
        "Earthquake into Dig in Grassy Terrain",
        "EARTHQUAKE",
        GROUND_PAIR,
        terrain="Grassy",
        target_effects=(("two_turn_attack", "DIG"),),
    ),
    effect_case(
        "Earthquake into Dive",
        "EARTHQUAKE",
        GROUND_PAIR,
        target_effects=(("two_turn_attack", "DIVE"),),
    ),
    effect_case(
        "Magnitude 10 into Dig",
        "MAGNITUDE",
        GROUND_PAIR,
        draw=19,
        ranged=True,
        target_effects=(("two_turn_attack", "DIG"),),
    ),
    effect_case(
        "Surf into Dive", "SURF", WATER_PAIR, target_effects=(("two_turn_attack", "DIVE"),)
    ),
    effect_case(
        "Whirlpool into Dive",
        "WHIRLPOOL",
        WATER_PAIR,
        target_effects=(("two_turn_attack", "DIVE"),),
    ),
    effect_case(
        "Gust into Fly",
        "GUST",
        (("FLYING",), ("NORMAL",)),
        target_effects=(("two_turn_attack", "FLY"),),
    ),
    effect_case(
        "Twister into Bounce",
        "TWISTER",
        DRAGON_PAIR,
        target_effects=(("two_turn_attack", "BOUNCE"),),
    ),
    effect_case("Twister into Sky Drop", "TWISTER", DRAGON_PAIR, target_effects=(("sky_drop", 0),)),
    effect_case(
        "Earthquake into Gastro Acid Levitate",
        "EARTHQUAKE",
        GROUND_PAIR,
        target_ability="LEVITATE",
        target_effects=(("gastro_acid", True),),
    ),
    effect_case(
        "Huge Power under Gastro Acid",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="HUGEPOWER",
        user_effects=(("gastro_acid", True),),
    ),
    effect_case(
        "Huge Power into Neutralizing Gas under Gastro Acid",
        "TACKLE",
        NORMAL_PAIR,
        user_ability="HUGEPOWER",
        target_ability="NEUTRALIZINGGAS",
        target_effects=(("gastro_acid", True),),
    ),
    effect_case(
        "Charcoal under Embargo",
        "EMBER",
        FIRE_PAIR,
        user_item="CHARCOAL",
        user_effects=(("embargo", 5),),
    ),
    effect_case(
        "Earthquake into Magnet Rise",
        "EARTHQUAKE",
        GROUND_PAIR,
        target_effects=(("magnet_rise", 5),),
    ),
    effect_case(
        "Earthquake into Telekinesis",
        "EARTHQUAKE",
        GROUND_PAIR,
        target_effects=(("telekinesis", 3),),
    ),
    effect_case(
        "Earthquake into an Ingrained Flying type",
        "EARTHQUAKE",
        (("GROUND",), ("FLYING",)),
        target_effects=(("ingrain", True),),
    ),
    effect_case(
        "Earthquake into a Smacked Down Flying type",
        "EARTHQUAKE",
        (("GROUND",), ("FLYING",)),
        target_effects=(("smack_down", True),),
    ),
    effect_case(
        "Earthquake into a roosting Flying type",
        "EARTHQUAKE",
        (("GROUND",), ("FLYING",)),
        target_effects=(("roost", True),),
    ),
    effect_case(
        "Vine Whip into a roosting Grass and Flying type",
        "VINEWHIP",
        (("GRASS",), ("GRASS", "FLYING")),
        target_effects=(("roost", True),),
    ),
    effect_case("Ember after Burn Up", "EMBER", FIRE_PAIR, user_effects=(("burn_up", True),)),
    effect_case(
        "Thunder Shock after Double Shock",
        "THUNDERSHOCK",
        ELECTRIC_PAIR,
        user_effects=(("double_shock", True),),
    ),
    effect_case(
        "Ember into Forest's Curse", "EMBER", FIRE_PAIR, target_effects=(("extra_type", "GRASS"),)
    ),
    effect_case(
        "Low Kick into an Autotomized Onix",
        "LOWKICK",
        FIGHTING_PAIR,
        target_species="ONIX",
        target_effects=(("weight_change", -1000),),
    ),
    effect_case(
        "Tackle into a Ghost under Foresight",
        "TACKLE",
        (("NORMAL",), ("GHOST",)),
        target_effects=(("foresight", True),),
    ),
    effect_case(
        "Confusion into a Dark type under Miracle Eye",
        "CONFUSION",
        (("PSYCHIC",), ("DARK",)),
        target_effects=(("miracle_eye", True),),
    ),
    effect_case("Ember into Tar Shot", "EMBER", FIRE_PAIR, target_effects=(("tar_shot", True),)),
    effect_case(
        "Tackle under Electrify into Water",
        "TACKLE",
        (("NORMAL",), ("WATER",)),
        user_effects=(("electrify", True),),
    ),
    effect_case(
        "Tackle under Electrify into Ground",
        "TACKLE",
        (("NORMAL",), ("GROUND",)),
        user_effects=(("electrify", True),),
    ),
    effect_case(
        "Laser Focus", "TACKLE", NORMAL_PAIR, own_crit=True, user_effects=(("laser_focus", 1),)
    ),
    effect_case(
        "Laser Focus into Shell Armor",
        "TACKLE",
        NORMAL_PAIR,
        own_crit=True,
        target_ability="SHELLARMOR",
        user_effects=(("laser_focus", 1),),
    ),
)
CALC_EFFECT_IVARS = {"turn_count": "@turnCount"}
CALC_ACTED = {"moved": True, "item": True, "waiting": False, "switched_in": False}
CALC_OWN_HISTORY = {
    "last_move_failed": "last_round_move_failed",
    "ally_fainted": "ally_fainted_last_round",
    "echoed_voice": "echoed_voice",
    "echoed_voice_used": "echoed_voice_used",
    "times_hit": "times_hit",
    "fainted_allies": "fainted_allies",
}
DARK_INTO_NORMAL = (("DARK",), ("NORMAL",))


def history_case(
    name: str,
    move: str,
    history: tuple[tuple[str, Any], ...] = (),
    pair: tuple[tuple[str, ...], tuple[str, ...]] = NORMAL_PAIR,
    **values: Any,
) -> CalcCase:
    return CalcCase(name, move, pair[0], pair[1], history=history, **values)


CALC_HISTORY_CASES = (
    *(
        history_case(f"Payback, target {state}", "PAYBACK", (("target_acted", state),))
        for state in CALC_ACTED
    ),
    history_case("Payback, history unknown", "PAYBACK", ranged=True),
    *(
        history_case(f"Bolt Beak, target {state}", "BOLTBEAK", (("target_acted", state),))
        for state in CALC_ACTED
    ),
    history_case("Fishious Rend, history unknown", "FISHIOUSREND", ranged=True),
    history_case("Assurance, target damaged", "ASSURANCE", (("target_damaged", True),)),
    history_case("Assurance, target not damaged", "ASSURANCE", (("target_damaged", False),)),
    history_case("Assurance, history unknown", "ASSURANCE", ranged=True),
    history_case("Avalanche, hurt by the target", "AVALANCHE", (("hurt_by_target", True),)),
    history_case("Revenge, not hurt by the target", "REVENGE", (("hurt_by_target", False),)),
    history_case("Retaliate, ally fainted last round", "RETALIATE", (("ally_fainted", True),)),
    history_case("Retaliate, ally fainted this round", "RETALIATE", (("ally_fainted", False),)),
    history_case(
        "Stomping Tantrum, last move failed", "STOMPINGTANTRUM", (("last_move_failed", True),)
    ),
    history_case(
        "Temper Flare, last move succeeded", "TEMPERFLARE", (("last_move_failed", False),)
    ),
    history_case("Lash Out, stats lowered", "LASHOUT", (("stats_lowered", True),)),
    history_case("Lash Out, stats not lowered", "LASHOUT", (("stats_lowered", False),)),
    history_case("Fusion Bolt after Fusion Flare", "FUSIONBOLT", (("fusion_flare", True),)),
    history_case(
        "Fusion Bolt after Fusion Bolt",
        "FUSIONBOLT",
        (("fusion_bolt", True), ("fusion_flare", False)),
    ),
    history_case("Fusion Flare after Fusion Bolt", "FUSIONFLARE", (("fusion_bolt", True),)),
    history_case("Fusion Flare, history unknown", "FUSIONFLARE", ranged=True),
    history_case("Round after an ally's Round", "ROUND", (("round_used", True),)),
    history_case("Round, alone on its side", "ROUND"),
    history_case("Pursuit into a switching target", "PURSUIT", (("switching", True),)),
    history_case("Pursuit, no switch", "PURSUIT", (("switching", False),)),
    history_case("Fire Pledge, alone on its side", "FIREPLEDGE"),
    history_case("Fire Pledge after Water Pledge", "FIREPLEDGE", (("pledge", "WaterPledge"),)),
    history_case("Fire Pledge after Grass Pledge", "FIREPLEDGE", (("pledge", "GrassPledge"),)),
    history_case("Water Pledge after Grass Pledge", "WATERPLEDGE", (("pledge", "GrassPledge"),)),
    history_case("Grass Pledge after Fire Pledge", "GRASSPLEDGE", (("pledge", "FirePledge"),)),
    history_case("Counter, 30 HP taken", "COUNTER", (("counter", 30),)),
    history_case("Counter, 0 HP taken", "COUNTER", (("counter", 0),)),
    history_case("Counter, not hit", "COUNTER", (("counter", None),)),
    history_case("Counter into a Ghost", "COUNTER", (("counter", 30),), (("NORMAL",), ("GHOST",))),
    history_case("Mirror Coat, 25 HP taken", "MIRRORCOAT", (("mirror_coat", 25),)),
    history_case("Mirror Coat, not hit", "MIRRORCOAT", (("mirror_coat", None),)),
    history_case("Metal Burst, 25 HP lost", "METALBURST", (("foe_hp_lost", 25),)),
    history_case("Metal Burst, not hit", "METALBURST", (("foe_hp_lost", None),)),
    history_case("Comeuppance, 0 HP lost", "COMEUPPANCE", (("foe_hp_lost", 0),), DARK_INTO_NORMAL),
    history_case("Bide, 20 HP stored", "BIDE", (("bide", 20),)),
    history_case("Bide, nothing stored", "BIDE", (("bide", 0),)),
)
GHOST_INTO_FIRE = (("NORMAL",), ("FIRE",))


def usage_case(
    name: str,
    move: str,
    user_effects: tuple[tuple[str, Any], ...] = (),
    history: tuple[tuple[str, Any], ...] = (),
    pair: tuple[tuple[str, ...], tuple[str, ...]] = NORMAL_PAIR,
    **values: Any,
) -> CalcCase:
    return CalcCase(
        name, move, pair[0], pair[1], user_effects=user_effects, history=history, **values
    )


def unknown_case(
    name: str,
    move: str,
    user_effects: tuple[tuple[str, Any], ...] = (),
    history: tuple[tuple[str, Any], ...] = (),
    pair: tuple[tuple[str, ...], tuple[str, ...]] = NORMAL_PAIR,
) -> CalcCase:
    return usage_case(name, move, user_effects, history, pair, user_hidden=True, ranged=True)


CALC_USAGE_CASES = (
    *(
        usage_case(f"Fury Cutter, counter {count}", "FURYCUTTER", (("fury_cutter", count),))
        for count in (0, 1, 2, 3)
    ),
    unknown_case("Fury Cutter, counter unknown", "FURYCUTTER", (("fury_cutter", 1),)),
    *(
        usage_case(f"Echoed Voice, counter {count}", "ECHOEDVOICE", (), (("echoed_voice", count),))
        for count in (0, 2, 5)
    ),
    usage_case(
        "Echoed Voice, counter 2 after an ally's this round",
        "ECHOEDVOICE",
        (),
        (("echoed_voice", 2), ("echoed_voice_used", True)),
    ),
    unknown_case("Echoed Voice, counter unknown", "ECHOEDVOICE", (), (("echoed_voice", 3),)),
    *(
        usage_case(f"Rollout, {left} turns left", "ROLLOUT", (("rollout", left),))
        for left in (0, 4, 1)
    ),
    usage_case("Rollout after Defense Curl", "ROLLOUT", (("defense_curl", True),)),
    usage_case(
        "Ice Ball, 3 turns left after Defense Curl",
        "ICEBALL",
        (("rollout", 3), ("defense_curl", True)),
    ),
    unknown_case("Rollout, turns unknown", "ROLLOUT", (("rollout", 2),)),
    *(
        usage_case(f"Spit Up, stockpile {count}", "SPITUP", (("stockpile", count),))
        for count in (1, 3, 0)
    ),
    unknown_case("Spit Up, stockpile unknown", "SPITUP", (("stockpile", 2),)),
    *(usage_case(f"Trump Card, {pp} PP", "TRUMPCARD", pp=pp) for pp in (5, 3, 2, 1)),
    usage_case("Trump Card, 3 PP into Pressure", "TRUMPCARD", pp=3, target_ability="PRESSURE"),
    usage_case("Trump Card, 1 PP into Pressure", "TRUMPCARD", pp=1, target_ability="PRESSURE"),
    unknown_case("Trump Card, PP unknown", "TRUMPCARD"),
    *(
        usage_case(
            f"Rage Fist, hit {count} times",
            "RAGEFIST",
            (),
            (("times_hit", count), ("hurt_by_target", False)),
            GHOST_INTO_FIRE,
        )
        for count in (0, 2, 7)
    ),
    unknown_case("Rage Fist, hits unknown", "RAGEFIST", (), (("times_hit", 4),), GHOST_INTO_FIRE),
    usage_case(
        "Rage Fist, hit 2 times, this round's hits unknown",
        "RAGEFIST",
        (),
        (("times_hit", 2),),
        GHOST_INTO_FIRE,
        ranged=True,
    ),
    *(
        usage_case(
            f"Last Respects, {count} fainted",
            "LASTRESPECTS",
            (),
            (("fainted_allies", count),),
            GHOST_INTO_FIRE,
        )
        for count in (0, 3)
    ),
    unknown_case(
        "Last Respects, fainted unknown",
        "LASTRESPECTS",
        (),
        (("fainted_allies", 2),),
        GHOST_INTO_FIRE,
    ),
)


def speed_case(name: str, move: str, **values: Any) -> CalcCase:
    return CalcCase(name, move, ("NORMAL",), ("NORMAL",), **values)


CALC_SPEED_CASES = (
    speed_case("Gyro Ball, plain", "GYROBALL"),
    speed_case("Gyro Ball, user at -6 Speed", "GYROBALL", user_stages=(("SPEED", -6),)),
    speed_case("Gyro Ball, target at +6 Speed", "GYROBALL", target_stages=(("SPEED", 6),)),
    speed_case("Gyro Ball, user paralysed", "GYROBALL", status="PARALYSIS"),
    speed_case("Gyro Ball, user with an Iron Ball", "GYROBALL", user_item="IRONBALL"),
    speed_case("Gyro Ball, user with a Macho Brace", "GYROBALL", user_item="MACHOBRACE"),
    speed_case("Gyro Ball, target with a Choice Scarf", "GYROBALL", target_item="CHOICESCARF"),
    speed_case("Gyro Ball, target's Tailwind", "GYROBALL", target_side=("Tailwind",)),
    speed_case("Gyro Ball, user in a swamp", "GYROBALL", user_side=("Swamp",)),
    speed_case(
        "Gyro Ball, target's Swift Swim in rain",
        "GYROBALL",
        target_ability="SWIFTSWIM",
        weather="Rain",
    ),
    speed_case(
        "Gyro Ball, target's Chlorophyll in sun under an umbrella",
        "GYROBALL",
        target_ability="CHLOROPHYLL",
        target_item="UTILITYUMBRELLA",
        weather="Sun",
    ),
    speed_case(
        "Gyro Ball, target's Sand Rush in a sandstorm",
        "GYROBALL",
        target_ability="SANDRUSH",
        weather="Sandstorm",
    ),
    speed_case(
        "Gyro Ball, target's Slush Rush in hail",
        "GYROBALL",
        target_ability="SLUSHRUSH",
        weather="Hail",
    ),
    speed_case(
        "Gyro Ball, target's Surge Surfer on Electric Terrain",
        "GYROBALL",
        target_ability="SURGESURFER",
        terrain="Electric",
    ),
    speed_case(
        "Gyro Ball, target's Quick Feet while paralysed",
        "GYROBALL",
        target_ability="QUICKFEET",
        target_status="PARALYSIS",
    ),
    speed_case(
        "Gyro Ball, target's Unburden after losing its item",
        "GYROBALL",
        target_ability="UNBURDEN",
        target_effects=(("unburden", True),),
    ),
    speed_case(
        "Gyro Ball, target's Slow Start",
        "GYROBALL",
        target_ability="SLOWSTART",
        target_effects=(("slow_start", 3),),
    ),
    speed_case(
        "Gyro Ball, target's Protosynthesis on Speed",
        "GYROBALL",
        target_ability="PROTOSYNTHESIS",
        target_effects=(("paradox_stat", "SPEED"),),
    ),
    speed_case(
        "Gyro Ball, target's Acometida on its first turn",
        "GYROBALL",
        target_ability="ACOMETIDA",
        target_effects=(("turn_count", 0),),
    ),
    speed_case(
        "Gyro Ball, target's Acometida after its first turn",
        "GYROBALL",
        target_ability="ACOMETIDA",
        target_effects=(("turn_count", 2),),
    ),
    speed_case("Electro Ball, plain", "ELECTROBALL"),
    speed_case(
        "Electro Ball, user at +6 and target at -6 Speed",
        "ELECTROBALL",
        user_stages=(("SPEED", 6),),
        target_stages=(("SPEED", -6),),
    ),
    speed_case("Electro Ball, user at +2 Speed", "ELECTROBALL", user_stages=(("SPEED", 2),)),
    speed_case("Electro Ball, user at +4 Speed", "ELECTROBALL", user_stages=(("SPEED", 4),)),
    speed_case("Electro Ball, target paralysed", "ELECTROBALL", target_status="PARALYSIS"),
    speed_case("Electro Ball, user with a Choice Scarf", "ELECTROBALL", user_item="CHOICESCARF"),
    speed_case("Electro Ball, user's Tailwind", "ELECTROBALL", user_side=("Tailwind",)),
    speed_case(
        "Electro Ball, Ditto with Quick Powder",
        "ELECTROBALL",
        user_species="DITTO",
        user_item="QUICKPOWDER",
    ),
    speed_case(
        "Electro Ball, user's Swift Swim in rain beside Cloud Nine",
        "ELECTROBALL",
        user_ability="SWIFTSWIM",
        target_ability="CLOUDNINE",
        weather="Rain",
    ),
)


def odds_case(name: str, move: str, **values: Any) -> CalcCase:
    types = values.pop("types", (("NORMAL",), ("NORMAL",)))
    return CalcCase(name, move, types[0], types[1], odds=True, **values)


SLOWER = (("SPEED", -6),)
FASTER = (("SPEED", 6),)
CALC_ODDS_CASES = (
    odds_case("accuracy, Tackle", "TACKLE"),
    odds_case("accuracy, Hydro Pump", "HYDROPUMP"),
    odds_case("accuracy, Hydro Pump into +1 evasion", "HYDROPUMP", target_stages=(("EVASION", 1),)),
    odds_case("accuracy, Zap Cannon at -2 accuracy", "ZAPCANNON", user_stages=(("ACCURACY", -2),)),
    odds_case("accuracy, Zap Cannon, Compound Eyes", "ZAPCANNON", user_ability="COMPOUNDEYES"),
    odds_case("accuracy, Zap Cannon, Hustle", "ZAPCANNON", user_ability="HUSTLE"),
    odds_case(
        "accuracy, Zap Cannon, Keen Eye into +2 evasion",
        "ZAPCANNON",
        user_ability="KEENEYE",
        target_stages=(("EVASION", 2),),
    ),
    odds_case(
        "accuracy, Zap Cannon, Unaware into +2 evasion",
        "ZAPCANNON",
        user_ability="UNAWARE",
        target_stages=(("EVASION", 2),),
    ),
    odds_case(
        "accuracy, Zap Cannon at +2 into Unaware",
        "ZAPCANNON",
        user_stages=(("ACCURACY", 2),),
        target_ability="UNAWARE",
    ),
    odds_case(
        "accuracy, Zap Cannon into Sand Veil in a sandstorm",
        "ZAPCANNON",
        target_ability="SANDVEIL",
        weather="Sandstorm",
    ),
    odds_case(
        "accuracy, Zap Cannon into Snow Cloak in snow",
        "ZAPCANNON",
        target_ability="SNOWCLOAK",
        weather="Hail",
    ),
    odds_case(
        "accuracy, Zap Cannon into a confused Tangled Feet",
        "ZAPCANNON",
        target_ability="TANGLEDFEET",
        target_effects=(("confusion", 3),),
    ),
    odds_case("accuracy, Zap Cannon, Victory Star", "ZAPCANNON", user_ability="VICTORYSTAR"),
    odds_case("accuracy, Zap Cannon, Wide Lens", "ZAPCANNON", user_item="WIDELENS"),
    odds_case(
        "accuracy, Zap Cannon, Zoom Lens after the target moved",
        "ZAPCANNON",
        user_item="ZOOMLENS",
        history=(("target_acted", "moved"),),
    ),
    odds_case(
        "accuracy, Zap Cannon, Zoom Lens before the target moves",
        "ZAPCANNON",
        user_item="ZOOMLENS",
        history=(("target_acted", "waiting"),),
    ),
    odds_case("accuracy, Zap Cannon into Bright Powder", "ZAPCANNON", target_item="BRIGHTPOWDER"),
    odds_case("accuracy, Zap Cannon into Lax Incense", "ZAPCANNON", target_item="LAXINCENSE"),
    odds_case("accuracy, Zap Cannon under Gravity", "ZAPCANNON", field=("Gravity",)),
    odds_case(
        "accuracy, Zap Cannon into Lightning Rod", "ZAPCANNON", target_ability="LIGHTNINGROD"
    ),
    odds_case("accuracy, Zap Cannon, No Guard", "ZAPCANNON", user_ability="NOGUARD"),
    odds_case("accuracy, Zap Cannon into No Guard", "ZAPCANNON", target_ability="NOGUARD"),
    odds_case("accuracy, Thunder", "THUNDER"),
    odds_case("accuracy, Thunder in rain", "THUNDER", weather="Rain"),
    odds_case("accuracy, Thunder in sun", "THUNDER", weather="Sun"),
    odds_case(
        "accuracy, Thunder in rain into a Utility Umbrella",
        "THUNDER",
        weather="Rain",
        target_item="UTILITYUMBRELLA",
    ),
    odds_case("accuracy, Hurricane in sun", "HURRICANE", weather="Sun"),
    odds_case("accuracy, Blizzard in snow", "BLIZZARD", weather="Hail"),
    odds_case("accuracy, Fissure", "FISSURE"),
    odds_case("accuracy, Sheer Cold from a Normal type", "SHEERCOLD"),
    odds_case("accuracy, Sheer Cold from an Ice type", "SHEERCOLD", types=(("ICE",), ("NORMAL",))),
    odds_case("accuracy, Chip Away into +2 evasion", "CHIPAWAY", target_stages=(("EVASION", 2),)),
    odds_case(
        "accuracy, Tackle into Foresight at +2 evasion",
        "TACKLE",
        target_stages=(("EVASION", 2),),
        target_effects=(("foresight", True),),
    ),
    odds_case(
        "accuracy, Stomp into Minimize at +2 evasion",
        "STOMP",
        target_stages=(("EVASION", 2),),
        target_effects=(("minimize", True),),
    ),
    odds_case(
        "accuracy, Zap Cannon into Telekinesis",
        "ZAPCANNON",
        target_effects=(("telekinesis", 3),),
    ),
    odds_case(
        "accuracy, Zap Cannon into Glaive Rush",
        "ZAPCANNON",
        target_effects=(("glaive_rush", 2),),
    ),
    odds_case(
        "accuracy, Pursuit into +2 evasion, switching",
        "PURSUIT",
        target_stages=(("EVASION", 2),),
        history=(("switching", True),),
    ),
    odds_case(
        "accuracy, Toxic from a Poison type",
        "TOXIC",
        types=(("POISON",), ("NORMAL",)),
        target_stages=(("EVASION", 2),),
        odds_only=True,
    ),
    odds_case(
        "accuracy, Thunder Wave into Wonder Skin",
        "THUNDERWAVE",
        target_ability="WONDERSKIN",
        odds_only=True,
    ),
    odds_case("critical, Slash", "SLASH"),
    odds_case("critical, Slash, Super Luck", "SLASH", user_ability="SUPERLUCK"),
    odds_case(
        "critical, Slash, Super Luck and Scope Lens",
        "SLASH",
        user_ability="SUPERLUCK",
        user_item="SCOPELENS",
    ),
    odds_case("critical, Tackle into Battle Armor", "TACKLE", target_ability="BATTLEARMOR"),
    odds_case("critical, Tackle after Focus Energy", "TACKLE", user_effects=(("focus_energy", 2),)),
    odds_case(
        "critical, Tackle, Merciless into poison",
        "TACKLE",
        user_ability="MERCILESS",
        target_status="POISON",
    ),
    odds_case("critical, Tackle, Lucky Punch on a Chansey", "TACKLE", user_item="LUCKYPUNCH"),
    odds_case("critical, Tackle, Leek on a Chansey", "TACKLE", user_item="LEEK"),
    odds_case("critical, Storm Throw", "STORMTHROW", own_crit=True),
    odds_case("critical, Tackle into Lucky Chant", "TACKLE", target_side=("LuckyChant",)),
    odds_case("order, Tackle", "TACKLE"),
    odds_case("order, Tackle at +6", "TACKLE", user_stages=FASTER),
    odds_case("order, Tackle at -6", "TACKLE", user_stages=SLOWER),
    odds_case("order, Quick Attack at -6", "QUICKATTACK", user_stages=SLOWER),
    odds_case(
        "order, Tackle at +6 into Quick Attack",
        "TACKLE",
        user_stages=FASTER,
        foe_move="QUICKATTACK",
    ),
    odds_case("order, Tackle at +6, paralysed", "TACKLE", user_stages=FASTER, status="PARALYSIS"),
    odds_case(
        "order, Tackle at +6 in Trick Room", "TACKLE", user_stages=FASTER, field=("TrickRoom",)
    ),
    odds_case(
        "order, Tackle at -6 in Trick Room", "TACKLE", user_stages=SLOWER, field=("TrickRoom",)
    ),
    odds_case("order, Tackle into Tailwind", "TACKLE", target_side=("Tailwind",)),
    odds_case("order, Tackle with a Choice Scarf", "TACKLE", user_item="CHOICESCARF"),
    odds_case("order, Tackle at a speed tie", "TACKLE", same_speed=True),
    odds_case("order, Tackle at +6, Stall", "TACKLE", user_stages=FASTER, user_ability="STALL"),
    odds_case(
        "order, Tackle at +6, Lagging Tail", "TACKLE", user_stages=FASTER, user_item="LAGGINGTAIL"
    ),
    odds_case(
        "order, Tackle at -6, Quick Claw", "TACKLE", user_stages=SLOWER, user_item="QUICKCLAW"
    ),
    odds_case(
        "order, Tackle at -6, Quick Draw", "TACKLE", user_stages=SLOWER, user_ability="QUICKDRAW"
    ),
    odds_case(
        "order, Tackle at -6, Custap Berry at a quarter",
        "TACKLE",
        user_stages=SLOWER,
        user_item="CUSTAPBERRY",
        user_hp_divisor=4,
    ),
    odds_case(
        "order, Tackle at -6, Custap Berry at full",
        "TACKLE",
        user_stages=SLOWER,
        user_item="CUSTAPBERRY",
    ),
    odds_case(
        "order, Tackle at -6, Custap Berry at a half with Gluttony",
        "TACKLE",
        user_stages=SLOWER,
        user_item="CUSTAPBERRY",
        user_ability="GLUTTONY",
        user_hp_divisor=2,
    ),
    odds_case(
        "order, Tackle at -6, Custap Berry at a quarter into Unnerve",
        "TACKLE",
        user_stages=SLOWER,
        user_item="CUSTAPBERRY",
        user_hp_divisor=4,
        target_ability="UNNERVE",
    ),
    odds_case(
        "order, Wing Attack at -6, Gale Wings",
        "WINGATTACK",
        user_stages=SLOWER,
        user_ability="GALEWINGS",
    ),
    odds_case(
        "order, Wing Attack at -6, Gale Wings at a half",
        "WINGATTACK",
        user_stages=SLOWER,
        user_ability="GALEWINGS",
        user_hp_divisor=2,
    ),
    odds_case(
        "order, Drain Punch at -6, Triage", "DRAINPUNCH", user_stages=SLOWER, user_ability="TRIAGE"
    ),
    odds_case(
        "order, Grassy Glide at -6 in Grassy Terrain",
        "GRASSYGLIDE",
        user_stages=SLOWER,
        terrain="Grassy",
    ),
    odds_case(
        "order, Grassy Glide at -6 in Grassy Terrain from a Flying type",
        "GRASSYGLIDE",
        types=(("FLYING",), ("NORMAL",)),
        user_stages=SLOWER,
        terrain="Grassy",
    ),
    odds_case(
        "order, Thunder Wave at -6, Prankster",
        "THUNDERWAVE",
        user_stages=SLOWER,
        user_ability="PRANKSTER",
        odds_only=True,
    ),
    odds_case(
        "order, Thunder Wave at +6, Mycelium Might",
        "THUNDERWAVE",
        user_stages=FASTER,
        user_ability="MYCELIUMMIGHT",
        odds_only=True,
    ),
)
CALC_ALL_CASES = (
    CALC_CASES
    + CALC_EFFECT_CASES
    + CALC_MOVE_CASES
    + CALC_TYPE_CASES
    + CALC_HIT_CASES
    + CALC_STAT_CASES
    + CALC_BATTLER_CASES
    + CALC_HISTORY_CASES
    + CALC_USAGE_CASES
    + CALC_SPEED_CASES
    + CALC_ODDS_CASES
)


def calc_case_source(connection: sqlite3.Connection) -> str:
    cases = []
    for case in CALC_ALL_CASES:
        attack, defense = calc.attack_stats(gamedb.move(connection, case.move))
        values = {key: "" if value is None else value for key, value in case.__dict__.items()}
        cases.append(
            values
            | {"attack_stat": attack, "defense_stat": defense}
            | {"user_types": list(case.user_types), "target_types": list(case.target_types)}
            | {"field": list(case.field)}
            | {
                "user_effects": calc_case_effects(case.user_effects),
                "target_effects": calc_case_effects(case.target_effects),
                "history": [
                    ["" if each is None else each for each in pair] for pair in case.history
                ],
            }
        )
    return json.dumps(cases)


def calc_case_effects(effects: tuple[tuple[str, Any], ...]) -> list[list[Any]]:
    return [[BATTLER_EFFECTS.get(key) or CALC_EFFECT_IVARS[key], value] for key, value in effects]


def calc_effects(effects: tuple[tuple[str, Any], ...]) -> BattlerEffects:
    return BattlerEffects.model_validate(dict(effects))


def calc_history(history: tuple[tuple[str, Any], ...]) -> calc.History:
    values = {key: value for key, value in history if key not in CALC_OWN_HISTORY}
    if "target_acted" in values:
        values["target_acted"] = CALC_ACTED[values["target_acted"]]
    return calc.History(**values)


def calc_own_history(history: tuple[tuple[str, Any], ...]) -> tuple[tuple[str, Any], ...]:
    return tuple(
        (CALC_OWN_HISTORY[key], value) for key, value in history if key in CALC_OWN_HISTORY
    )


def calc_eval(live: Live, body: str, **values: Any) -> Any:
    return eval_data(live, CALC_PRELUDE.replace("__BODY__", ruby(body, **values)))


def calc_stats(numbers: dict[str, int]) -> dict[str, calc.Span]:
    return {stat: calc.Span.exact(numbers[stat]) for stat in calc.STAT_FIELDS}


def calc_side(
    connection: sqlite3.Connection,
    numbers: dict[str, Any],
    types: tuple[str, ...],
    stages: dict[str, int] | None = None,
    status: str = calc.NO_STATUS,
    *,
    ability: str | None = None,
    item: str | None = None,
    hp_divisor: int = 1,
    species: str | None = None,
    happiness: int | None = None,
    ivs: dict[str, int] | None = None,
    team: tuple[int, ...] | None = None,
    effects: BattlerEffects | None = None,
    hidden_effects: bool = False,
    pp: dict[str, int] | None = None,
) -> calc.Combatant:
    name, form = numbers["species"], numbers["form"]
    if species:
        name, _, suffix = species.partition("_")
        form = int(suffix or 0)
    found = gamedb.species(connection, calc.species_id(name, form))
    effects = effects or BattlerEffects()
    return calc.Combatant(
        level=numbers["level"],
        types=calc.active_types(types, effects),
        stats=calc_stats(numbers),
        hp=calc.Span.exact(numbers["HP"] // hp_divisor),
        stages=stages or {},
        status=status,
        species=name,
        evolutions=calc.evolution_count(found),
        ability=ability,
        item=item,
        weight=calc.effective_weight(found.weight, effects),
        happiness=calc.Span(0, calc.HAPPINESS_MAX)
        if happiness is None
        else calc.Span.exact(happiness),
        form=form,
        ivs=ivs,
        pokemon_types=found.types,
        team=team,
        effects=None if hidden_effects else effects,
        pp=pp,
    )


def calc_stat_formula(
    result: CheckResult, label: str, numbers: dict[str, int], inputs: Any
) -> None:
    level = numbers["level"]
    computed = {}
    for stat, (base, iv, ev, nature) in inputs.items():
        computed[stat] = (
            calc.hp_stat(base, level, iv, ev)
            if stat == calc.HP
            else calc.other_stat(base, level, iv, ev, nature)
        )
    result.expect(
        f"{label} stats from the formula", computed, {s: numbers[s] for s in calc.STAT_FIELDS}
    )


def calc_hit_counts(
    result: CheckResult, label: str, found: calc.Damage, game: list[list[int]]
) -> list[int]:
    counts = sorted({len(each) for each in game})
    result.mark(
        all(found.hits.low <= count <= found.hits.high for count in counts),
        f"{label}, game hits {counts} inside {found.hits.low}-{found.hits.high}",
    )
    return counts


def calc_hit_label(label: str, kind: str, counts: list[int], index: int) -> str:
    if counts == [1]:
        return f"{label}, {kind}"
    return f"{label}, {kind}, hit {index + 1}"


def calc_kinds(
    found: calc.Damage, game: dict[str, Any]
) -> tuple[tuple[str, tuple[tuple[calc.Span, ...], ...], list[list[int]]], ...]:
    return (
        ("plain", found.hit_rolls, game["plain"]),
        ("crit", found.hit_crit_rolls, game["crit"]),
    )


def calc_compare(
    result: CheckResult, label: str, found: calc.Damage, game: dict[str, Any], *, ranged: bool
) -> None:
    type_mod, immune, fails = game["immune"]
    result.expect(f"{label}, type effectiveness", found.effectiveness, type_mod)
    result.expect(f"{label}, immune", found.immune is not None, bool(immune))
    result.expect(f"{label}, fails", found.fails, bool(fails))
    if immune or fails or type_mod == 0:
        return
    calc_after(result, label, found, game["after"])
    if ranged:
        calc_contains(result, label, found, game)
        return
    for kind, ours_hits, theirs in calc_kinds(found, game):
        counts = calc_hit_counts(result, f"{label}, {kind}", found, theirs)
        for index in range(min(max(counts), len(ours_hits))):
            spans = ours_hits[index]
            exact = all(span.low == span.high for span in spans)
            rolls = [
                (span.low if exact else [span.low, span.high], each[index])
                for span, each in zip(spans, theirs, strict=True)
                if len(each) > index
            ]
            result.expect(
                f"{calc_hit_label(label, kind, counts, index)}, rolls 85-100",
                [ours for ours, _ in rolls],
                [game_value for _, game_value in rolls],
            )


def calc_after(result: CheckResult, label: str, found: calc.Damage, after: list[Any]) -> None:
    recoil, crash, kept = after
    if kept is not None:
        result.expect(
            f"{label}, HP lost over the rolls",
            [found.damage.low, found.damage.high],
            [min(kept), max(kept)],
        )
    if recoil is None:
        result.expect(f"{label}, no recoil", found.recoil, None)
    else:
        ours = None if found.recoil is None else [found.recoil.low, found.recoil.high]
        result.expect(f"{label}, recoil HP over the rolls", ours, [min(recoil), max(recoil)])
    if crash is None:
        result.expect(f"{label}, no crash", found.crash, None)
    else:
        ours = None if found.crash is None else [found.crash.low, found.crash.high]
        result.expect(f"{label}, crash HP", ours, [crash, crash])


def calc_contains(
    result: CheckResult, label: str, found: calc.Damage, game: dict[str, Any]
) -> None:
    _, immune, fails = game["immune"]
    if immune or fails:
        result.expect(
            f"{label}, immune and fails",
            [found.immune is not None, found.fails],
            [bool(immune), bool(fails)],
        )
        return
    for kind, ours_hits, theirs in calc_kinds(found, game):
        counts = calc_hit_counts(result, f"{label}, {kind}", found, theirs)
        for index in range(min(max(counts), len(ours_hits))):
            spans = ours_hits[index]
            values = [each[index] if len(each) > index else None for each in theirs]
            outside = [
                f"roll {roll}: {actual} outside {span.low}-{span.high}"
                for roll, span, actual in zip(calc.ROLLS, spans, values, strict=True)
                if actual is not None and not span.low <= actual <= span.high
            ]
            landed = [value for value in values if value is not None]
            result.mark(
                not outside,
                f"{calc_hit_label(label, kind, counts, index)}: game {landed[0]}-{landed[-1]} "
                f"inside {spans[0].low}-{spans[-1].high}" + (f"; {outside}" if outside else ""),
            )


def check_calc(live: Live, result: CheckResult) -> None:
    data = eval_data(live, CALC_DATA)
    for name in CALC_BADGE_SETTINGS:
        result.expect(f"Settings::{name}", data["badges"].get(name), CALC_BADGE_THRESHOLD)
    for name, place in data["methods"].items():
        result.note(f"Battle::Move#{name} defined at {place}")
    result.expect("switch 149 (Sin Grindeo)", data["no_grinding"], False)
    calc_functions(result, eval_data(live, CALC_FUNCTIONS))
    calc_hit_classes(result, eval_data(live, CALC_HIT_CLASSES))
    with closing(gamedb.open_gamedb(BUILDS[live.launch.build], live.settings)) as connection:
        calc_unlosable(result, connection, eval_data(live, calc_unlosable_source()))
    in_battle_snapshot(live, result, calc_battle)


def calc_functions(result: CheckResult, overrides: dict[str, list[str]]) -> None:
    neutral = {code for code, methods in overrides.items() if not methods}
    changing = set(overrides) - neutral
    result.expect(
        "damage-neutral function codes: no damage method overridden",
        sorted(calc.DAMAGE_NEUTRAL_FUNCTIONS ^ neutral),
        [],
    )
    result.expect(
        "modelled function codes are damaging codes of the build that change damage",
        sorted(calc.MODELLED_FUNCTIONS - changing),
        [],
    )
    named = sorted(changing - calc.MODELLED_FUNCTIONS)
    result.expect("damage-changing function codes of the build named as not modelled", named, [])
    unimplemented = sorted(
        code for code, methods in overrides.items() if methods == [CALC_UNIMPLEMENTED]
    )
    result.note(
        f"{len(overrides)} damaging function codes: {len(neutral)} neutral, "
        f"{len(calc.MODELLED_FUNCTIONS)} modelled, {len(named)} named; "
        f"no class (damage only): {unimplemented}"
    )


def calc_unlosable_source() -> str:
    table = {species: list(items) for species, items in calc.UNLOSABLE_ITEMS.items()}
    return ruby(
        CALC_UNLOSABLE,
        __TABLE__=json.dumps(table).replace(": ", " => "),
        __ABILITIES__=json.dumps(calc.UNLOSABLE_ABILITIES).replace(": ", " => "),
        __OTHER__=CALC_OTHER_ABILITY,
        __PARADOX_SPECIES__=CALC_PARADOX[0],
        __PARADOX__=CALC_PARADOX[1],
        __BOOSTER__=CALC_BOOSTER,
    )


def calc_unlosable(
    result: CheckResult, connection: sqlite3.Connection, found: dict[str, Any]
) -> None:
    for species, items in calc.UNLOSABLE_ITEMS.items():
        result.expect(
            f"items unlosable for {species} with its ability, over every item",
            sorted(found["table"][species]),
            sorted(items),
        )
        result.expect(
            f"items unlosable for {species} with {CALC_OTHER_ABILITY}",
            sorted(found["other_ability"][species]),
            [] if species in calc.UNLOSABLE_ABILITIES else sorted(items),
        )
    result.expect(
        "species and table items unlosable over every base species, abilities as battle objects",
        sorted(found["sweep"]),
        sorted(
            [species, item] for species, items in calc.UNLOSABLE_ITEMS.items() for item in items
        ),
    )
    result.note(
        f"{CALC_BOOSTER} on {CALC_PARADOX[0]} with {CALC_PARADOX[1]} as a symbol: {found['booster']}"
    )
    flags = calc.item_flags(connection)
    result.expect(
        "mail items (is_mail?) against the mail flags in the item data",
        sorted(found["mail"]),
        sorted(item for item, found_flags in flags.items() if calc.MAIL_FLAGS & set(found_flags)),
    )


def calc_hit_classes(result: CheckResult, overrides: dict[str, list[str]]) -> None:
    def having(*methods: str) -> list[str]:
        return sorted(code for code, found in overrides.items() if set(methods) & set(found))

    result.expect(
        "codes whose class sets its number of hits: the multi-hit and single-hit codes",
        having("pbNumHits", "pbRepeatHit?"),
        sorted(calc.MULTI_HIT_FUNCTIONS | calc.SINGLE_HIT_FUNCTIONS),
    )
    result.expect(
        "codes whose class hits more than once: the multi-hit codes",
        having("multiHitMove?", "pbRepeatHit?"),
        sorted(calc.MULTI_HIT_FUNCTIONS),
    )
    result.expect(
        "codes whose class is a recoil move: the recoil and crash codes",
        having("recoilMove?"),
        sorted(calc.RECOIL_FUNCTIONS),
    )
    result.expect(
        "codes whose class is a charging move: the two-turn codes",
        having("chargingTurnMove?"),
        sorted(calc.CHARGING_FUNCTIONS),
    )


CALC_ODDS_CLASSES = """
b = AnilBridge.battle; names = %i[__METHODS__]; out = {}
GameData::Move.each { |d| m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(d.id))
  out[d.function_code] ||= { "owners" => names.to_h { |n| [n.to_s, m.class.instance_method(n).owner.to_s] }, "healing" => m.healingMove? } }
{ "codes" => out, "targets" => GameData::Target.keys.map { |k| t = GameData::Target.get(k); [k.to_s, t.num_targets, t.targets_foe] } }
"""
CALC_ACCURACY_METHODS = (
    "pbAccuracyCheck",
    "pbBaseAccuracy",
    "pbCalcAccuracyModifiers",
    "pbOverrideSuccessCheckPerHit",
)
CALC_ODDS_METHODS = (*CALC_ACCURACY_METHODS, "pbPriority", "pbTarget", "pbCritialOverride")
CALC_BASE_OWNER = "Battle::Move"
CALC_CHARGING_OWNER = "Battle::Move::TwoTurnMove"
CALC_SPREAD_COUNT = 2
CALC_DOUBLE_SCRIPT = 'setBattleRule("double"); WildBattle.start(({foe}), ({foe}))'
CALC_TARGET_MOVES = ("TACKLE", "EARTHQUAKE", "ROCKSLIDE", "EXPANDINGFORCE")
CALC_TARGET_SETUP = """
b = AnilBridge.battle; f = b.battlers[3]; old = [b.field.terrain.to_s, f.hp]
b.field.terrain = :__TERRAIN__
if __FAINT__ then f.hp = 0; f.instance_variable_set(:@fainted, true) end
old
"""
CALC_TARGET_FIND = """
b = AnilBridge.battle; u = b.battlers[0]
find = lambda { |id, pre| m = Battle::Move.from_pokemon_move(b, Pokemon::Move.new(id)); u.pbFindTargets([:UseMove, 0, m, pre, 0], m, u).map(&:index).sort }
__MOVES__.to_h { |id| [id.to_s, [1, 3].map { |pre| find.call(id, pre) }.uniq.sort] }
"""
CALC_TARGET_RESTORE = """
b = AnilBridge.battle; f = b.battlers[3]
b.field.terrain = :__TERRAIN__; f.hp = __HP__; f.instance_variable_set(:@fainted, false); f.hp
"""
CALC_TARGET_SETUPS = (("None", False), ("Psychic", False), ("None", True))
CALC_ESCAPE = "AnilBridge.battle.battlers[0].item = :SMOKEBALL; true"


def calc_battle(live: Live, result: CheckResult, cap: int) -> None:
    if not start_probe_battle(live, result, cap):
        return
    build = BUILDS[live.launch.build]
    with closing(gamedb.open_gamedb(build, live.settings)) as connection:
        calc_formula(live, result, connection)
        calc_odds_classes(live, result)
        calc_view(live, result, connection)
        calc_extremes(live, result, connection)
        calc_upkeep(live, result, connection)
        if flee(live, result):
            calc_targets(live, result, connection, cap)


def calc_owning(
    codes: dict[str, Any], methods: tuple[str, ...], allowed: frozenset[str]
) -> set[str]:
    return {
        code
        for code, found in codes.items()
        if any(found["owners"][name] not in allowed for name in methods)
    }


def calc_odds_classes(live: Live, result: CheckResult) -> None:
    data = eval_data(live, CALC_ODDS_CLASSES.replace("__METHODS__", " ".join(CALC_ODDS_METHODS)))
    codes = data["codes"]
    present = set(codes)
    base = frozenset({CALC_BASE_OWNER})
    expected = (
        (
            "accuracy",
            CALC_ACCURACY_METHODS,
            base | {CALC_CHARGING_OWNER},
            calc.ACCURACY_FUNCTIONS,
        ),
        ("priority", ("pbPriority",), base, frozenset(calc.PRIORITY_TERRAINS)),
        (
            "targets",
            ("pbTarget",),
            base,
            calc.TARGET_FUNCTIONS | calc.TARGET_NEUTRAL_FUNCTIONS,
        ),
        ("critical hits", ("pbCritialOverride",), base, calc.ALWAYS_CRITICAL_FUNCTIONS),
    )
    for name, methods, allowed, known in expected:
        found = calc_owning(codes, methods, allowed)
        result.expect(
            f"function codes whose class changes {name}", sorted(found ^ (known & present)), []
        )
        result.note(f"{name}: {sorted(found)}; not in the build: {sorted(known - present)}")
    healing = {code for code, found in codes.items() if found["healing"]}
    result.expect(
        "function codes of healing moves", sorted(healing ^ (calc.HEALING_FUNCTIONS & present)), []
    )
    wrong = []
    for target, count, foe in data["targets"]:
        if target in calc.SPREAD_TARGETS and count != CALC_SPREAD_COUNT:
            wrong.append(f"{target} hits {count}")
        if target in calc.FOE_TARGETS and (count != 1 or not foe):
            wrong.append(f"{target} hits {count}, a foe {foe}")
        if count == CALC_SPREAD_COUNT and target not in calc.SPREAD_TARGETS:
            wrong.append(f"{target} hits several and is not a spread target")
    result.expect("move targets against GameData::Target", wrong, [])


def calc_targets(live: Live, result: CheckResult, connection: sqlite3.Connection, cap: int) -> None:
    partner = CAP_MON.format(species=BATTLE_LEAD_SPECIES, level=cap, move=BATTLE_LEAD_MOVE)
    eval_inspect(live.session, f"x = ({partner}); $player.party.push(x); $player.party.length")
    foe = CAP_MON.format(species=BATTLE_FOE_SPECIES, level=cap, move=BATTLE_FOE_MOVE)
    run_script(live, CALC_DOUBLE_SCRIPT.format(foe=foe))
    if reached(live, result, at_command, "wild double battle at its command menu") is None:
        return
    moves = "[" + ", ".join(f":{each}" for each in CALC_TARGET_MOVES) + "]"
    for terrain, faint in CALC_TARGET_SETUPS:
        old = eval_data(
            live,
            CALC_TARGET_SETUP.replace("__TERRAIN__", terrain).replace(
                "__FAINT__", str(faint).lower()
            ),
        )
        known = KnowledgeView(STORY, connection).state(read_state(live.session)).battle
        game = eval_data(live, CALC_TARGET_FIND.replace("__MOVES__", moves))
        eval_data(
            live,
            CALC_TARGET_RESTORE.replace("__TERRAIN__", old[0]).replace("__HP__", str(old[1])),
        )
        if known is None or not isinstance(known.battlers[0], Battler):
            result.mark(False, "the knowledge view shows our first battler in the double")
            return
        user = calc.own(connection, known.battlers[0])
        terms = calc.conditions(known)
        for move_id in CALC_TARGET_MOVES:
            move = gamedb.move(connection, move_id)
            found = calc.move_targets(move, user, 0, known, terms)
            result.expect(
                f"{move_id} targets in a double, terrain {terrain}, foe 3 fainted {faint}",
                [list(each.battlers) for each in found],
                game[move_id],
            )
    eval_inspect(live.session, CALC_ESCAPE)
    flee(live, result)


def calc_formula(live: Live, result: CheckResult, connection: sqlite3.Connection) -> None:
    probe = calc_eval(
        live,
        CALC_CASES_BODY,
        __CASES__=calc_case_source(connection),
        __ALL__=CALC_ALL_BADGES,
        __LEVEL__=CALC_STRONG_LEVEL,
        __EV__=CALC_STRONG_EV,
        __CAPVAR__=LEVEL_CAP_MODE_VARIABLE,
    )
    result.expect(
        "internal battle, user owned by the player, target owned",
        probe["owned"],
        [True, True, False],
    )
    (count_before, before), (count_after, after) = probe["badges"]
    result.mark(
        count_after > count_before and before == after,
        f"top-roll damage with {count_before} and {count_after} badges: {before}, {after}",
    )
    for number, found in enumerate(probe["passes"], start=1):
        calc_pass(result, connection, f"pass {number}", found)


def calc_pass(
    result: CheckResult, connection: sqlite3.Connection, label: str, found: dict[str, Any]
) -> None:
    user, target = found["user"], found["target"]
    result.note(f"{label}: user {user}, target {target}")
    calc_stat_formula(result, f"{label}, player's battler", user, found["user_inputs"])
    calc_stat_formula(result, f"{label}, foe", target, found["target_inputs"])
    for case, game in zip(CALC_ALL_CASES, found["cases"], strict=True):
        move = gamedb.move(connection, case.move)
        attack, defense = calc.attack_stats(move)
        user_stages = {attack: case.attack_stage} | dict(case.user_stages)
        target_stages = {defense: case.defense_stage} | dict(case.target_stages)
        target_numbers = target | ({"SPEED": user["SPEED"]} if case.same_speed else {})
        ours = calc_side(
            connection,
            user,
            case.user_types,
            user_stages,
            case.status,
            ability=case.user_ability,
            item=case.user_item,
            hp_divisor=case.user_hp_divisor,
            species=case.user_species,
            happiness=case.user_happiness,
            ivs={stat: values[1] for stat, values in found["user_inputs"].items()},
            team=tuple(game["team"]),
            effects=calc_effects(case.user_effects + calc_own_history(case.history)),
            hidden_effects=case.user_hidden,
            pp=None if case.pp is None else {move.id: case.pp},
        )
        theirs = calc_side(
            connection,
            target_numbers,
            case.target_types,
            target_stages,
            case.target_status,
            ability=case.target_ability,
            item=case.target_item,
            hp_divisor=case.target_hp_divisor,
            species=case.target_species,
            effects=calc_effects(case.target_effects),
        )
        terms = calc.Conditions(
            weather=case.weather,
            terrain=case.terrain,
            targets=case.targets,
            reflect=case.reflect,
            light_screen=case.light_screen,
            aurora_veil=case.aurora_veil,
            defender_side_size=case.side_size,
            mud_sport="MudSportField" in case.field,
            water_sport="WaterSportField" in case.field,
            gravity="Gravity" in case.field,
            magic_room="MagicRoom" in case.field,
            lucky_chant="LuckyChant" in case.target_side,
            history=calc_history(case.history),
            attacker_tailwind="Tailwind" in case.user_side,
            defender_tailwind="Tailwind" in case.target_side,
            attacker_swamp="Swamp" in case.user_side,
            defender_swamp="Swamp" in case.target_side,
            trick_room="TrickRoom" in case.field,
        )
        name = f"{label}, {case.name} ({case.move})"
        if not case.odds_only:
            found_damage = calc.damage(connection, move, ours, theirs, terms)
            calc_compare(result, name, found_damage, game, ranged=case.ranged)
        if case.odds:
            foe_move = gamedb.move(connection, case.foe_move)
            calc_odds(result, connection, name, move, foe_move, (ours, theirs), terms, game["odds"])


def calc_chance(result: CheckResult, label: str, found: calc.Chance, game: float) -> None:
    if found.low == found.high:
        result.expect(label, round(found.low, 6), round(game, 6))
        return
    result.mark(found.low <= game <= found.high, f"{label}: game {game} inside {found}")


def calc_game_crit(crits: list[bool]) -> float:
    always, any_crit, half, eighth = crits
    if always:
        return 1.0
    if not any_crit:
        return 0.0
    ratio = 2 if half else 8 if eighth else calc.CRIT_RATIOS[0]
    return 1 / ratio


def calc_odds(
    result: CheckResult,
    connection: sqlite3.Connection,
    label: str,
    move: gamedb.Move,
    foe_move: gamedb.Move,
    sides: tuple[calc.Combatant, calc.Combatant],
    terms: calc.Conditions,
    game: dict[str, Any],
) -> None:
    ours, theirs = sides
    found = calc.accuracy(connection, move, ours, theirs, terms)
    calc_chance(result, f"{label}, accuracy", found.chance, game["hits"] / calc.PERCENT)
    crit = calc.critical(connection, move, ours, theirs, terms)
    calc_chance(result, f"{label}, critical hit chance", crit.chance, calc_game_crit(game["crits"]))
    order = calc.speed_order(ours, move, theirs, foe_move, terms)
    firsts = game["firsts"]
    expected = (
        calc.EITHER_FIRST
        if len(firsts) > 1
        else calc.USER_FIRST
        if firsts == [0]
        else calc.TARGET_FIRST
    )
    result.expect(f"{label}, order ({'; '.join(order.reasons)})", order.first, expected)


@dataclass(frozen=True)
class CalcSides:
    battle: KnownBattle
    foe: KnownFoe
    own: calc.Combatant


def calc_sides(live: Live, result: CheckResult, connection: sqlite3.Connection) -> CalcSides | None:
    known = KnowledgeView(STORY, connection).state(read_state(live.session)).battle
    if known is None:
        result.mark(False, "the knowledge view shows no battle")
        return None
    ours, theirs = known.battlers[0], known.battlers[1]
    if not isinstance(ours, Battler) or not isinstance(theirs, KnownFoe):
        result.mark(False, "the view's first two battlers are not our battler and a foe")
        return None
    party = known.player_party
    pokemon = None if isinstance(party, Hidden) else party[ours.pokemon_index]
    team = None if isinstance(party, Hidden) else party
    return CalcSides(known, theirs, calc.own(connection, ours, pokemon, team))


def calc_both_ways(
    result: CheckResult,
    connection: sqlite3.Connection,
    label: str,
    sides: CalcSides,
    foe_side: calc.Combatant,
    game: dict[str, Any],
    move_id: str = CALC_FOE_MOVE,
) -> None:
    move = gamedb.move(connection, move_id)
    calc_contains(
        result,
        f"{label}, player into the foe",
        calc.damage(
            connection, move, sides.own, foe_side, calc.conditions(sides.battle, calc.OPPONENT_SIDE)
        ),
        game["to_foe"],
    )
    calc_contains(
        result,
        f"{label}, foe into the player",
        calc.damage(
            connection, move, foe_side, sides.own, calc.conditions(sides.battle, calc.PLAYER_SIDE)
        ),
        game["from_foe"],
    )


def calc_view(live: Live, result: CheckResult, connection: sqlite3.Connection) -> None:
    foe_hp = eval_data(live, CALC_FOE_HP.replace("__PERCENT__", str(CALC_FOE_PERCENT)))
    sides = calc_sides(live, result, connection)
    if sides is None:
        return
    result.expect("foe stats in the view", sides.foe.stats, HIDDEN)
    foe_side = calc.foe(connection, sides.foe)
    if not result.mark(foe_side is not None, "foe's species and level shown"):
        return
    assert foe_side is not None
    result.note(f"foe ranges from the view: {foe_side.stats}")
    result.mark(
        foe_side.hp.low <= foe_hp[0] <= foe_side.hp.high,
        f"foe HP {foe_hp[0]}/{foe_hp[1]}, shown {sides.foe.hp_percent}%, "
        f"inside {foe_side.hp.low}-{foe_side.hp.high}",
    )
    for move in (CALC_FOE_MOVE, *CALC_HP_MOVES):
        probe = calc_eval(live, CALC_FOE_BODY, __MOVE__=move, __HP__=foe_hp[0])
        label = f"wild foe from the view, {move}"
        calc_both_ways(result, connection, label, sides, foe_side, probe, move)
    calc_named(result, connection, sides, foe_side)
    calc_own_effects(live, result, connection)


def calc_ruby_values(values: list[Any]) -> str:
    def literal(value: Any) -> str:
        if value is None:
            return "nil"
        if isinstance(value, bool):
            return str(value).lower()
        return f":{value}" if isinstance(value, str) else str(value)

    return "[" + ", ".join(literal(each) for each in values) + "]"


def calc_own_slots(live: Live, values: str) -> list[Any]:
    effects = "[" + ", ".join(f":{name}" for name in CALC_OWN_EFFECT_SLOTS) + "]"
    return eval_data(live, ruby(CALC_OWN_EFFECTS, __EFFECTS__=effects, __VALUES__=values))


def calc_own_effects(live: Live, result: CheckResult, connection: sqlite3.Connection) -> None:
    old = calc_own_slots(live, "old")
    turn = old[len(CALC_OWN_EFFECT_SLOTS) + 5]
    new = [turn + 2, 2, True, 3, 1, *CALC_OWN_EFFECT_SLOTS.values(), turn + 3, True, 4, 1]
    calc_own_slots(live, calc_ruby_values(new))
    try:
        sides = calc_sides(live, result, connection)
    finally:
        calc_own_slots(live, calc_ruby_values(old))
    if sides is None:
        return
    effects = sides.own.effects
    found = (
        None if effects is None else {key: getattr(effects, key) for key in CALC_OWN_EFFECT_VALUES}
    )
    result.expect(
        "our battler's effects set by eval, read through the view", found, CALC_OWN_EFFECT_VALUES
    )


def calc_named(
    result: CheckResult,
    connection: sqlite3.Connection,
    sides: CalcSides,
    foe_side: calc.Combatant,
) -> None:
    result.mark(
        foe_side.ability_hidden and foe_side.item_hidden,
        f"the foe's ability and item unrevealed in the view: {sides.foe.ability!r}, "
        f"{sides.foe.held_item!r}",
    )
    terms = calc.conditions(sides.battle, calc.OPPONENT_SIDE)
    ground = calc.damage(
        connection, gamedb.move(connection, CALC_GROUND_MOVE), sides.own, foe_side, terms
    )
    named = {risk.name: risk for risk in ground.risks}
    result.note(f"{CALC_GROUND_MOVE} into the foe: {ground.percent}, risks {ground.risks}")
    for name in CALC_GROUND_RISKS:
        risk = named.get(name)
        result.mark(
            risk is not None and risk.damage.high == 0 and risk.note == calc.RISK_IMMUNE,
            f"{CALC_GROUND_MOVE} names {name} as an immunity: {risk}",
        )
    from_foe = calc.damage(
        connection,
        gamedb.move(connection, CALC_FOE_MOVE),
        foe_side,
        sides.own,
        calc.conditions(sides.battle, calc.PLAYER_SIDE),
    )
    result.mark(
        calc.NOT_MODELLED_FOE_EFFECTS in from_foe.not_modelled,
        f"the foe's hidden effects named: {from_foe.not_modelled}",
    )
    exact = calc.damage(
        connection,
        gamedb.move(connection, CALC_FOE_MOVE),
        sides.own,
        replace(foe_side, effects=BattlerEffects()),
        terms,
    )
    result.mark(
        calc.NOT_MODELLED_FOE_EFFECTS not in exact.not_modelled,
        f"exact effects on both sides name none: {exact.not_modelled}",
    )
    unmodelled = replace(sides.own, ability=CALC_UNMODELLED_ABILITY)
    found = calc.damage(
        connection, gamedb.move(connection, CALC_FOE_MOVE), unmodelled, foe_side, terms
    )
    flag = calc.NOT_MODELLED_ABILITY.format(ability=CALC_UNMODELLED_ABILITY)
    result.mark(flag in found.not_modelled, f"{flag!r} named: {found.not_modelled}")
    for move, expected in (
        (CALC_PLAIN_MOVE, False),
        *((each, False) for each in CALC_MODELLED_MOVES),
    ):
        found_move = gamedb.move(connection, move)
        found = calc.damage(connection, found_move, sides.own, foe_side, terms)
        code = calc.NOT_MODELLED_FUNCTION.format(code=found_move.function_code)
        result.expect(f"{move} names {code!r}", code in found.not_modelled, expected)
    hidden_power = calc.damage(
        connection,
        gamedb.move(connection, CALC_HIDDEN_POWER),
        foe_side,
        sides.own,
        calc.conditions(sides.battle, calc.PLAYER_SIDE),
    )
    kinds = calc.hidden_power_types(connection)
    result.expect(
        f"{CALC_HIDDEN_POWER} from the foe, its IVs hidden: every type it can take",
        hidden_power.types,
        kinds,
    )
    calc_unknown_history(result, connection, sides, foe_side, terms)
    calc_speed_view(result, connection, sides, foe_side, terms)
    calc_shown_effects(result, sides.battle)


def calc_unknown_history(
    result: CheckResult,
    connection: sqlite3.Connection,
    sides: CalcSides,
    foe_side: calc.Combatant,
    terms: calc.Conditions,
) -> None:
    move = gamedb.move(connection, CALC_BOTH_WAYS_MOVE)
    found = calc.damage(connection, move, sides.own, foe_side, terms)
    ends = [
        calc.damage(
            connection,
            move,
            sides.own,
            foe_side,
            replace(terms, history=calc.History(target_acted=state)),
        ).damage
        for state in (False, True)
    ]
    result.expect(
        f"{CALC_BOTH_WAYS_MOVE} into the foe, round unknown: the range over both outcomes",
        [found.damage.low, found.damage.high],
        [ends[0].low, ends[1].high],
    )
    for move_id in CALC_COUNTER_MOVES:
        counter = gamedb.move(connection, move_id)
        found = calc.damage(connection, counter, sides.own, foe_side, terms)
        name = calc.NOT_MODELLED_HISTORY.format(code=counter.function_code)
        result.mark(
            name in found.not_modelled
            and found.damage == calc.Span(0, foe_side.stats[calc.HP].high),
            f"{move_id} into the foe, round unknown: {found.damage}, {found.not_modelled}",
        )


def calc_speed_view(
    result: CheckResult,
    connection: sqlite3.Connection,
    sides: CalcSides,
    foe_side: calc.Combatant,
    terms: calc.Conditions,
) -> None:
    speed = calc.effective_speed(foe_side, sides.own, terms, attacker=False)
    raw = foe_side.stats[calc.SPEED]
    bare = replace(foe_side, item=None, item_hidden=False, ability=None, ability_hidden=False)
    slow = replace(
        bare, item=CALC_SLOW_ITEM, stats=foe_side.stats | {calc.SPEED: calc.Span.exact(raw.low)}
    )
    fast = replace(
        bare, item=calc.CHOICE_SCARF, stats=foe_side.stats | {calc.SPEED: calc.Span.exact(raw.high)}
    )
    ends = [calc.effective_speed(each, sides.own, terms, attacker=False) for each in (slow, fast)]
    result.mark(
        speed.low <= ends[0].low and speed.high >= ends[1].high,
        f"the foe's speed with its item unrevealed: {speed}, covering {ends[0]} with "
        f"{CALC_SLOW_ITEM} at its lowest stat and {ends[1]} with {calc.CHOICE_SCARF} at its highest",
    )
    for move_id in CALC_SPEED_MOVES:
        move = gamedb.move(connection, move_id)
        found = calc.damage(connection, move, sides.own, foe_side, terms).damage
        pinned = [
            calc.damage(connection, move, sides.own, each, terms).damage for each in (slow, fast)
        ]
        low, high = min(each.low for each in pinned), max(each.high for each in pinned)
        result.mark(
            found.low <= low and found.high >= high and found.low < found.high,
            f"{move_id} into the foe over its speed range: {found}, covering {low}-{high} "
            "from its slowest and fastest",
        )


def calc_shown_effects(result: CheckResult, battle: KnownBattle) -> None:
    shown = (
        KnownEffect(side=calc.OPPONENT_SIDE, effect="Reflect", since_turn=0, turns=1, layers=None),
        KnownEffect(
            side=calc.PLAYER_SIDE, effect="LightScreen", since_turn=0, turns=1, layers=None
        ),
        KnownEffect(side=calc.FIELD_SIDE, effect="Gravity", since_turn=0, turns=1, layers=None),
        KnownEffect(side=calc.FIELD_SIDE, effect="WonderRoom", since_turn=0, turns=1, layers=None),
        KnownEffect(side=calc.PLAYER_SIDE, effect="Tailwind", since_turn=0, turns=1, layers=None),
        KnownEffect(side=calc.OPPONENT_SIDE, effect="Swamp", since_turn=0, turns=1, layers=None),
    )
    staged = replace(battle, shown_effects=shown)
    theirs = calc.conditions(staged, calc.OPPONENT_SIDE)
    ours = calc.conditions(staged, calc.PLAYER_SIDE)
    result.expect(
        "shown effects as the foe side's conditions: Reflect, Light Screen, Gravity, unmodelled",
        [theirs.reflect, theirs.light_screen, theirs.gravity, theirs.unmodelled],
        [True, False, True, ("WonderRoom",)],
    )
    result.expect(
        "shown effects as our side's conditions: Reflect, Light Screen",
        [ours.reflect, ours.light_screen],
        [False, True],
    )
    result.expect(
        "our Tailwind and the foe's swamp as each attacker's and defender's conditions",
        [
            [theirs.attacker_tailwind, theirs.defender_tailwind],
            [theirs.attacker_swamp, theirs.defender_swamp],
            [ours.attacker_tailwind, ours.defender_tailwind],
            [ours.attacker_swamp, ours.defender_swamp],
        ],
        [[True, False], [False, True], [False, True], [True, False]],
    )


def calc_extremes(live: Live, result: CheckResult, connection: sqlite3.Connection) -> None:
    sides = calc_sides(live, result, connection)
    if sides is None:
        return
    foe_side = calc.foe(connection, sides.foe, calc.TRAINER)
    if not result.mark(foe_side is not None, "foe's species and level shown"):
        return
    assert foe_side is not None
    extremes = (
        "[" + ", ".join(f"[{iv}, {ev}, {nature!r}]" for iv, ev, nature in CALC_EXTREMES) + "]"
    )
    probe = calc_eval(live, CALC_EXTREME_BODY, __EXTREMES__=extremes, __MOVE__=CALC_FOE_MOVE)
    for each in probe["extremes"]:
        label = "trainer IVs {}, EVs {}, {}".format(*each["config"])
        stats = each["stats"]
        calc_stat_formula(result, label, stats, each["inputs"])
        outside = [
            f"{stat} {stats[stat]} outside {span.low}-{span.high}"
            for stat, span in foe_side.stats.items()
            if not span.low <= stats[stat] <= span.high
        ]
        result.mark(not outside, f"{label}: stats {stats} inside the trainer ranges {outside}")
        calc_both_ways(result, connection, label, sides, foe_side, each)


@dataclass(frozen=True)
class UpkeepCase:
    name: str
    types: tuple[str, ...] = ("NORMAL",)
    status: str = "NONE"
    ability: str | None = None
    item: str | None = None
    weather: str = "None"
    terrain: str = "None"
    hp_divisor: int = 2
    effects: tuple[tuple[str, Any], ...] = ()
    raw_effects: tuple[tuple[str, Any], ...] = ()
    foe_item: str | None = None
    rounds: int = 1
    draw: int | None = None
    hidden: bool = False


UPKEEP_IVARS = {"status_count": "@statusCount"}
UPKEEP_BAD_POISON = (("status_count", 1),)
UPKEEP_TRAP = (("TrappingMove", "WRAP"), ("TrappingUser", 1))
UPKEEP_CASES = (
    UpkeepCase("burn", status="BURN", rounds=2),
    UpkeepCase("burn, Heatproof", status="BURN", ability="HEATPROOF"),
    UpkeepCase("poison", status="POISON", hp_divisor=1, rounds=2),
    UpkeepCase(
        "bad poison from count 0",
        status="POISON",
        hp_divisor=1,
        effects=UPKEEP_BAD_POISON,
        rounds=4,
    ),
    UpkeepCase(
        "bad poison from count 5",
        status="POISON",
        hp_divisor=1,
        effects=(*UPKEEP_BAD_POISON, ("toxic", 5)),
        rounds=2,
    ),
    UpkeepCase(
        "bad poison from count 14",
        status="POISON",
        hp_divisor=1,
        effects=(*UPKEEP_BAD_POISON, ("toxic", 14)),
        rounds=1,
    ),
    UpkeepCase("Poison Heal", status="POISON", ability="POISONHEAL"),
    UpkeepCase("sandstorm on a Normal type", weather="Sandstorm", hp_divisor=1, rounds=2),
    UpkeepCase("sandstorm on a Rock type", types=("ROCK",), weather="Sandstorm"),
    UpkeepCase("sandstorm, Overcoat", ability="OVERCOAT", weather="Sandstorm"),
    UpkeepCase("sandstorm, Safety Goggles", item="SAFETYGOGGLES", weather="Sandstorm"),
    UpkeepCase("snow on a Normal type", weather="Hail"),
    UpkeepCase("Leftovers", item="LEFTOVERS", rounds=2),
    UpkeepCase("Leftovers at full HP", item="LEFTOVERS", hp_divisor=1),
    UpkeepCase("Black Sludge on a Poison type", types=("POISON",), item="BLACKSLUDGE"),
    UpkeepCase("Black Sludge on a Normal type", item="BLACKSLUDGE", hp_divisor=1),
    UpkeepCase(
        "Magic Guard: burned, Black Sludge, sandstorm",
        status="BURN",
        ability="MAGICGUARD",
        item="BLACKSLUDGE",
        weather="Sandstorm",
    ),
    UpkeepCase(
        "Magic Guard, bad poison, Leftovers",
        status="POISON",
        ability="MAGICGUARD",
        item="LEFTOVERS",
        effects=UPKEEP_BAD_POISON,
    ),
    UpkeepCase("Grassy Terrain", terrain="Grassy"),
    UpkeepCase("Grassy Terrain on a Flying type", types=("FLYING",), terrain="Grassy"),
    UpkeepCase("Rain Dish in rain", ability="RAINDISH", weather="Rain"),
    UpkeepCase("Dry Skin in rain", ability="DRYSKIN", weather="Rain"),
    UpkeepCase("Dry Skin in sun", ability="DRYSKIN", weather="Sun"),
    UpkeepCase(
        "Dry Skin in sun, Utility Umbrella",
        ability="DRYSKIN",
        item="UTILITYUMBRELLA",
        weather="Sun",
    ),
    UpkeepCase("Solar Power in sun", ability="SOLARPOWER", weather="Sun"),
    UpkeepCase("Ice Body in snow", ability="ICEBODY", weather="Hail"),
    UpkeepCase("Hydration in rain, burned", status="BURN", ability="HYDRATION", weather="Rain"),
    UpkeepCase("Shed Skin, burned, cured", status="BURN", ability="SHEDSKIN", draw=0),
    UpkeepCase("Shed Skin, burned, not cured", status="BURN", ability="SHEDSKIN", draw=50),
    UpkeepCase("Aqua Ring, Big Root", item="BIGROOT", effects=(("aqua_ring", True),)),
    UpkeepCase("Ingrain", effects=(("ingrain", True),)),
    UpkeepCase("Leech Seed", effects=(("leech_seed", 1),), rounds=2),
    UpkeepCase("Curse", effects=(("curse", True),)),
    UpkeepCase(
        "Nightmare, asleep",
        status="SLEEP",
        effects=(("status_count", 3), ("nightmare", True)),
    ),
    UpkeepCase("Salt Cure on a Normal type", effects=(("salt_cure", True),)),
    UpkeepCase("Salt Cure on a Steel type", types=("STEEL",), effects=(("salt_cure", True),)),
    UpkeepCase(
        "trapped for 3 rounds",
        effects=(("trapping", 3),),
        raw_effects=UPKEEP_TRAP,
        rounds=3,
    ),
    UpkeepCase(
        "trapped, Binding Band on the trapper",
        effects=(("trapping", 3),),
        raw_effects=UPKEEP_TRAP,
        foe_item="BINDINGBAND",
    ),
    UpkeepCase("Heal Block, Leftovers", item="LEFTOVERS", effects=(("heal_block", 5),)),
    UpkeepCase(
        "Heal Block for 2 more rounds, Leftovers",
        item="LEFTOVERS",
        effects=(("heal_block", 2),),
        rounds=3,
    ),
    UpkeepCase(
        "Embargo for 2 more rounds, Leftovers",
        item="LEFTOVERS",
        effects=(("embargo", 2),),
        rounds=3,
    ),
    UpkeepCase(
        "Magnet Rise for 2 more rounds, Grassy Terrain",
        terrain="Grassy",
        effects=(("magnet_rise", 2),),
        rounds=3,
    ),
    UpkeepCase(
        "sandstorm, Leftovers and bad poison together",
        status="POISON",
        item="LEFTOVERS",
        weather="Sandstorm",
        hp_divisor=1,
        effects=UPKEEP_BAD_POISON,
        rounds=3,
    ),
    UpkeepCase(
        "fainting stops the round: 1 HP, burned, Leftovers, sandstorm",
        status="BURN",
        item="LEFTOVERS",
        weather="Sandstorm",
        hp_divisor=1000,
    ),
    UpkeepCase(
        "hidden bad poison count 5, inside the range",
        status="POISON",
        hp_divisor=1,
        effects=(*UPKEEP_BAD_POISON, ("toxic", 5)),
        hidden=True,
    ),
    UpkeepCase("hidden effects, regular poison, inside the range", status="POISON", hidden=True),
)


@dataclass(frozen=True)
class KnockOutCase:
    name: str
    status: str = "NONE"
    item: str | None = None
    weather: str = "None"
    effects: tuple[tuple[str, Any], ...] = ()


KO_MOVE = "TACKLE"
KO_ATTACK = 4
KO_USER_ABILITY = "MAGICGUARD"
KO_CASES = (
    KnockOutCase("burned, Leftovers", status="BURN", item="LEFTOVERS"),
    KnockOutCase("bad poison", status="POISON", effects=UPKEEP_BAD_POISON),
    KnockOutCase("sandstorm, Black Sludge", item="BLACKSLUDGE", weather="Sandstorm"),
    KnockOutCase("Leftovers", item="LEFTOVERS"),
)
UPKEEP_BODY = """
  quiet.call(b, %i[pbEORSwitch pbGainExp]); quiet.call(b.scene, %i[pbBeginEndOfRoundPhase])
  quiet.call(u, %i[pbFaint]); quiet.call(t, %i[pbFaint])
  base = [u.effects.dup, t.effects.dup]; choices = b.choices.map(&:dup); b.choices.each { |x| x[0] = :None }
  setup = lambda { |x, c|
    clear.call; u.effects.replace(base[0].dup); t.effects.replace(base[1].dup)
    x.types = c[:types].map(&:to_sym) if c[:types]
    x.statusCount = c[:status_count]; x.status = c[:status].to_sym
    x.ability = c[:ability].to_sym if !c[:ability].empty?; x.item = c[:item].to_sym if !c[:item].empty?
    b.field.weather = c[:weather].to_sym; b.field.weatherDuration = -1
    b.field.terrain = c[:terrain].to_sym; b.field.terrainDuration = -1
    c[:effects].each { |e, v| v = v.to_sym if v.is_a?(String)
      if e.start_with?("@") then x.instance_variable_set(e, v) else x.effects[PBEffects.const_get(e.to_sym)] = v end } }
  out["user"] = stat.call(u)
  out["upkeep"] = __CASES__.map { |c|
    setup.call(u, c); t.item = c[:foe_item].to_sym if !c[:foe_item].empty?
    u.hp = [u.totalhp / c[:hp_divisor], 1].max; draw = c[:draw] == "" ? nil : c[:draw]
    r = { "total" => u.totalhp, "start" => u.hp, "hp" => (1..c[:rounds]).map { b.pbEndOfRoundPhase; u.hp } }
    draw = nil; r }
  clear.call; u.effects.replace(base[0].dup); t.effects.replace(base[1].dup)
  out["ko_user"] = stat.call(u.tap { |x| x.attack = __ATTACK__ }); out["ko_user_types"] = u.types.map(&:to_s)
  out["ko"] = __KO__.map { |c|
    setup.call(t, c); u.ability = :__USER_ABILITY__; u.attack = __ATTACK__
    taken = lambda { |hits| hits.sum }
    plain = rolls.call(u, t, :__MOVE__, false, 1).map(&taken); crit = rolls.call(u, t, :__MOVE__, true, 1).map(&taken)
    kept = t.effects.dup; status = [t.status, t.statusCount]
    count = lambda { |dmg| t.effects.replace(kept.dup); t.statusCount = status[1]; t.status = status[0]; t.hp = t.totalhp
      (1..__ROUNDS__).find { t.hp -= [dmg, t.hp].min; next true if t.hp <= 0; b.pbEndOfRoundPhase; t.hp <= 0 } }
    r = { "target" => stat.call(t), "types" => t.types.map(&:to_s), "plain" => plain, "crit" => crit,
      "counts" => [plain.min, plain.max, crit.min, crit.max].map(&count) }
    t.hp = t.totalhp; r }
  b.choices.each_with_index { |x, i| x.replace(choices[i]) }
"""


def upkeep_values(case: UpkeepCase | KnockOutCase, types: bool) -> dict[str, Any]:
    effects = dict(case.effects)
    raw = [
        [UPKEEP_IVARS.get(key) or BATTLER_EFFECTS[key], value]
        for key, value in case.effects
        if key in UPKEEP_IVARS or key in BATTLER_EFFECTS
    ]
    extra = list(map(list, getattr(case, "raw_effects", ())))
    values = {
        "status": case.status,
        "status_count": effects.get("status_count", 0),
        "ability": getattr(case, "ability", None) or "",
        "item": case.item or "",
        "weather": case.weather,
        "terrain": getattr(case, "terrain", "None"),
        "effects": raw + extra,
    }
    if types and isinstance(case, UpkeepCase):
        values["types"] = list(case.types)
    if isinstance(case, UpkeepCase):
        values |= {
            "foe_item": case.foe_item or "",
            "hp_divisor": case.hp_divisor,
            "rounds": case.rounds,
            "draw": "" if case.draw is None else case.draw,
        }
    return values


def calc_upkeep(live: Live, result: CheckResult, connection: sqlite3.Connection) -> None:
    probe = calc_eval(
        live,
        UPKEEP_BODY,
        __CASES__=json.dumps([upkeep_values(case, True) for case in UPKEEP_CASES]),
        __KO__=json.dumps([upkeep_values(case, False) for case in KO_CASES]),
        __USER_ABILITY__=KO_USER_ABILITY,
        __ATTACK__=KO_ATTACK,
        __MOVE__=KO_MOVE,
        __ROUNDS__=calc.KO_ROUNDS,
    )
    for case, game in zip(UPKEEP_CASES, probe["upkeep"], strict=True):
        effects = dict(case.effects)
        ours = replace(
            calc_side(
                connection,
                probe["user"],
                case.types,
                status=case.status,
                ability=case.ability,
                item=case.item,
                effects=BattlerEffects.model_validate(effects),
                hidden_effects=case.hidden,
            ),
            hp=calc.Span.exact(game["start"]),
        )
        other = replace(ours, ability=None, item=case.foe_item, effects=BattlerEffects())
        terms = calc.Conditions(weather=case.weather, terrain=case.terrain)
        found = calc.end_of_turn(connection, ours, other, terms, case.rounds)
        label = f"end of round, {case.name}, from {game['start']}/{game['total']} HP"
        if case.hidden or case.ability == calc.SHED_SKIN:
            outside = [
                f"round {number}: {actual} outside {span.low}-{span.high}"
                for number, (span, actual) in enumerate(zip(found.hp, game["hp"], strict=True), 1)
                if not span.low <= actual <= span.high
            ]
            result.mark(
                not outside,
                f"{label}: game HP {game['hp']} inside "
                f"{[[span.low, span.high] for span in found.hp]} {outside}",
            )
            continue
        result.expect(
            f"{label}, HP after each round",
            [[span.low, span.high] for span in found.hp],
            [[hp, hp] for hp in game["hp"]],
        )
    calc_knock_outs(result, connection, probe)


def calc_knock_outs(
    result: CheckResult, connection: sqlite3.Connection, probe: dict[str, Any]
) -> None:
    move = gamedb.move(connection, KO_MOVE)
    for case, game in zip(KO_CASES, probe["ko"], strict=True):
        ours = calc_side(
            connection, probe["ko_user"], tuple(probe["ko_user_types"]), ability=KO_USER_ABILITY
        )
        theirs = calc_side(
            connection,
            game["target"],
            tuple(game["types"]),
            status=case.status,
            item=case.item,
            effects=BattlerEffects.model_validate(dict(case.effects)),
        )
        terms = calc.Conditions(weather=case.weather)
        damage = calc.damage(connection, move, ours, theirs, terms)
        label = f"hits to KO, {KO_MOVE} into {case.name}"
        result.expect(
            f"{label}, damage over the rolls (plain, crit)",
            [
                [damage.damage.low, damage.damage.high],
                [damage.crit_damage.low, damage.crit_damage.high],
            ],
            [[min(game["plain"]), max(game["plain"])], [min(game["crit"]), max(game["crit"])]],
        )
        found = calc.hits_to_ko(connection, damage, ours, theirs, terms)
        low, high, crit_low, crit_high = game["counts"]
        result.expect(
            f"{label}: fewest and most hits, plain then crit, against the game's rounds",
            [found.plain.fewest, found.plain.most, found.crit.fewest, found.crit.most],
            [high, low, crit_high, crit_low],
        )


def check_freeze(live: Live, result: CheckResult) -> None:
    data = eval_data(live, FREEZE_DATA)
    result.expect("Settings::FREEZE_EFFECTS_CAUSE_FROSTBITE", data["setting"], False)
    result.expect("registered statuses, in order", data["statuses"], FREEZE_STATUSES)
    result.expect("FROZEN name, animation, icon position", data["frozen"], FREEZE_FROZEN)
    in_battle_snapshot(live, result, freeze_battle)


def freeze_battle(live: Live, result: CheckResult, cap: int) -> None:
    if not start_probe_battle(live, result, cap):
        return
    probe = eval_data(
        live, ruby(FREEZE_PROBE, WEATHERS=f"%i[{' '.join(FREEZE_WEATHERS)}]", DRAWS=FREEZE_DRAWS)
    )
    result.expect("freeze allowed on a Normal target, by weather", probe["normal"], FREEZE_WEATHERS)
    result.expect("freeze allowed on an Ice target", probe["ice"], False)
    result.expect(
        "after pbFreeze: battler status, Pokémon status, pbHasStatus?(:FROZEN)",
        probe["inflicted"],
        ["FROZEN", "FROZEN", True],
    )
    freeze_tries(result, probe["tries"])
    for turn in FREEZE_TURNS:
        if not freeze_turn(live, result, turn):
            return
    flee(live, result)


def freeze_tries(result: CheckResult, tries: list[list[Any]]) -> None:
    counts = {(thawed, moved): count for thawed, moved, count in tries}
    result.note(f"pbTryUseMove while frozen, {FREEZE_DRAWS} tries (thawed, moved, count): {tries}")
    result.expect(
        "tries that stayed frozen yet moved, or thawed yet did not move",
        counts.get((False, True), 0) + counts.get((True, False), 0),
        0,
    )
    thawed = counts.get((True, True), 0)
    mean = FREEZE_DRAWS * FREEZE_THAW_CHANCE
    spread = FREEZE_SIGMAS * (FREEZE_DRAWS * FREEZE_THAW_CHANCE * (1 - FREEZE_THAW_CHANCE)) ** 0.5
    result.mark(
        abs(thawed - mean) <= spread,
        f"thawed {thawed} of {FREEZE_DRAWS} ({thawed / FREEZE_DRAWS:.3f}); "
        f"expected {mean:.0f} ± {spread:.0f}",
    )


def freeze_turn(live: Live, result: CheckResult, turn: FreezeTurn) -> bool:
    setup = eval_data(
        live,
        ruby(FREEZE_TURN_SETUP, USER=turn.user, FOE=turn.foe, MOVE=turn.move, ROLL=turn.roll),
    )
    result.note(f"{turn.label}: lead, foe, move, thaws user, foe HP before {setup}")
    if not result.mark(choose_command(live, result, FIGHT_COMMAND), f"{turn.label}: chose Luchar"):
        return False
    fight = reached(live, result, lambda now, _: now.context.name == BATTLE_FIGHT, "move menu")
    if fight is None:
        return False
    press(live, CONFIRM)
    texts = reached(live, result, at_command, f"{turn.label}: back at the command menu")
    if texts is None:
        return False
    user, foe, hp, total = eval_data(live, FREEZE_TURN_AFTER)
    result.expect(
        f"{turn.label}: lead and foe status after the turn",
        [user, foe],
        [turn.user_after, turn.foe_after],
    )
    result.expect(f"{turn.label}: foe hit ({hp}/{total} HP)", hp < total, turn.hit)
    for word in turn.words:
        result.mark(any(word in text for text in texts), f"{turn.label}: a message says {word!r}")
    return True


def shiny_odds(retries: int, extra: int | None) -> tuple[float, float]:
    plain = 1 - (1 - SHINY_CHANCE / SHINY_RANGE) ** (retries + 1)
    added = 0.0 if extra is None else 1 / extra
    return plain, 1 - (1 - plain) * (1 - added)


def chain_odds(combo: int) -> int:
    step = min(combo // SHINY_CHAIN_LENGTH, SHINY_CHAIN_TOP)
    return SHINY_CHAIN_ODDS * (5 - step) // 5


def check_shinies(live: Live, result: CheckResult) -> None:
    data = eval_data(live, SHINY_PRELUDE + SHINY_DATA)
    for name, expected in SHINY_SETTINGS.items():
        result.expect(f"Settings::{name}", data["settings"].get(name), expected)
    result.expect(
        "CHAINLENGTH, SHINYPROBABILITY", data["chain"], [SHINY_CHAIN_LENGTH, SHINY_CHAIN_ODDS]
    )
    result.expect("salvajes_visibles_en_ow", data["wild_option"], WILD_HIDDEN)
    result.expect("salvajes_visibles_en_ow?", data["visible"], False)
    result.note(f"mensaje_shinys {data['messages']}")
    result.expect(
        f"switches {list(SHINY_SWITCHES)}", data["switches"], [False] * len(SHINY_SWITCHES)
    )
    handlers = data["wild_handlers"]
    result.note(f"on_wild_pokemon_created: {', '.join(handlers)}")
    result.note(f"on_wild_battle_end: {', '.join(data['end_handlers'])}")
    result.expect(
        "shiny handlers on wild creation",
        [name for name in handlers if name in SHINY_HANDLERS],
        [name for name in SHINY_HANDLERS if name in handlers],
    )
    result.expect("all shiny handlers present", set(SHINY_HANDLERS) <= set(handlers), True)
    shiny_items(result, data)
    result.expect(f"battled count of {TEST_SPECIES}", data["battled"], 0)
    for species, shiny, rolled in data["starters"]:
        result.note(f"starter {species}: shiny? {shiny}, personal ID roll {rolled}")
        result.expect(f"starter {species} shiny? follows its personal ID", shiny, rolled)
    result.note(
        f"{data['trainer_shiny']} of {data['trainer_pokemon']} PBS trainer Pokémon set Shiny; "
        f"{data['unrandomizable_trainers']} unrandomizable trainers, "
        f"{data['unrandomizable_slots']} unrandomizable trainer slots"
    )
    dex = {base for key, base in data["dex_species"].items() if key in ALLOWED_SPECIES}
    result.note(
        f"{len(dex)} species in the allow-list, against the {SHINY_CHARM_DEX} Oak's charm event "
        f"(map {SHINY_CHARM_EVENT[0]}, event {SHINY_CHARM_EVENT[1]}) asks for"
    )
    session = live.session
    name = f"{SHINY_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        transfer(live, RANDOM_WILD_MAP, RANDOM_WILD_TILE, FACING_DOWN)
        shiny_samples(live, result, data["wild_option"])
        shiny_potion(live, result)
        shiny_counter(live, result)
        shiny_trainers(live, result)
    finally:
        restore_snapshot(session, name)


def shiny_items(result: CheckResult, data: dict[str, Any]) -> None:
    charm, potion = data["charm"], data["potion"]
    result.note(f"{SHINY_CHARM}: {charm}")
    result.note(f"{SHINY_POTION}: {potion}")
    result.expect(f"{SHINY_CHARM} is a key item", charm[2], True)
    result.expect(f"{SHINY_CHARM} kept by the item randomizer", charm[5], True)
    result.expect(f"{SHINY_POTION} kept by the item randomizer", potion[5], False)
    result.expect(f"{SHINY_POTION} in the random item pool", data["potion_in_pool"], True)
    result.note(f"random item pool: {data['pool']} items")
    result.expect(f"{SHINY_CHARM} in the bag at the start", data["has_charm"], False)


def shiny_samples(live: Live, result: CheckResult, option: int) -> None:
    expected = {
        "wild": shiny_odds(0, SHINY_CHAIN_ODDS),
        "visible": shiny_odds(0, None),
        "chain": shiny_odds(0, chain_odds(SHINY_CHAIN_LENGTH * SHINY_CHAIN_TOP)),
        "charm": shiny_odds(SHINY_CHARM_RETRIES, SHINY_CHAIN_ODDS // 2),
        "gift": shiny_odds(0, None),
    }
    wild_rate = 0.0
    for kind, total in SHINY_SAMPLES.items():
        source = ruby(
            SHINY_BATCH_SOURCE.replace("SETUP", SHINY_SETUP[kind])
            .replace("MAKE", SHINY_MAKE.get(kind, SHINY_MAKE["wild"]))
            .replace("CLEANUP", SHINY_CLEANUP),
            COUNT=SHINY_BATCH,
            TYPE=SHINY_TYPE,
            SPECIES=SHINY_SPECIES,
            LEVEL=SHINY_LEVEL,
            COMBO=SHINY_CHAIN_LENGTH * SHINY_CHAIN_TOP,
            CHARM=SHINY_CHARM,
            OPTION=option,
        )
        counts = [0, 0, 0, 0, 0]
        seen: set[str] = set()
        for _ in range(total // SHINY_BATCH):
            batch = eval_data(live, SHINY_PRELUDE + source)
            counts = [a + b for a, b in zip(counts, batch[:5], strict=True)]
            seen.update(batch[5])
        made, plain, shiny, added, sparkly = counts
        base, final = expected[kind]
        if kind == "wild":
            wild_rate = shiny / made
        result.note(
            f"{kind}: {shiny} shiny in {made} (1 in {made / max(shiny, 1):.0f}); "
            f"{plain} by the personal ID roll, {added} by the add-on's roll, {sparkly} super shiny; "
            f"{len(seen)} species"
        )
        shiny_within(result, f"{kind} personal ID roll", plain, made, base)
        shiny_within(result, f"{kind} shiny", shiny, made, final)
        if kind == "chain":
            result.expect(f"chain Pokémon kept {SHINY_SPECIES}", seen, {SHINY_SPECIES})
    for battles in SHINY_BATTLES:
        result.note(
            f"{battles} wild battles at the measured rate: {battles * wild_rate:.2f} shinies "
            f"expected, {1 - (1 - wild_rate) ** battles:.0%} chance of at least one"
        )


def shiny_within(result: CheckResult, label: str, count: int, made: int, odds: float) -> None:
    mean = made * odds
    spread = SHINY_SIGMAS * (made * odds * (1 - odds)) ** 0.5
    result.mark(
        abs(count - mean) <= spread,
        f"{label}: {count} in {made}, {mean:.1f} expected (1 in {1 / odds:.0f}), "
        f"within {SHINY_SIGMAS} sigma ({spread:.1f})",
    )


def shiny_potion(live: Live, result: CheckResult) -> None:
    source = ruby(
        SHINY_POTION_SOURCE,
        SWITCH=SHINY_POTION_SWITCH,
        TYPE=SHINY_TYPE,
        TRIES=SHINY_POTION_TRIES,
    )
    shiny, sparkly, rolled, after, later = eval_data(live, SHINY_PRELUDE + source)
    result.note(f"with switch {SHINY_POTION_SWITCH} on, personal ID roll {rolled}")
    result.expect("next wild shiny, super shiny", [shiny, sparkly], [True, False])
    result.expect(f"switch {SHINY_POTION_SWITCH} after it", after, False)
    result.note(f"{later} shiny in the {SHINY_POTION_TRIES} wild Pokémon after it")


def shiny_counter(live: Live, result: CheckResult) -> None:
    steps = ruby(SHINY_COUNTER, STEPS=json.dumps(SHINY_COUNTER_STEPS), LEVEL=SHINY_LEVEL)
    chain = eval_data(live, steps)
    result.expect(
        "catch chain after win, win, catch, flee, loss, then a win on another species",
        chain,
        SHINY_COUNTER_EXPECTED,
    )


def shiny_trainers(live: Live, result: CheckResult) -> None:
    parties = eval_data(live, ruby(SHINY_TRAINERS, EVERY=SHINY_TRAINER_EVERY))
    mons = [mon for party in parties for mon in party]
    shiny = [mon[0] for mon in mons if mon[1]]
    result.note(f"{len(parties)} trainers loaded through the randomizer, {len(mons)} Pokémon")
    result.expect("shiny trainer Pokémon", shiny, [])


STATS_SNAPSHOT_PREFIX = "check-stats-"
STATS_SETTINGS = {
    "MECHANICS_GENERATION": 9,
    "NO_VITAMIN_EV_CAP": True,
    "DISABLE_IVS_AND_EVS": False,
    "MORE_EVS_FROM_POWER_ITEMS": True,
    "SHOW_ADVANCED_STATS": True,
    "SUMMARY_IV_RATINGS": True,
}
STATS_LIMITS = {"IV_STAT_LIMIT": 31, "EV_LIMIT": 510, "EV_STAT_LIMIT": 252}
NO_GRINDING_SWITCH = 149
CHARMS_PLUGIN = "Charms Case"
STAT_NAMES = ("HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED")
STATS_ITEMS = (
    *VITAMINS,
    *FEATHERS,
    *CHAPAS,
    *MOCHIS,
    RESET_MOCHI,
    *EV_BERRIES,
    MACHO_BRACE,
    *POWER_ITEMS,
    "DESTINYKNOT",
)
STATS_ABSENT = ("BOTTLECAP", "GOLDBOTTLECAP", "CHAPADORADA")
STATS_SHOPS = {
    "78/42": ["CALCIUM", "PROTEIN", "CARBOS", "IRON", "ZINC", "HPUP"],
    "91/50": list(EV_BERRIES),
    "207/6": list(POWER_ITEMS),
    "207/9": [*MOCHIS, RESET_MOCHI],
}
PUNCH_BAG_EVENTS = {
    "117/19": ["HP", "DEFENSE", "SPECIAL_DEFENSE"],
    "117/20": ["ATTACK", "SPECIAL_ATTACK", "SPEED"],
}
STATS_DATA = f"""
item = lambda {{ |i| d = GameData::Item.try_get(i); next nil unless d
  [d.name, d.price, d.is_vitamin?, d.is_healing_item?, d.is_stat_boost_item?, d.is_berry?,
   RandomizedChallenge.excluded_item?(d), RandomizedChallenge.unrandomizable_item?(i)] }}
watched = {list(STATS_ITEMS)!r}
shops = {{}}; bags = {{}}; maxed = []
load_data("Data/MapInfos.rxdata").keys.sort.each do |mid|
  m = load_data(sprintf("Data/Map%03d.rxdata", mid)) rescue next
  m.events.each do |eid, ev|
    ev.pages.each do |pg|
      blocks = []
      pg.list.each {{ |c| blocks << "" if c.code == 355; blocks[-1] += c.parameters[0].to_s + "\\n" if [355, 655].include?(c.code) && !blocks.empty? }}
      blocks.each do |s|
        key = "#{{mid}}/#{{eid}}"
        sold = s.scan(/:(\\w+)/).flatten & watched
        shops[key] = sold if s =~ /pbPokemonMart|pbBattlePointShop/ && !sold.empty?
        (bags[key] ||= []).concat(s.scan(/PunchBag\\.play_proportional_ev\\(\\d+, :(\\w+)\\)/).flatten) if s.include?("PunchBag")
        maxed << key if s.include?("ivMaxed")
      end
    end
  end
end
{{ "settings" => {list(STATS_SETTINGS)!r}.to_h {{ |n| [n, Settings.const_get(n)] }},
  "limits" => {list(STATS_LIMITS)!r}.to_h {{ |n| [n, Pokemon.const_get(n)] }},
  "no_grinding" => $game_switches[{NO_GRINDING_SWITCH}],
  "charms" => PluginManager.installed?({CHARMS_PLUGIN!r}),
  "pokerus" => Settings::POKERUS_CHANCE,
  "items" => watched.to_h {{ |i| [i, item.call(i.to_sym)] }},
  "absent" => {list(STATS_ABSENT)!r}.to_h {{ |i| [i, !GameData::Item.exists?(i.to_sym)] }},
  "shops" => shops, "punch_bag" => bags, "iv_maxed" => maxed,
  "starters" => {list(STARTER_VARIABLES)!r}.map {{ |v| p = $game_variables[v]; [p.species.to_s, p.iv.values, p.ev.values] }} }}
"""
STATS_PRELUDE = """
msgs = []
sc = Object.new
sc.define_singleton_method(:pbDisplay) { |m| msgs << m }
sc.define_singleton_method(:pbRefresh) { }
use = lambda { |item, pk, qty| msgs.clear; [ItemHandlers.triggerUseOnPokemon(item, qty, pk, sc), msgs.dup] }
most = lambda { |item, pk| ItemHandlers.triggerUseOnPokemonMaximum(item, pk) }
fresh = lambda { pk = Pokemon.new(:SPECIES, LEVEL); GameData::Stat.each_main { |s| pk.iv[s.id] = LOW_IV; pk.ev[s.id] = 0 }
  pk.calc_stats; pk }
"""
STATS_USES = """
RandomizedChallenge.pause_random_species
begin
  out = {}
  pk = fresh.call
  out["chapa_most"] = most.call(:CHAPA, pk)
  out["chapa"] = (1..4).map { a = use.call(:CHAPA, pk, 1); [a[0], pk.iv[:CHAPA_STAT], pk.attack, a[1][0]] }
  out["raise"] = EV_ITEMS.to_h do |i|
    pk = fresh.call; m = most.call(i, pk); a = use.call(i, pk, 1); first = pk.ev.values
    use.call(i, pk, m - 1); full = pk.ev.values; b = use.call(i, pk, 1)
    [i.to_s, [m, a[0], a[1][0], first, full, b[0], b[1][0]]]
  end
  pk = fresh.call; pk.ev[:HP] = BERRY_EV; pk.happiness = BERRY_HAPPINESS
  out["berry"] = (1..3).map { a = use.call(:BERRY, pk, 1); [a[0], pk.ev[:HP], pk.happiness, a[1][0]] }
  pk = fresh.call; pk.ev[:HP] = 100; pk.ev[:SPEED] = 60
  a = use.call(:RESET, pk, 1); out["reset"] = [a[0], pk.ev.values, a[1][0]]
  pk = fresh.call; GameData::Stat.each_main { |s| pk.ev[s.id] = NEAR_FULL }; pk.ev[:HP] = NEAR_FULL - 5
  a = use.call(:HPUP, pk, 3); out["total"] = [a[0], pk.ev.values.sum, pk.ev[:HP]]
  out["species"] = pk.species.to_s
  y = lambda { |i| h = Pokemon.new(:SPECIES, LEVEL).evYield; Battle::ItemEffects.triggerEVGainModifier(i, nil, h) if i; h.values }
  out["yield"] = ([nil] + YIELD_ITEMS).map { |i| [i.to_s, y.call(i)] }
  out
ensure
  RandomizedChallenge.resume_random_species
end
"""
STATS_SPECIES = TEST_SPECIES
STATS_LEVEL = 50
STATS_LOW_IV = 5
STATS_CHAPA = "ACapsula"
STATS_CHAPA_GAIN = 10
STATS_EV_ITEMS = {"HPUP": 10, "HEALTHMOCHI": 50, "MUSCLEMOCHI": 50, "HEALTHFEATHER": 1}
STATS_BERRY = "POMEGBERRY"
STATS_BERRY_EV = 25
STATS_BERRY_HAPPINESS = 70
STATS_NEAR_FULL = 85
STATS_YIELD_ITEMS = ("POWERWEIGHT", "POWERANKLET", "MACHOBRACE")
STATS_POWER_GAIN = 8
STATS_SAMPLE = """
t = Array.new(32, 0); evs = 0
COUNT.times { pk = MAKE; pk.iv.each_value { |v| t[v] += 1 }; evs += pk.ev.values.sum }
[t, evs]
"""
STATS_MAKE = {
    "wild": "pbGenerateWildPokemon(:SPECIES, LEVEL)",
    "gift": "Pokemon.new(:SPECIES, LEVEL)",
}
STATS_SAMPLE_SIZE = 3000
STATS_SIGMAS = 4
STATS_TRAINER_EVERY = 25
STATS_TRAINERS = """
pick = GameData::Trainer.keys.select.with_index { |_, i| i % EVERY == 0 }
pick.flat_map do |k|
  d = GameData::Trainer.get(*k); t = pbLoadTrainer(*k); next [] unless t
  t.party.each_with_index.map do |pk, i|
    pd = d.pokemon[i] || {}
    stone = pd[:item] && GameData::Item.try_get(pd[:item])&.is_mega_stone?
    [k[0].to_s, pd[:level], pk.level, pd[:iv] ? pd[:iv].values.uniq : nil, pk.iv.values, pk.ev.values, stone ? true : false]
  end
end
"""
STATS_TRAINER_PBS = (
    "tp = GameData::Trainer.keys.flat_map { |k| GameData::Trainer.get(*k).pokemon }; "
    "[tp.size, tp.count { |p| p[:iv] }, tp.count { |p| p[:ev] }, "
    "tp.count { |p| p[:iv] && p[:iv].values.uniq.size == 1 }]"
)
SUMMARY_HOOK = """
$anil_check_texts = []
Object.send(:alias_method, :anil_check_draw_texts, :pbDrawTextPositions)
Object.send(:define_method, :pbDrawTextPositions) { |bitmap, textpos| $anil_check_texts << textpos.map { |t| t[0] }; anil_check_draw_texts(bitmap, textpos) }
Object.send(:private, :pbDrawTextPositions)
x = $game_variables[VARIABLE]; $player.party.replace([x]); [x.species.to_s, x.ev.values, x.iv.values]
"""
SUMMARY_UNHOOK = (
    "Object.send(:alias_method, :pbDrawTextPositions, :anil_check_draw_texts); "
    "Object.send(:remove_method, :anil_check_draw_texts); $anil_check_texts = nil; true"
)
SUMMARY_OPEN = (
    "pbFadeOutIn { s = PokemonSummary_Scene.new; "
    "PokemonSummaryScreen.new(s).pbStartScreen($player.party, 0) }"
)
SUMMARY_PAGE = (
    "ObjectSpace.each_object(PokemonSummary_Scene).map { |x| x.instance_variable_get(:@page_id) }"
    ".compact.last.to_s"
)
SUMMARY_TEXTS = "$anil_check_texts.last || []"
SUMMARY_TARGET = "page_allstats"
SUMMARY_LABELS = ("PS", "Ataque", "Defensa", "At. Esp.", "Def. Esp.", "Velocidad")
SUMMARY_OPEN_TICKS = 60
SUMMARY_PAGE_TICKS = 30
SUMMARY_PAGES = 6


def check_ivs_evs(live: Live, result: CheckResult) -> None:
    data = eval_data(live, STATS_DATA)
    for name, expected in STATS_SETTINGS.items():
        result.expect(f"Settings::{name}", data["settings"].get(name), expected)
    for name, expected in STATS_LIMITS.items():
        result.expect(f"Pokemon::{name}", data["limits"].get(name), expected)
    result.expect(f"switch {NO_GRINDING_SWITCH} (Sin Grindeo)", data["no_grinding"], False)
    result.expect(f"{CHARMS_PLUGIN} installed", data["charms"], False)
    result.note(f"Settings::POKERUS_CHANCE {data['pokerus']} in 65536")
    stats_items(result, data)
    stats_maps(result, data)
    for species, ivs, evs in data["starters"]:
        result.note(f"starter {species}: IVs {ivs}, EVs {evs}")
        result.mark(all(0 <= iv <= 31 for iv in ivs) and not any(evs), f"starter {species} fresh")
    stats_uses(live, result)
    stats_samples(live, result)
    stats_trainers(live, result)
    session = live.session
    name = f"{STATS_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        stats_summary(live, result)
    finally:
        restore_snapshot(session, name)


def stats_items(result: CheckResult, data: dict[str, Any]) -> None:
    items = data["items"]
    for item in STATS_ITEMS:
        facts = items.get(item)
        if not result.mark(facts is not None, f"{item} exists"):
            continue
        name, price, vitamin, healing, boost, berry, excluded, kept = facts
        result.note(
            f"{item} {name!r}: price {price}, vitamin {vitamin}, healing {healing}, "
            f"battle item {boost}, berry {berry}, in the random pool {not excluded and not kept}"
        )
        result.expect(f"{item} vitamin flag", vitamin, item in VITAMINS or item in FEATHERS)
        result.expect(f"{item} not a healing or battle item", [healing, boost], [False, False])
        result.expect(f"{item} in the random item pool", not excluded and not kept, True)
    result.expect("items that do not exist", data["absent"], dict.fromkeys(STATS_ABSENT, True))


def stats_maps(result: CheckResult, data: dict[str, Any]) -> None:
    result.expect("shops selling IV or EV items (map/event)", data["shops"], STATS_SHOPS)
    bags = {key: sorted(stats) for key, stats in data["punch_bag"].items()}
    result.expect(
        "punch-bag EV training (map/event)",
        bags,
        {key: sorted(stats) for key, stats in PUNCH_BAG_EVENTS.items()},
    )
    result.expect("events setting ivMaxed (Hyper Training)", data["iv_maxed"], [])


def stats_uses(live: Live, result: CheckResult) -> None:
    source = ruby(
        STATS_PRELUDE + STATS_USES,
        SPECIES=STATS_SPECIES,
        LEVEL=STATS_LEVEL,
        LOW_IV=STATS_LOW_IV,
        CHAPA_STAT=STAT_NAMES[1],
        CHAPA=STATS_CHAPA,
        EV_ITEMS="[" + ", ".join(f":{item}" for item in STATS_EV_ITEMS) + "]",
        BERRY_EV=STATS_BERRY_EV,
        BERRY_HAPPINESS=STATS_BERRY_HAPPINESS,
        BERRY=STATS_BERRY,
        RESET=RESET_MOCHI,
        NEAR_FULL=STATS_NEAR_FULL,
        YIELD_ITEMS="[" + ", ".join(f":{item}" for item in STATS_YIELD_ITEMS) + "]",
    )
    out = eval_data(live, source)
    result.expect("species with random species paused", out["species"], STATS_SPECIES)
    ivs = [STATS_LOW_IV + STATS_CHAPA_GAIN * n for n in range(1, 4)]
    expected_ivs = [min(iv, STATS_LIMITS["IV_STAT_LIMIT"]) for iv in ivs]
    chapa = out["chapa"]
    for step in chapa:
        result.note(f"{STATS_CHAPA}: used {step[0]}, IV {step[1]}, Attack {step[2]}, {step[3]!r}")
    result.expect(f"{STATS_CHAPA} uses allowed from IV {STATS_LOW_IV}", out["chapa_most"], 3)
    result.expect(
        f"{STATS_CHAPA} Attack IV after each use", [step[1] for step in chapa], [*expected_ivs, 31]
    )
    result.expect(f"{STATS_CHAPA} used", [step[0] for step in chapa], [True, True, True, False])
    cap = STATS_LIMITS["EV_STAT_LIMIT"]
    for item, gain in STATS_EV_ITEMS.items():
        most, used, said, first, full, again, refusal = out["raise"][item]
        stat = 1 if item.startswith("MUSCLE") else 0
        result.note(f"{item}: {said!r}; at the cap: {refusal!r}")
        result.expect(f"{item} uses allowed from 0", most, -(-cap // gain))
        result.expect(f"{item} first use", [used, first[stat]], [True, gain])
        result.expect(f"{item} after every allowed use", full[stat], cap)
        result.expect(f"{item} at {cap}", again, False)
    berry = out["berry"]
    for step in berry:
        result.note(
            f"{STATS_BERRY}: used {step[0]}, HP EV {step[1]}, happiness {step[2]}, {step[3]!r}"
        )
    result.expect(f"{STATS_BERRY} HP EV after each use", [step[1] for step in berry], [15, 5, 0])
    result.mark(berry[0][2] > STATS_BERRY_HAPPINESS, f"{STATS_BERRY} raised happiness")
    used, evs, said = out["reset"]
    result.note(f"{RESET_MOCHI}: {said!r}")
    result.expect(f"{RESET_MOCHI} EVs after use", [used, evs], [True, [0] * 6])
    used, total, hp = out["total"]
    result.expect("HPUP at 505 total EVs", [used, total, hp], [True, 510, STATS_NEAR_FULL])
    yields = dict(out["yield"])
    base = yields[""]
    result.note(f"{STATS_SPECIES} EV yield {base}")
    weight = list(base)
    weight[0] += STATS_POWER_GAIN
    anklet = list(base)
    anklet[5] += STATS_POWER_GAIN
    result.expect("POWERWEIGHT yield", yields["POWERWEIGHT"], weight)
    result.expect("POWERANKLET yield", yields["POWERANKLET"], anklet)
    result.expect("MACHOBRACE yield", yields["MACHOBRACE"], [value * 2 for value in base])


def stats_samples(live: Live, result: CheckResult) -> None:
    expected = STATS_SAMPLE_SIZE * len(STAT_NAMES) / 32
    spread = STATS_SIGMAS * (expected * (1 - 1 / 32)) ** 0.5
    for kind, make in STATS_MAKE.items():
        source = ruby(
            STATS_SAMPLE.replace("MAKE", make),
            COUNT=STATS_SAMPLE_SIZE,
            SPECIES=STATS_SPECIES,
            LEVEL=5,
        )
        counts, evs = eval_data(live, source)
        mean = sum(value * count for value, count in enumerate(counts)) / sum(counts)
        result.note(
            f"{kind}: {STATS_SAMPLE_SIZE} Pokémon, IV counts per value {min(counts)}–{max(counts)} "
            f"({expected:.0f} expected), mean IV {mean:.2f}"
        )
        result.mark(
            all(abs(count - expected) <= spread for count in counts),
            f"{kind} IVs uniform over 0–31 within {STATS_SIGMAS} sigma ({spread:.0f})",
        )
        result.expect(f"{kind} EVs", evs, 0)


def stats_trainers(live: Live, result: CheckResult) -> None:
    total, with_iv, with_ev, uniform = eval_data(live, STATS_TRAINER_PBS)
    result.note(
        f"{total} PBS trainer Pokémon: {with_iv} set IVs ({uniform} the same in every stat), "
        f"{with_ev} set EVs"
    )
    rows = eval_data(live, ruby(STATS_TRAINERS, EVERY=STATS_TRAINER_EVERY))
    ruled = 0
    lowered = 0
    for trainer, level, now, set_iv, ivs, evs, stone in rows:
        wanted_iv = set_iv or [min(level // 2, 31)]
        wanted_ev = [min(level * 3 // 2, STATS_LIMITS["EV_LIMIT"] // 6)]
        if sorted(set(ivs)) == wanted_iv and sorted(set(evs)) == wanted_ev:
            ruled += 1
            lowered += now < level
            continue
        result.note(
            f"{trainer}: PBS level {level}, level {now}, IVs {ivs}, EVs {evs}, "
            f"PBS Mega Stone {stone}"
        )
        result.mark(stone and not any(evs), f"{trainer} rebuilt Mega Stone holder")
    result.note(
        f"{ruled} of {len(rows)} trainer Pokémon: IVs as the PBS or PBS level / 2, "
        "EVs PBS level × 1.5 up to 85"
    )
    result.note(
        f"{lowered} of them brought down to the level cap, with IVs and EVs of the PBS level"
    )


def stats_summary(live: Live, result: CheckResult) -> None:
    species, evs, ivs = eval_data(live, ruby(SUMMARY_HOOK, VARIABLE=STARTER_VARIABLES[0]))
    try:
        run_script(live, SUMMARY_OPEN)
        live.driver.advance(SUMMARY_OPEN_TICKS)
        page = ""
        for _ in range(SUMMARY_PAGES):
            page = eval_data(live, SUMMARY_PAGE)
            if page == SUMMARY_TARGET:
                break
            press(live, "RIGHT")
            live.driver.advance(SUMMARY_PAGE_TICKS)
        if not result.expect("summary page", page, SUMMARY_TARGET):
            return
        texts = eval_data(live, SUMMARY_TEXTS)
        result.note(f"summary of {species}: {texts}")
        pairs = [f"{ev}/{iv}" for ev, iv in zip(evs, ivs, strict=True)]
        shown = [texts[texts.index(label) + 1] for label in SUMMARY_LABELS if label in texts]
        result.expect("EV/IV pairs shown", shown, pairs)
        result.note(f"screenshot {live.session.shot().value}")
        press(live, "B")
        wait_script_done(live)
    finally:
        eval_inspect(live.session, SUMMARY_UNHOOK)


SHOWDOWN_SNAPSHOT_PREFIX = "check-showdown-"
SHOWDOWN_PARTY = """
mk = lambda do |species, form, nick, gender, item, ability, nature, ivs, moves|
  p = Pokemon.new(species, 30, $player, false, true, false)
  p.form_simple = form
  p.name = nick if nick
  p.gender = gender if gender
  p.item = item
  p.ability = ability
  p.nature = nature
  GameData::Stat.each_main { |s| p.iv[s.id] = ivs[s.id] || 31 }
  p.moves.clear
  moves.each { |m| p.learn_move(m) }
  p.calc_stats
  p
end
egg = Pokemon.new(:PICHU, 1, $player, false, true, false)
egg.steps_to_hatch = 5000
unown = mk.call(:UNOWN, 26, nil, nil, :POKEBALL, :LEVITATE, :HARDY, {}, [:HIDDENPOWER])
unown.ivMaxed[:ATTACK] = true
unown.iv[:ATTACK] = 3
unown.nature_for_stats = :BOLD
$player.party.replace([
  mk.call(:ROTOM, 2, "Lavadora", nil, :LEFTOVERS, :LEVITATE, :MODEST, { ATTACK: 0, SPEED: 30 },
          [:THUNDERBOLT, :HYDROPUMP, :VOLTSWITCH, :PAINSPLIT]),
  mk.call(:NIDORANfE, 0, nil, 1, nil, :POISONPOINT, :JOLLY, {}, [:POISONSTING, :SCRATCH]),
  egg,
  mk.call(:FARFETCHD, 0, "Puerro", 0, :LEEK, :INNERFOCUS, :ADAMANT,
          { HP: 12, DEFENSE: 7, SPECIAL_ATTACK: 0 }, [:LEAFBLADE, :BRAVEBIRD, :SWORDSDANCE, :KNOCKOFF]),
  mk.call(:BASCULIN, 3, nil, 1, :KINGSROCK, :ROCKHEAD, :TIMID, { SPECIAL_DEFENSE: 25 }, [:AQUAJET, :WAVECRASH]),
  unown
])
$player.party.map { |p| [p.species.to_s, p.form, p.level, p.egg?] }
"""
SHOWDOWN_EVS = "EVs: 1 HP / 1 Atk / 1 Def / 1 SpA / 1 SpD / 1 Spe"
SHOWDOWN_ROTOM = f"""Lavadora (Rotom-Wash) @ Leftovers
Ability: Levitate
Level: 50
{SHOWDOWN_EVS}
Modest Nature
IVs: 0 Atk / 30 Spe
- Thunderbolt
- Hydro Pump
- Volt Switch
- Pain Split

"""
SHOWDOWN_NIDORAN = f"""Nidoran-F (F)
Ability: Poison Point
Level: 50
{SHOWDOWN_EVS}
Jolly Nature
- Poison Sting
- Scratch

"""
SHOWDOWN_REST = f"""Puerro (Farfetch’d) (M) @ Leek
Ability: Inner Focus
Level: 50
{SHOWDOWN_EVS}
Adamant Nature
IVs: 12 HP / 7 Def / 0 SpA
- Leaf Blade
- Brave Bird
- Swords Dance
- Knock Off

Basculin-Blue-Striped (F) @ King’s Rock
Ability: Rock Head
Level: 50
{SHOWDOWN_EVS}
Timid Nature
IVs: 25 SpD
- Aqua Jet
- Wave Crash

Unown-Question @ Poke Ball
Ability: Levitate
Level: 50
{SHOWDOWN_EVS}
Bold Nature
- Hidden Power
"""
SHOWDOWN_EXPECTED = SHOWDOWN_ROTOM + SHOWDOWN_NIDORAN + SHOWDOWN_REST
SHOWDOWN_EXPECTED_DEAD = SHOWDOWN_ROTOM + SHOWDOWN_REST
SHOWDOWN_TOGGLED = "ChallengeModes.class_variable_get(:@@started)"
SHOWDOWN_BEGIN = (
    "ChallengeModes.begin_challenge unless ChallengeModes.on?; ChallengeModes.on?(:PERMAFAINT)"
)
SHOWDOWN_KILL = "$player.party[1].hp = 0; $player.party[1].perma_faint"
SHOWDOWN_TOGGLE = "ChallengeModes.toggle({toggled}); {toggled}"
SHOWDOWN_UNNAMED = (
    "$player.party.replace([Pokemon.new(:ARCEUS, 50, $player, false, true, false)]); "
    "$player.party[0].form_simple = 9; $player.party[0].form"
)
SHOWDOWN_UNNAMED_ERROR = "especie ARCEUS_9"
SHOWDOWN_CLIPBOARD_MARK = "anil check showdown"
SHOWDOWN_SET_CLIPBOARD = "Input.clipboard = {text!r}; true"
SHOWDOWN_GAME_CLIPBOARD = "AnilJSON.encode(Input.clipboard)"
SHOWDOWN_WINDOWS_CLIPBOARD = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard -Raw"
CLIPBOARD_READS = 5
CLIPBOARD_RETRY_SECONDS = 0.2
PAUSE_MENU_FRAME = "[PauseMenuDP] Script.rb"
MESSAGE_FRAME = "pbMessageDisplay"
SHOWDOWN_KEY = "ACTION"
SHOWDOWN_MESSAGE_PRESSES = 6
PAUSE_MENU_TRIES = 3
PAUSE_MENU_WAIT_TICKS = 60


def open_pause_menu(live: Live) -> int | None:
    for attempt in range(1, PAUSE_MENU_TRIES + 1):
        press(live, "B")
        for _ in range(PAUSE_MENU_WAIT_TICKS // WINDOW_STEP_TICKS):
            if any(PAUSE_MENU_FRAME in frame for frame in live.session.stack().value.frames):
                return attempt
            live.driver.advance(WINDOW_STEP_TICKS)
    return None


def frames_without(live: Live, unwanted: str, button: str, presses: int) -> bool:
    for _ in range(presses):
        if not any(unwanted in frame for frame in live.session.stack().value.frames):
            return True
        press(live, button)
        live.driver.advance(WINDOW_STEP_TICKS)
    return not any(unwanted in frame for frame in live.session.stack().value.frames)


def game_clipboard(live: Live) -> str:
    text = eval_inspect(live.session, SHOWDOWN_GAME_CLIPBOARD)
    return json.loads(json.loads(text.replace("\\#", "#")))


def windows_clipboard() -> str:
    text = ""
    for _ in range(CLIPBOARD_READS):
        text = run_windows("powershell.exe", "-NoProfile", "-Command", SHOWDOWN_WINDOWS_CLIPBOARD)
        if text:
            break
        time.sleep(CLIPBOARD_RETRY_SECONDS)
    return text


def check_showdown(live: Live, result: CheckResult) -> None:
    session = live.session
    name = f"{SHOWDOWN_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    toggled = eval_data(live, SHOWDOWN_TOGGLED) is True
    result.note(f"saved {name}; restored once the check is done")
    try:
        result.note(f"known party: {eval_data(live, SHOWDOWN_PARTY)}")
        result.expect("the export of the known party", export_party(session), SHOWDOWN_EXPECTED)
        result.expect("challenge on with PERMAFAINT", eval_data(live, SHOWDOWN_BEGIN), True)
        result.expect("Nidoran-F at 0 HP is permafainted", eval_data(live, SHOWDOWN_KILL), True)
        result.expect(
            "the export with a dead member", export_party(session), SHOWDOWN_EXPECTED_DEAD
        )
        eval_inspect(session, SHOWDOWN_SET_CLIPBOARD.format(text=SHOWDOWN_CLIPBOARD_MARK))
        result.expect("Windows clipboard before", windows_clipboard(), SHOWDOWN_CLIPBOARD_MARK)
        attempt = open_pause_menu(live)
        if not result.mark(attempt is not None, f"pause menu opened by B (press {attempt})"):
            return
        result.note(f"pause menu screenshot {session.shot().value}")
        press(live, SHOWDOWN_KEY)
        if not result.mark(wait_frame(live, MESSAGE_FRAME), "message shown after Z (ACTION)"):
            return
        result.note(f"message screenshot {session.shot().value}")
        copied = game_clipboard(live)
        result.expect(
            "game clipboard after Z", copied.replace("\r\n", "\n"), SHOWDOWN_EXPECTED_DEAD
        )
        result.expect(
            "Windows clipboard after Z", windows_clipboard(), SHOWDOWN_EXPECTED_DEAD.strip()
        )
        result.mark(
            frames_without(live, MESSAGE_FRAME, "USE", SHOWDOWN_MESSAGE_PRESSES), "message closed"
        )
        result.mark(frames_without(live, PAUSE_MENU_FRAME, "B", 1), "pause menu closed by B")
        result.note(f"Arceus form: {eval_inspect(session, SHOWDOWN_UNNAMED)}")
        try:
            refused = export_party(session)
        except InvestigateError as error:
            refused = str(error)
        result.mark(
            SHOWDOWN_UNNAMED_ERROR in refused,
            f"export of a form with no Showdown name refused: {refused}",
        )
    finally:
        restore_snapshot(session, name)
        back = eval_inspect(session, SHOWDOWN_TOGGLE.format(toggled=str(toggled).lower()))
        result.note(f"ChallengeModes@@started back to {back}")


EGG_COUNT = 16
EGG_STEPS = 100
EGG_LEVEL = 1
EGG_PLACEHOLDER = "TOGEPI"
EGG_BOX_NAME = "Huevos"
EGG_LOG_LINE = f"randomlocke eggs given: {EGG_COUNT} in box"
EGG_SNAPSHOT_PREFIX = "check-egg-hatch-"
EGG_FIELDS = (
    ("species", ".species_data.id"),
    ("egg", ".egg?"),
    ("steps", ".steps_to_hatch"),
    ("level", ".level"),
    ("name", ".name"),
    ("mod", "@randomlocke_egg"),
)
EGG_BOX_PATHS: Paths = [
    ("boxes", "$PokemonStorage.maxBoxes"),
    ("party", "$player.party.length"),
]
EGG_BRIEF = (
    "egg_of = lambda { |p| [p.species_data.id.to_s, p.egg?, p.steps_to_hatch, p.level, p.name, "
    "p.instance_variable_get(:@randomlocke_egg)] }\n"
)
SAVED_EGGS_SOURCE = (
    EGG_BRIEF + "d = File.open(SaveData.get_full_path($player.save_slot), 'rb') "
    "{ |f| Marshal.load(f) }; s = d[:storage_system]; b = s.maxBoxes - 1\n"
    "{ 'name' => s.boxes[b].name, 'slots' => s.boxes[b].pokemon.map { |p| p && egg_of.call(p) }, "
    "'shiny' => s.boxes[b].pokemon.compact.count(&:shiny?) }"
)
EGG_TO_PARTY = (
    "s = $PokemonStorage; b = s.maxBoxes - 1; $anil_check_egg = s[b, {slot}]; s[b, {slot}] = nil; "
    "$player.party << $anil_check_egg; $player.party.length"
)
EGG_BADGES = "$player.badges.fill(false); {count}.times {{ |i| $player.badges[i] = true }}; $player.badge_count"
EGG_MEMBER = (
    EGG_BRIEF + "p = $anil_check_egg; d = p.species_data; n = $player.badge_count\n"
    "{ 'brief' => egg_of.call(p), 'in_party' => $player.party.any? { |m| m.equal?(p) }, "
    "'hatched_map' => p.hatched_map, 'obtain_method' => p.obtain_method, "
    "'encs' => $PokemonGlobal.challenge_encs.keys, 'badges' => n, "
    "'bst' => d.base_stats.values.sum, 'window' => [min_bst_cap(n), max_bst_cap(n)], "
    "'valid' => valid_pokemon?(d.id, false, n), "
    "'moves' => p.moves.map { |m| [m.id.to_s, GameData::Move.get(m.id).display_power(p)] }, "
    "'boxed_steps' => $PokemonStorage.boxes[$PokemonStorage.maxBoxes - 1].pokemon.compact"
    ".map(&:steps_to_hatch).uniq }"
)
EGG_DAMAGING_POWER = 10
EGG_DRAWN_LOG_LINE = "randomlocke egg drawn: {species} at {badges} badges"
EGG_HATCHES = ((0, 0, "Yema"), (7, 1, "Clara"))
EGG_DIRECTIONS = (("LEFT", "RIGHT"), ("UP", "DOWN"))
EGG_HATCH_STEPS = 1200


def egg_brief(raw: list[Any]) -> dict[str, Any]:
    return dict(zip((name for name, _ in EGG_FIELDS), raw, strict=True))


def boxed_eggs(slots: list[Any]) -> list[dict[str, Any]]:
    return [egg_brief(slot) for slot in slots if slot is not None]


def read_egg_box(live: Live, result: CheckResult, box: int) -> dict[str, Any]:
    size = read_checked(live, result, [("size", f"$PokemonStorage.maxPokemon({box})")]).get("size")
    paths: Paths = [("name", f"$PokemonStorage.boxes[{box}].name")]
    for slot in range(size if isinstance(size, int) else 0):
        paths.extend(
            (f"{slot}.{name}", f"$PokemonStorage[{box}, {slot}]{suffix}")
            for name, suffix in EGG_FIELDS
        )
    values = read_checked(live, result, paths)
    slots = [
        [values.get(f"{slot}.{name}") for name, _ in EGG_FIELDS]
        for slot in range(size if isinstance(size, int) else 0)
    ]
    return {
        "name": values.get("name"),
        "slots": [slot if slot[0] is not None else None for slot in slots],
    }


def check_eggs(live: Live, result: CheckResult) -> None:
    counts = read_checked(live, result, EGG_BOX_PATHS)
    boxes = counts.get("boxes")
    if not isinstance(boxes, int):
        result.mark(False, f"$PokemonStorage.maxBoxes: {boxes!r}")
        return
    box = boxes - 1
    state = read_egg_box(live, result, box)
    result.expect(f"box {boxes} name", state["name"], EGG_BOX_NAME)
    eggs = boxed_eggs(state["slots"])
    result.expect(f"Pokémon in box {boxes}", len(eggs), EGG_COUNT)
    result.expect(
        f"box {boxes} slots filled",
        [slot is not None for slot in state["slots"][:EGG_COUNT]],
        [True] * EGG_COUNT,
    )
    result.expect("party size", counts.get("party"), 0)
    for index, egg in enumerate(eggs):
        result.mark(egg["egg"], f"slot {index} is an egg")
        result.expect(f"slot {index} steps", egg["steps"], EGG_STEPS)
        result.expect(f"slot {index} level", egg["level"], EGG_LEVEL)
    result.expect(
        "placeholder species", sorted({egg["species"] for egg in eggs}), [EGG_PLACEHOLDER]
    )
    result.expect("marked as the mod's eggs", [egg["mod"] for egg in eggs], [True] * len(eggs))
    result.expect("challenge encounters", live.value(result, "challenge_encs"), {})
    setup_log_line(live, result, EGG_LOG_LINE)
    slot = live.value(result, "save_slot")
    if live.launch.snapshot is not None or not isinstance(slot, str):
        result.note("the save is read by a check from a fresh new game only")
        return
    saved = eval_data(live, SAVED_EGGS_SOURCE)
    result.expect(f"box {boxes} name in {slot}", saved["name"], EGG_BOX_NAME)
    result.expect(f"eggs in {slot}", boxed_eggs(saved["slots"]), eggs)
    result.note(f"shiny in {slot}: {saved['shiny']} of {len(eggs)}")


def step_direction(live: Live) -> tuple[str, str] | None:
    for there, back in EGG_DIRECTIONS:
        for direction, opposite in ((there, back), (back, there)):
            try:
                live.driver.walk(direction, 1)
            except DriveError:
                continue
            return opposite, direction
    return None


def walk_steps(live: Live, directions: tuple[str, str], steps: int) -> None:
    for step in range(steps):
        live.driver.walk(directions[step % 2], 1)


def check_egg_hatch(live: Live, result: CheckResult) -> None:
    session = live.session
    name = f"{EGG_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        hatch_egg(live, result)
    finally:
        restore_snapshot(session, name)


def hatch_egg(live: Live, result: CheckResult) -> None:
    run_script(live, f"$bag.add(:{FIRST_BALL})", until_payload=True)
    drive_dialog(live, result, [])
    if not challenge_on(live, result, [NICKNAME_RULE, *ENCOUNTER_RULES]):
        return
    transfer(live, CATCH_SPOT.map_id, CATCH_SPOT.tile, CATCH_SPOT.direction)
    map_id = read_checked(live, result, [("map", "$game_map.map_id")]).get("map")
    result.expect("map", map_id, CATCH_SPOT.map_id)
    result.expect(f"map {map_id} marked before", marked(live, result, CATCH_SPOT.map_id), None)
    for party, (badges, slot, nickname) in enumerate(EGG_HATCHES, start=1):
        if not hatch_one(live, result, party, badges, slot, nickname):
            return


def hatch_one(
    live: Live, result: CheckResult, party: int, badges: int, slot: int, nickname: str
) -> bool:
    session = live.session
    label = f"egg {slot} at {badges} badges"
    count = eval_inspect(session, EGG_BADGES.format(count=badges))
    result.expect(f"{label}: badge count", count, str(badges))
    moved = eval_inspect(session, EGG_TO_PARTY.format(slot=slot))
    result.expect(f"{label}: party size with the egg", moved, str(party))
    egg = egg_brief(eval_data(live, EGG_MEMBER)["brief"])
    result.note(f"{label}: {egg['species']} moved to the party, {egg['steps']} steps")
    directions = step_direction(live)
    if directions is None:
        result.mark(False, f"{label}: a free tile to walk to and back")
        return False
    walk_steps(live, directions, EGG_STEPS - 2)
    almost = egg_brief(eval_data(live, EGG_MEMBER)["brief"])
    result.expect(f"{label}: after {EGG_STEPS - 1} steps: egg", almost["egg"], True)
    result.expect(f"{label}: after {EGG_STEPS - 1} steps: steps left", almost["steps"], 1)
    live.driver.walk(directions[(EGG_STEPS - 2) % 2], 1)
    result.note(f"{label}: step {EGG_STEPS} taken at tick {session.rng().tick}")
    opened = reached(
        live, result, at_naming, f"{label}: the hatch opened the name screen", EGG_HATCH_STEPS
    )
    if opened is None:
        return False
    enter_name(live, nickname)
    if reached(live, result, at_idle, f"{label}: back to the overworld") is None:
        return False
    after = eval_data(live, EGG_MEMBER)
    hatched = egg_brief(after["brief"])
    species = hatched["species"]
    low, high = after["window"]
    result.expect(f"{label}: in the party", after["in_party"], True)
    result.expect(f"{label}: egg", hatched["egg"], False)
    result.expect(f"{label}: mod mark", hatched["mod"], None)
    result.mark(species in ALLOWED_SPECIES, f"{label}: {species} in the allow-list")
    result.mark(
        low <= after["bst"] <= high,
        f"{label}: {species} BST {after['bst']} within the window {low}-{high}",
    )
    result.expect(f"{label}: valid_pokemon? at {badges} badges", after["valid"], True)
    result.expect(f"{label}: level", hatched["level"], EGG_LEVEL)
    moves = after["moves"]
    result.mark(
        any(power > EGG_DAMAGING_POWER for _, power in moves),
        f"{label}: a move above power {EGG_DAMAGING_POWER} in {moves}",
    )
    result.expect(f"{label}: nickname", hatched["name"], nickname)
    result.expect(f"{label}: hatched_map", after["hatched_map"], CATCH_SPOT.map_id)
    result.expect(f"{label}: obtain_method", after["obtain_method"], 1)
    lines = bridge_log_lines(session.session_dir)
    wanted = EGG_DRAWN_LOG_LINE.format(species=species, badges=badges)
    result.mark(any(wanted in line for line in lines), f"bridge.log has {wanted!r}")
    unmarked = marked(live, result, CATCH_SPOT.map_id)
    result.expect(f"{label}: map {CATCH_SPOT.map_id} marked after", unmarked, None)
    result.expect(f"{label}: challenge encounters after", after["encs"], [])
    result.expect(f"{label}: steps of the eggs left in the box", after["boxed_steps"], [EGG_STEPS])
    return True


type LiveCheck = Callable[[Live, CheckResult], None]

CALC_MOVES_RULES = """
{ "levels" => RandomizedChallenge::BADGES_MAX_LEVELS.sort.map(&:last), "early" => MoveRandomizer::EARLY_GAME_BADGES,
  "threshold" => MoveRandomizer::POWER_THRESHOLD, "blacklist" => RandomizedChallenge::MOVEBLACKLIST,
  "progressive" => RandomizedChallenge.progressive?, "ohko_banned" => RandomizedChallenge.ohko_banned?,
  "trainer_progressive" => RandomizedChallenge::TRAINERS_MOVESET_RESPECT_PROGRESSIVE,
  "rerandom" => RandomizedChallenge::RERANDOM_TRAINER_MOVESET,
  "powers" => GameData::Move.keys.map { |m| d = GameData::Move.get(m); [d.id, d.display_max_power(true), d.display_max_power(false), d.ohko?] } }
"""
CALC_MOVES_TRAINERS = """
badged.call(BADGES) { KEYS.map { |k| k = [k[0].to_sym, k[1], k[2]]; d = GameData::Trainer.get(*k)
  stored = ($PokemonGlobal.random_trainer_teams || {}).key?(d.id)
  { "key" => k, "stored" => stored, "party" => pbLoadTrainer(*k).party.map { |pk| full.call(pk) } } } }
"""
CALC_MOVES_SNAPSHOT_PREFIX = "check-calc-moves-"
CALC_MOVES_BADGES = (0, 2, 3, 5)
CALC_MOVES_TRAINER_GROUP = 8
CALC_MOVES_THREAT_SAMPLE = 20


def calc_moves_rules(
    result: CheckResult, connection: sqlite3.Connection, rules: dict[str, Any]
) -> None:
    result.expect("badge window level caps", tuple(rules["levels"]), calc.BADGE_LEVEL_CAPS)
    result.expect("early-game badges", rules["early"], calc.EARLY_GAME_BADGES)
    result.expect("early-game power limit", rules["threshold"], calc.EARLY_POWER_LIMIT)
    result.expect("move blacklist", sorted(rules["blacklist"]), sorted(calc.MOVE_BLACKLIST))
    result.expect("progressive randomizer", rules["progressive"], True)
    result.expect("OHKO moves banned", rules["ohko_banned"], True)
    result.expect("trainer movesets redrawn", rules["rerandom"], True)
    result.expect("trainer movesets follow the badge window", rules["trainer_progressive"], True)
    wrong = []
    for move_id, ignoring, counting, ohko in rules["powers"]:
        move = gamedb.move(connection, move_id)
        ours = [calc.max_power(move), calc.max_power(move, ignore_multihit=False)]
        if ours != [ignoring, counting] or calc.plugin_ohko(move) != ohko:
            wrong.append(
                f"{move_id} {ours} {calc.plugin_ohko(move)} vs {[ignoring, counting]} {ohko}"
            )
    mark_all(result, "maximum power and OHKO of every move", wrong, len(rules["powers"]))


def calc_moves_damaging(moves: list[list[Any]]) -> list[str]:
    return [move[0] for move in moves if move[1] > 0 and not move[2]]


def calc_moves_pool(connection: sqlite3.Connection, badges: int) -> frozenset[str]:
    return frozenset(move.id for move in calc.move_pool(connection, badges))


CALC_MOVES_TARGET = "BULBASAUR"
CALC_MOVES_REVEALED = 2


def calc_moves_target(connection: sqlite3.Connection, level: int) -> calc.Combatant:
    found = gamedb.species(connection, CALC_MOVES_TARGET)
    spans = calc.stat_spans(
        found, level, calc.Origin("own", calc.Span.exact(0), calc.Span.exact(0))
    )
    return calc.Combatant(
        level=level,
        types=found.types,
        stats=spans,
        hp=spans[calc.HP],
        stages={},
        status=calc.NO_STATUS,
        species=CALC_MOVES_TARGET,
        pokemon_types=found.types,
        weight=found.weight,
    )


def calc_moves_foe(mon: dict[str, Any], trainer: str | None, shown: int) -> KnownFoe:
    names: list[str] = [move[0] for move in mon["moves"]]
    moves: list[Known[str]] = [*names[:shown]]
    values: dict[str, Any] = {each.name: HIDDEN for each in fields(KnownFoe)}
    values |= {
        "index": 1,
        "trainer": trainer,
        "slot": 0,
        "species": Named(id=mon["sp"][1], name=None),
        "form": mon["sp"][2],
        "level": mon["level"],
        "types": None,
        "moves": tuple(moves + [HIDDEN] * (MAX_MOVES - len(moves))),
    }
    return KnownFoe(**values)


def calc_moves_rolled(mon: dict[str, Any]) -> KnownRandom:
    learnset = Learnset(
        species=mon["sp"][0],
        moves=tuple(gamedb.LevelMove(entry[0], entry[1]) for entry in mon["learnset"]),
        tag=OWN,
    )
    return KnownRandom(
        tick=0,
        owned=frozenset({mon["sp"][1]}),
        abilities=None,
        learnsets={mon["sp"][0]: learnset},
        compatibility=None,
        tm_moves=None,
        starters=(),
        wild=None,
        trainers=None,
        tm_marts=None,
    )


def calc_moves_threats(
    connection: sqlite3.Connection,
    badges: int,
    mon: dict[str, Any],
    trainer: str | None,
    rolled: KnownRandom | None,
) -> str | None:
    shown = CALC_MOVES_REVEALED if trainer is not None else 1
    found = calc_moves_foe(mon, trainer, shown)
    user = calc.foe(connection, found, rolled=rolled)
    if user is None:
        return f"{mon['sp'][0]}: no combatant"
    target = calc_moves_target(connection, mon["level"])
    terms = calc.Conditions()
    listed = calc.threats(connection, found, user, target, terms, badges, rolled)
    label = f"{mon['sp'][0]} L{mon['level']}"
    names = [move[0] for move in mon["moves"]]
    revealed = [
        name
        for name in names[:shown]
        if gamedb.move(connection, name).category != calc.STATUS_CATEGORY
    ]
    if [each.move for each in listed if each.source == calc.REVEALED_MOVE] != revealed:
        return f"{label}: revealed {revealed}, listed {[each.move for each in listed]}"
    assumed = [
        gamedb.move(connection, each.move) for each in listed if each.source == calc.ASSUMED_MOVE
    ]
    if len(assumed) > MAX_MOVES - shown:
        return f"{label}: {len(assumed)} assumed for {MAX_MOVES - shown} slots"
    window = calc.foe_window(found, badges) if rolled is None else badges
    if rolled is None and any(not calc.window_allows(move, window) for move in assumed):
        return f"{label}: assumed {[move.id for move in assumed]} past the window"
    if rolled is not None:
        learnset = tuple(gamedb.LevelMove(entry[0], entry[1]) for entry in mon["learnset"])
        allowed = set(calc.knowable_moves(learnset, mon["level"])) | calc_moves_pool(
            connection, badges
        )
        if any(move.id not in allowed for move in assumed):
            return f"{label}: assumed {[move.id for move in assumed]} outside its learnset"
    unused = replace(user, effects=BattlerEffects())
    hidden = [
        gamedb.move(connection, name)
        for name in names[shown:]
        if gamedb.move(connection, name).function_code not in calc.COUNTER_FUNCTIONS
        and gamedb.move(connection, name).category != calc.STATUS_CATEGORY
    ]
    if not hidden:
        return None
    worst = max(calc.quick_span(connection, move, unused, target, terms).high for move in hidden)
    top = max(
        (calc.quick_span(connection, move, unused, target, terms).high for move in assumed),
        default=-1,
    )
    if top < worst:
        return (
            f"{label}: assumed {[move.id for move in assumed]} up to {top}, a hidden move {worst}"
        )
    return None


def calc_moves_off_learnset(mon: dict[str, Any]) -> bool:
    learnset = tuple(gamedb.LevelMove(entry[0], entry[1]) for entry in mon["learnset"])
    knowable = calc.knowable_moves(learnset, mon["level"])
    return any(move[0] not in knowable for move in mon["moves"])


def calc_moves_wild(
    result: CheckResult, connection: sqlite3.Connection, badges: int, mons: list[dict[str, Any]]
) -> None:
    outside: list[str] = []
    owned: list[str] = []
    for mon in mons:
        species, level = mon["sp"][0], mon["level"]
        window = max(badges, calc.level_window(level))
        damaging = [
            name
            for name in calc_moves_damaging(mon["moves"])
            if gamedb.move(connection, name).category != calc.STATUS_CATEGORY
        ]
        wide = calc_moves_pool(connection, window)
        outside += [f"{species} L{level} {name}" for name in damaging if name not in wide]
        learnset = tuple(gamedb.LevelMove(entry[0], entry[1]) for entry in mon["learnset"])
        knowable = calc.knowable_moves(learnset, level)
        names = [move[0] for move in mon["moves"]]
        added = [name for name in names if name not in knowable]
        open_slot = not any(
            gamedb.move(connection, name).power > calc.DAMAGING_POWER for name in knowable
        )
        allowed = calc_moves_pool(connection, badges) if open_slot else frozenset()
        dropped = [name for name in knowable if name not in names]
        if len(added) > 1 or any(name not in allowed for name in added) or len(dropped) > 1:
            owned.append(f"{species} L{level} {names} for {list(knowable)}")
    mark_all(
        result,
        f"wild Pokémon at {badges} badges: damaging moves in the unowned assumed pool",
        outside,
        len(mons),
    )
    result.note(
        f"wild Pokémon at {badges} badges: {sum(map(calc_moves_off_learnset, mons))} of "
        f"{len(mons)} took a move from outside their learnset"
    )
    sample = mons[:CALC_MOVES_THREAT_SAMPLE]
    for narrowed in (False, True):
        problems = [
            problem
            for mon in sample
            if (
                problem := calc_moves_threats(
                    connection, badges, mon, None, calc_moves_rolled(mon) if narrowed else None
                )
            )
        ]
        mark_all(
            result,
            f"wild Pokémon at {badges} badges, {'owned' if narrowed else 'unowned'}, one move "
            "revealed: threats list it, the assumed moves keep to the "
            f"{'learnset' if narrowed else 'window'} and reach the hidden moves' damage",
            problems,
            len(sample),
        )
    mark_all(
        result,
        f"wild Pokémon at {badges} badges: moves from the owned learnset's last four, "
        "or one pool move when none of them is damaging",
        owned,
        len(mons),
    )


def calc_moves_trainers(
    result: CheckResult,
    connection: sqlite3.Connection,
    badges: int,
    trainers: list[dict[str, Any]],
) -> tuple[int, int]:
    pool = calc_moves_pool(connection, badges)
    outside: list[str] = []
    moves = off_learnset = 0
    party = [
        (trainer["key"], mon)
        for trainer in trainers
        if not trainer["stored"]
        for mon in trainer["party"]
    ]
    for key, mon in party:
        learned = {entry[1] for entry in mon["learnset"]}
        for name in calc_moves_damaging(mon["moves"]):
            if gamedb.move(connection, name).category == calc.STATUS_CATEGORY:
                continue
            moves += 1
            off_learnset += name not in learned
            if name not in pool:
                outside.append(f"{'/'.join(map(str, key))} {mon['sp'][0]} {name}")
    mark_all(
        result,
        f"trainer Pokémon at {badges} badges: damaging moves in the assumed pool",
        outside,
        len(party),
    )
    problems = [
        problem
        for key, mon in party
        if (problem := calc_moves_threats(connection, badges, mon, ":".join(map(str, key)), None))
    ]
    mark_all(
        result,
        f"trainer Pokémon at {badges} badges, two moves revealed: threats list them, the "
        "assumed moves keep to the window and reach the hidden moves' damage",
        problems,
        len(party),
    )
    return moves, off_learnset


def check_calc_moves(live: Live, result: CheckResult) -> None:
    if random_ready(live, result) is None:
        return
    session = live.session
    name = f"{CALC_MOVES_SNAPSHOT_PREFIX}{session.session}-{session.rng().tick}"
    save_snapshot(session, name)
    result.note(f"saved {name}; restored once the check is done")
    try:
        calc_moves_draws(live, result)
    finally:
        restore_snapshot(session, name)


def calc_moves_draws(live: Live, result: CheckResult) -> None:
    keys = eval_data(
        live, ruby(RANDOM_TRAINER_PICK, EVERY=RANDOM_TRAINER_EVERY, HELD=RANDOM_TRAINER_HELD)
    )
    moves = off_learnset = 0
    with closing(gamedb.open_gamedb(BUILDS[live.launch.build], live.settings)) as connection:
        calc_moves_rules(result, connection, eval_data(live, CALC_MOVES_RULES))
        for index, badges in enumerate(CALC_MOVES_BADGES):
            mons = eval_data(
                live,
                ruby(
                    RANDOM_FULL_BATCH,
                    BADGES=badges,
                    COUNT=RANDOM_BATCH,
                    SPECIES=RANDOM_SPECIES,
                    LEVELS=RANDOM_LEARNSET_LEVELS,
                ),
            )
            calc_moves_wild(result, connection, badges, mons)
            group = keys[index :: len(CALC_MOVES_BADGES)]
            trainers: list[dict[str, Any]] = []
            for start in range(0, len(group), CALC_MOVES_TRAINER_GROUP):
                batch = group[start : start + CALC_MOVES_TRAINER_GROUP]
                trainers += eval_data(
                    live, ruby(CALC_MOVES_TRAINERS, BADGES=badges, KEYS=json.dumps(batch))
                )
            found, outside = calc_moves_trainers(result, connection, badges, trainers)
            moves += found
            off_learnset += outside
    result.mark(
        off_learnset > 0,
        f"trainer movesets drawn apart from the learnset: {off_learnset} of {moves} damaging "
        "moves outside the species' rolled learnset",
    )


NEW_GAME_CHECKS: dict[str, LiveCheck] = {
    "overworld": check_overworld,
    "challenge": check_challenge,
    "randomizer": check_randomizer,
    "completo": check_completo,
    "set-style": check_set_style,
    "wild-hidden": check_wild_hidden,
    "rulebook": check_rulebook,
    "intro": check_intro,
    "mark": check_mark,
    "updater": check_updater,
    "discord": check_discord,
    "no-mega": check_no_mega,
    "starter-region": check_starter_region,
    "new-game-save": check_new_game_save,
    "eggs": check_eggs,
    "egg-hatch": check_egg_hatch,
}
NUZLOCKE_CHECKS: dict[str, LiveCheck] = {
    "challenge-start": check_challenge_start,
    "mart-bans": check_mart_bans,
    "permafaint": check_permafaint,
    "clauses": check_clauses,
    "first-encounter": check_first_encounter,
    "catch-nickname": check_catch_nickname,
    "hall-of-fame": check_hall_of_fame,
    "party-wipe": check_party_wipe,
    "total-wipe": check_total_wipe,
    "level-cap": check_level_cap,
}
RANDOM_CHECKS: dict[str, LiveCheck] = {
    "random-species": check_random_species,
    "random-starters": check_random_starters,
    "random-learnsets": check_random_learnsets,
    "random-abilities": check_random_abilities,
    "random-trainers": check_random_trainers,
    "random-tms": check_random_tms,
    "random-marts": check_random_marts,
    "random-items": check_random_items,
    "random-wild": check_random_wild,
    "random-reload": check_random_reload,
}
CAPS_CHECKS: dict[str, LiveCheck] = {
    "evolutions": check_evolutions,
    "megas": check_megas,
}
BATTLE_CHECKS: dict[str, LiveCheck] = {
    "battle-mechanics": check_battle_mechanics,
    "official-types": check_official_types,
    "freeze": check_freeze,
    "calc": check_calc,
    "calc-moves": check_calc_moves,
}
SHINY_CHECKS: dict[str, LiveCheck] = {
    "shinies": check_shinies,
}
STATS_CHECKS: dict[str, LiveCheck] = {
    "ivs-evs": check_ivs_evs,
}
SHOWDOWN_CHECKS: dict[str, LiveCheck] = {
    "showdown": check_showdown,
}
STAGE0_LIVE_CHECKS: dict[str, LiveCheck] = {
    "launch": check_launch,
    "handshake": check_handshake,
    "eval": check_eval,
    "saves": check_saves,
    "snapshot": check_snapshot,
}
REPLAY_CHECK = "replay"
LIVE_CHECKS = {
    **NEW_GAME_CHECKS,
    **NUZLOCKE_CHECKS,
    **CAPS_CHECKS,
    **BATTLE_CHECKS,
    **SHINY_CHECKS,
    **STATS_CHECKS,
    **SHOWDOWN_CHECKS,
    **RANDOM_CHECKS,
    **STAGE0_LIVE_CHECKS,
}
GROUPS: dict[str, list[str]] = {
    "newgame": list(NEW_GAME_CHECKS),
    "nuzlocke": list(NUZLOCKE_CHECKS),
    "caps": list(CAPS_CHECKS),
    "battle": list(BATTLE_CHECKS),
    "shiny": list(SHINY_CHECKS),
    "stats": list(STATS_CHECKS),
    "showdown": list(SHOWDOWN_CHECKS),
    "random": list(RANDOM_CHECKS),
    "stage0": [*STAGE0_LIVE_CHECKS, REPLAY_CHECK],
    "all": [
        *NEW_GAME_CHECKS,
        *NUZLOCKE_CHECKS,
        *CAPS_CHECKS,
        *BATTLE_CHECKS,
        *SHINY_CHECKS,
        *STATS_CHECKS,
        *SHOWDOWN_CHECKS,
        *RANDOM_CHECKS,
        *STAGE0_LIVE_CHECKS,
        REPLAY_CHECK,
    ],
}
CHECK_NAMES = [*GROUPS, *LIVE_CHECKS, REPLAY_CHECK]


def expand(names: list[str]) -> list[str]:
    chosen: list[str] = []
    for name in names:
        for check in GROUPS.get(name, [name]):
            if check not in LIVE_CHECKS and check != REPLAY_CHECK:
                raise CheckError(f"no check named {check}; known: {', '.join(CHECK_NAMES)}")
            if check not in chosen:
                chosen.append(check)
    return [check for check in GROUPS["all"] if check in chosen]


def record(session: Session, result: CheckResult) -> None:
    reply = session.call(
        "note",
        kind=CHECK_KIND,
        entry={"name": result.name, "passed": result.passed, "evidence": result.evidence},
    )
    if not NoteResult.model_validate(reply.result).recorded:
        log.info("the session keeps no record; the check %s entry was dropped", result.name)


LIVE_ERRORS = (
    BridgeError,
    CheckError,
    InvestigateError,
    InteropError,
    SnapshotError,
    DriveError,
    WorldError,
    OSError,
    ValueError,
    KeyError,
    IndexError,
)


def run_live(live: Live, name: str) -> CheckResult:
    result = CheckResult(name)
    if name in NEW_GAME_CHECKS:
        live.read_new_game()
    try:
        LIVE_CHECKS[name](live, result)
    except LIVE_ERRORS as error:
        result.mark(False, f"the check stopped: {type(error).__name__}: {error}")
    record(live.session, result)
    return result


@contextmanager
def live_game(settings: Settings) -> Generator[Live]:
    with drive(settings, CLIENT_NAME) as driver:
        launch = load_launch(driver.session.session_dir)
        started = (driver.session.session_dir / LAUNCH_JSON).stat().st_mtime
        yield Live(settings, driver, launch, started)


def run_checks(settings: Settings, names: list[str], report: Reporter) -> list[CheckResult]:
    chosen = expand(names)
    results: list[CheckResult] = []
    live_names = [name for name in chosen if name in LIVE_CHECKS]
    with live_game(settings) as live:
        session = live.session.session
        for name in live_names:
            result = run_live(live, name)
            results.append(result)
            report_result(result, report)
    if REPLAY_CHECK in chosen:
        result = CheckResult(REPLAY_CHECK)
        replayed = check_replay(settings, session, result, report)
        if replayed != session:
            with attach(settings, CLIENT_NAME) as replayed_session:
                record(replayed_session, result)
        results.append(result)
        report_result(result, report)
    return results


def report_result(result: CheckResult, report: Reporter) -> None:
    report(f"{'pass' if result.passed else 'FAIL'} {result.name}")
    for line in result.evidence:
        report(f"  {line}")


GAMEDB_CHECK = "gamedb"
GAMEDB_CLIENT_NAME = "anil db check"
GAMEDB_CHUNK = 200
GAMEDB_KEYS = "AnilJSON.encode({cls}::DATA.keys)"
GAMEDB_ENTRIES = (
    "AnilJSON.encode({cls}::DATA.values[{start}, {count}].map {{ |d| "
    "[d.id, d.instance_variables.to_h {{ |v| x = d.instance_variable_get(v); "
    "[v.to_s, x.is_a?(GameData::Move) ? x.id : x] }}] }})"
)
GAMEDB_TM_MOVES = (
    "AnilJSON.encode((($PokemonGlobal && $PokemonGlobal.tm_move_map) || {}).map { |i, m| "
    "[i, m.respond_to?(:id) ? m.id : m] })"
)
GAMEDB_ROLLED_FIELD = "@move"
GAMEDB_MATCHUPS = (
    "AnilJSON.encode(GameData::Type.keys.to_h { |a| "
    "[a, GameData::Type.keys.to_h { |d| [d, Effectiveness.calculate(a, d)] }] })"
)


def gamedb_eval(session: Session, source: str) -> Any:
    return json.loads(json.loads(eval_inspect(session, source).replace("\\#", "#")))


def gamedb_kind(
    session: Session, connection: sqlite3.Connection, kind: gamedb.Kind, result: CheckResult
) -> None:
    cls = gamedb.GAME_CLASSES[kind]
    cached = list(gamedb.entries(connection, kind))
    live_keys = [gamedb.entry_id(key) for key in gamedb_eval(session, GAMEDB_KEYS.format(cls=cls))]
    result.expect(
        f"{kind}: ids in order ({len(cached)} cached, {len(live_keys)} live)",
        [found.id for found in cached] == live_keys,
        True,
    )
    live: dict[str, dict[str, Any]] = {}
    for start in range(0, len(live_keys), GAMEDB_CHUNK):
        source = GAMEDB_ENTRIES.format(cls=cls, start=start, count=GAMEDB_CHUNK)
        live.update((gamedb.entry_id(key), raw) for key, raw in gamedb_eval(session, source))
    rolled = dict(gamedb_eval(session, GAMEDB_TM_MOVES)) if kind == "items" else {}
    differences = [
        f"{found.id}: {', '.join(gamedb_fields(found.raw, live.get(found.id)))}"
        for found in cached
        if not gamedb_accepted(found.raw, live.get(found.id), rolled.get(found.id))
    ]
    label = f"{kind}: every cached entry equal to live {cls}"
    if kind == "items":
        label += f", or {GAMEDB_ROLLED_FIELD} rolled as tm_move_map gives it"
    mark_all(result, label, differences, len(cached))
    if rolled:
        gamedb_note_rolled(result, cached, live, rolled)


def gamedb_accepted(raw: dict[str, Any], live: dict[str, Any] | None, rolled: Any) -> bool:
    if raw == live:
        return True
    if live is None or rolled is None:
        return False
    return live.get(GAMEDB_ROLLED_FIELD) == rolled and raw == {
        **live,
        GAMEDB_ROLLED_FIELD: raw.get(GAMEDB_ROLLED_FIELD),
    }


def gamedb_note_rolled(
    result: CheckResult,
    cached: list[gamedb.Entry],
    live: dict[str, dict[str, Any]],
    rolled: dict[str, Any],
) -> None:
    accepted = [
        found
        for found in cached
        if found.id in rolled and gamedb_accepted(found.raw, live.get(found.id), rolled[found.id])
    ]
    file_move = [
        f"{found.id} {rolled[found.id]}" for found in accepted if found.raw == live.get(found.id)
    ]
    rolled_move = [
        f"{found.id} {rolled[found.id]}" for found in accepted if found.raw != live.get(found.id)
    ]
    result.note(
        f"rolled TMs accepted with the data-file {GAMEDB_ROLLED_FIELD} ({len(file_move)}): "
        f"{', '.join(file_move) or 'none'}"
    )
    result.note(
        f"rolled TMs accepted with the rolled {GAMEDB_ROLLED_FIELD} ({len(rolled_move)}): "
        f"{', '.join(rolled_move) or 'none'}"
    )


def gamedb_fields(raw: dict[str, Any], live: dict[str, Any] | None) -> list[str]:
    if live is None:
        return ["not live"]
    return [
        f"{name} cached {raw.get(name)!r}, live {live.get(name)!r}"
        for name in sorted(set(raw) | set(live))
        if raw.get(name) != live.get(name)
    ]


def gamedb_matchups(session: Session, connection: sqlite3.Connection, result: CheckResult) -> None:
    live = gamedb_eval(session, GAMEDB_MATCHUPS)
    types = gamedb.type_ids(connection)
    wrong = [
        f"{attack} against {defend}: cached {cached}, live {live[attack][defend]}"
        for attack in types
        for defend in types
        if (cached := gamedb.matchup(connection, attack, defend).multiplier) != live[attack][defend]
    ]
    mark_all(result, "type matchups equal to live Effectiveness.calculate", wrong, len(types) ** 2)
    for defend in ("FAIRY", "DRAGON"):
        result.note(
            f"against {defend}: "
            + ", ".join(
                f"{attack} {live[attack][defend]}" for attack in types if live[attack][defend] != 1
            )
        )


def check_gamedb(session: Session, connection: sqlite3.Connection) -> CheckResult:
    result = CheckResult(GAMEDB_CHECK)
    result.note(f"cache stamp {gamedb.counts(connection).stamp}")
    try:
        for kind in gamedb.KINDS:
            gamedb_kind(session, connection, kind, result)
        gamedb_matchups(session, connection, result)
    except LIVE_ERRORS as error:
        result.mark(False, f"the check stopped: {type(error).__name__}: {error}")
    record(session, result)
    return result


def run_gamedb_check(
    settings: Settings, connection: sqlite3.Connection, report: Reporter
) -> CheckResult:
    with attach(settings, GAMEDB_CLIENT_NAME) as session:
        result = check_gamedb(session, connection)
    report_result(result, report)
    return result
