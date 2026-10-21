import functools
import itertools
import math
import sqlite3
from dataclasses import dataclass, field, replace
from typing import Final

from anil.harness import gamedb
from anil.harness.gamedb import LevelMove, Move, Species
from anil.harness.knowledge import (
    HIDDEN,
    MAX_MOVES,
    Hidden,
    Known,
    KnownBattle,
    KnownFoe,
    KnownRandom,
)
from anil.harness.state import Battler, BattlerEffects, Pokemon, Stats

HP: Final = "HP"
ATTACK: Final = "ATTACK"
DEFENSE: Final = "DEFENSE"
SPECIAL_ATTACK: Final = "SPECIAL_ATTACK"
SPECIAL_DEFENSE: Final = "SPECIAL_DEFENSE"
SPEED: Final = "SPEED"
STAT_FIELDS: Final = {
    HP: "hp",
    ATTACK: "attack",
    DEFENSE: "defense",
    SPECIAL_ATTACK: "special_attack",
    SPECIAL_DEFENSE: "special_defense",
    SPEED: "speed",
}

IV_MAX: Final = 31
TRAINER_EV_MAX: Final = 85
NATURE_LOW: Final = 90
NATURE_NEUTRAL: Final = 100
NATURE_HIGH: Final = 110
SHEDINJA_BASE_HP: Final = 1
FULL_PERCENT: Final = 100

STAGE_NEUTRAL: Final = 6
STAGE_MULTIPLIERS: Final = (2, 2, 2, 2, 2, 2, 2, 3, 4, 5, 6, 7, 8)
STAGE_DIVISORS: Final = (8, 7, 6, 5, 4, 3, 2, 2, 2, 2, 2, 2, 2)

ROLLS: Final = tuple(range(85, 101))
CRIT_MULTIPLIER: Final = 1.5
STAB_MULTIPLIER: Final = 1.5
ADAPTABILITY_STAB: Final = 2.0
SPREAD_MULTIPLIER: Final = 0.75
WEATHER_BOOST: Final = 1.5
WEATHER_DEFENSE: Final = 1.5
TERRAIN_BOOST: Final = 1.3
SCREEN_DOUBLES: Final = 2 / 3.0
SPORT_DIVISOR: Final = 3
TECHNICIAN_LIMIT: Final = 60
TYPE_ITEM_BOOST: Final = 1.2
RECKLESS_BOOST: Final = 1.2
PARENTAL_DIVISOR: Final = 4
PLATE_BOOST: Final = 1.25
GEM_BOOST: Final = 1.3
RISK_COUNT: Final = 3

PHYSICAL: Final = "physical"
SPECIAL: Final = "special"
NO_WEATHER: Final = "None"
NO_TERRAIN: Final = "None"
BURN: Final = "BURN"
POISON: Final = "POISON"
NO_STATUS: Final = "NONE"
FLYING: Final = "FLYING"
GROUND: Final = "GROUND"
GHOST: Final = "GHOST"
SUN_WEATHERS: Final = frozenset({"Sun", "HarshSun"})
RAIN_WEATHERS: Final = frozenset({"Rain", "HeavyRain"})
SAND: Final = "Sandstorm"
SNOW: Final = "Hail"
STRONG_WINDS: Final = "StrongWinds"
TERRAIN_TYPES: Final = {"Electric": "ELECTRIC", "Grassy": "GRASS", "Psychic": "PSYCHIC"}
ELECTRIC_TERRAIN: Final = "Electric"
GRASSY_TERRAIN: Final = "Grassy"
MISTY: Final = "Misty"
STRUGGLE_FUNCTION: Final = "Struggle"
NO_EVOLUTION: Final = "None"
PLAYER_SIDE: Final = "player"
OPPONENT_SIDE: Final = "opponent"
FIELD_SIDE: Final = "field"

CONTACT: Final = "Contact"
PUNCHING: Final = "Punching"
KICKING: Final = "Kicking"
BITING: Final = "Biting"
PULSE: Final = "Pulse"
SOUND: Final = "Sound"
SLICING: Final = "Slicing"
BOMB: Final = "Bomb"
WIND: Final = "Wind"

MOLD_BREAKERS: Final = frozenset({"MOLDBREAKER", "TERAVOLT", "TURBOBLAZE"})
WEATHER_NEGATORS: Final = frozenset({"CLOUDNINE", "AIRLOCK"})
NEUTRALIZING_GAS: Final = "NEUTRALIZINGGAS"
RUIN_ABILITIES: Final = ("TABLETSOFRUIN", "SWORDOFRUIN", "VESSELOFRUIN", "BEADSOFRUIN")
PINCH_ABILITIES: Final = {
    "BLAZE": "FIRE",
    "OVERGROW": "GRASS",
    "TORRENT": "WATER",
    "SWARM": "BUG",
    "SOBRECARGA": "ELECTRIC",
}
TYPE_ATTACK_ABILITIES: Final = {
    "DRAGONSMAW": ("DRAGON", 1.5),
    "ROCKYPAYLOAD": ("ROCK", 1.5),
    "STEELWORKER": ("STEEL", 1.5),
    "COLEOPTERO": ("BUG", 1.5),
    "INFLAMABLE": ("FIRE", 1.5),
    "ALBINISMO": ("ICE", 1.5),
    "FLORACION": ("GRASS", 1.5),
    "TRANSISTOR": ("ELECTRIC", 1.3),
    "WATERBUBBLE": ("WATER", 2.0),
}
FLAG_POWER_ABILITIES: Final = {
    "IRONFIST": (PUNCHING, 1.2),
    "CAMORRISTA": (KICKING, 1.2),
    "MEGALAUNCHER": (PULSE, 1.5),
    "STRONGJAW": (BITING, 1.5),
    "SHARPNESS": (SLICING, 1.5),
    "TOUGHCLAWS": (CONTACT, 4 / 3.0),
}
NORMAL_TYPE_ABILITIES: Final = {
    "AERILATE": FLYING,
    "GALVANIZE": "ELECTRIC",
    "PIXILATE": "FAIRY",
    "REFRIGERATE": "ICE",
    "PIELMALDITA": GHOST,
    "PIELHERBACEA": "GRASS",
}
SOUND_TYPE_ABILITIES: Final = {"LIQUIDVOICE": "WATER", "TINTINEO": "PSYCHIC"}
NORMALIZE: Final = "NORMALIZE"
TYPE_ABILITY_BOOST: Final = 1.2
USER_ABILITIES: Final = frozenset(
    {
        "HUGEPOWER",
        "PUREPOWER",
        "HUSTLE",
        "GORILLATACTICS",
        "PODERSABIO",
        "GUTS",
        "DEFEATIST",
        "FLAREBOOST",
        "TOXICBOOST",
        "FLOWERGIFT",
        "SOLARPOWER",
        "ORICHALCUMPULSE",
        "HADRONENGINE",
        "SILVANO",
        "PODERGELIDO",
        "REALEZA",
        "PUNKROCK",
        "SANDFORCE",
        "SHEERFORCE",
        "TECHNICIAN",
        "TINTEDLENS",
        "SNIPER",
        "NEUROFORCE",
        "STEELYSPIRIT",
        "ADAPTABILITY",
        "INFILTRATOR",
        "SCRAPPY",
        "MINDSEYE",
        "UNAWARE",
        "LONGREACH",
        "SKILLLINK",
        "PARENTALBOND",
        "RECKLESS",
        "SIMPLE",
        "CONTRARY",
        NORMALIZE,
        *NORMAL_TYPE_ABILITIES,
        *SOUND_TYPE_ABILITIES,
        *PINCH_ABILITIES,
        *TYPE_ATTACK_ABILITIES,
        *FLAG_POWER_ABILITIES,
        *MOLD_BREAKERS,
    }
)
ABSORBING_ABILITIES: Final = {
    "FLASHFIRE": "FIRE",
    "WELLBAKEDBODY": "FIRE",
    "WATERABSORB": "WATER",
    "DRYSKIN": "WATER",
    "STORMDRAIN": "WATER",
    "VOLTABSORB": "ELECTRIC",
    "LIGHTNINGROD": "ELECTRIC",
    "MOTORDRIVE": "ELECTRIC",
    "SAPSIPPER": "GRASS",
    "EARTHEATER": "GROUND",
}
FLAG_IMMUNE_ABILITIES: Final = {"BULLETPROOF": BOMB, "SOUNDPROOF": SOUND, "WINDRIDER": WIND}
BERRY_BLOCKERS: Final = frozenset({"UNNERVE", "ASONECHILLINGNEIGH", "ASONEGRIMNEIGH"})
TARGET_ABILITIES: Final = frozenset(
    {
        "DRYSKIN",
        "FILTER",
        "SOLIDROCK",
        "PRISMARMOR",
        "FLOWERGIFT",
        "FLUFFY",
        "FURCOAT",
        "GRASSPELT",
        "HEATPROOF",
        "ICESCALES",
        "MARVELSCALE",
        "MULTISCALE",
        "SHADOWSHIELD",
        "PUNKROCK",
        "THICKFAT",
        "PURIFYINGSALT",
        "WATERBUBBLE",
        "LEVITATE",
        "WONDERGUARD",
        "UNAWARE",
        "STURDY",
        "RIPEN",
        "DAMP",
        *BERRY_BLOCKERS,
        *ABSORBING_ABILITIES,
        *FLAG_IMMUNE_ABILITIES,
    }
)
FIELD_ABILITIES: Final = frozenset(
    {
        "DARKAURA",
        "FAIRYAURA",
        "AURABREAK",
        "KLUTZ",
        NEUTRALIZING_GAS,
        *RUIN_ABILITIES,
        *WEATHER_NEGATORS,
    }
)
WEIGHT_ABILITIES: Final = frozenset({"HEAVYMETAL", "LIGHTMETAL"})
MODELLED_ABILITIES: Final = USER_ABILITIES | TARGET_ABILITIES | FIELD_ABILITIES | WEIGHT_ABILITIES
UNMODELLED_ABILITIES: Final = frozenset(
    {
        "SUPREMEOVERLORD",
        "ANALYTIC",
        "FLASHFIRE",
        "MINUS",
        "PLUS",
        "PROTOSYNTHESIS",
        "QUARKDRIVE",
        "RIVALRY",
        "SLOWSTART",
        "ACOMETIDA",
        "STAKEOUT",
        "BATTERY",
        "POWERSPOT",
        "FRIENDGUARD",
        "PROTEAN",
        "LIBERO",
        "DISGUISE",
        "ICEFACE",
        "TERASHELL",
        "MULTITYPE",
        "RKSSYSTEM",
        "FORECAST",
    }
)

TYPE_ITEMS: Final = {
    "BLACKBELT": "FIGHTING",
    "BLACKGLASSES": "DARK",
    "CHARCOAL": "FIRE",
    "DRAGONFANG": "DRAGON",
    "HARDSTONE": "ROCK",
    "ROCKINCENSE": "ROCK",
    "MAGNET": "ELECTRIC",
    "METALCOAT": "STEEL",
    "MIRACLESEED": "GRASS",
    "ROSEINCENSE": "GRASS",
    "MYSTICWATER": "WATER",
    "SEAINCENSE": "WATER",
    "WAVEINCENSE": "WATER",
    "NEVERMELTICE": "ICE",
    "FAIRYFEATHER": "FAIRY",
    "POISONBARB": "POISON",
    "SHARPBEAK": "FLYING",
    "SILKSCARF": "NORMAL",
    "SILVERPOWDER": "BUG",
    "SOFTSAND": "GROUND",
    "SPELLTAG": "GHOST",
    "TWISTEDSPOON": "PSYCHIC",
    "ODDINCENSE": "PSYCHIC",
}
PLATES: Final = {
    "FISTPLATE": "FIGHTING",
    "DREADPLATE": "DARK",
    "FLAMEPLATE": "FIRE",
    "DRACOPLATE": "DRAGON",
    "STONEPLATE": "ROCK",
    "ZAPPLATE": "ELECTRIC",
    "IRONPLATE": "STEEL",
    "MEADOWPLATE": "GRASS",
    "SPLASHPLATE": "WATER",
    "ICICLEPLATE": "ICE",
    "PIXIEPLATE": "FAIRY",
    "TOXICPLATE": "POISON",
    "SKYPLATE": "FLYING",
    "BLANKPLATE": "NORMAL",
    "INSECTPLATE": "BUG",
    "EARTHPLATE": "GROUND",
    "SPOOKYPLATE": "GHOST",
    "MINDPLATE": "PSYCHIC",
}
GEMS: Final = {
    f"{kind}GEM": kind
    for kind in (
        "BUG",
        "DARK",
        "DRAGON",
        "ELECTRIC",
        "FAIRY",
        "FIGHTING",
        "FIRE",
        "FLYING",
        "GHOST",
        "GRASS",
        "GROUND",
        "ICE",
        "NORMAL",
        "POISON",
        "PSYCHIC",
        "ROCK",
        "STEEL",
        "WATER",
    )
}
RESIST_BERRIES: Final = {
    "BABIRIBERRY": "STEEL",
    "CHARTIBERRY": "ROCK",
    "CHILANBERRY": "NORMAL",
    "CHOPLEBERRY": "FIGHTING",
    "COBABERRY": "FLYING",
    "COLBURBERRY": "DARK",
    "HABANBERRY": "DRAGON",
    "KASIBBERRY": "GHOST",
    "KEBIABERRY": "POISON",
    "OCCABERRY": "FIRE",
    "PASSHOBERRY": "WATER",
    "PAYAPABERRY": "PSYCHIC",
    "RINDOBERRY": "GRASS",
    "ROSELIBERRY": "FAIRY",
    "SHUCABERRY": "GROUND",
    "TANGABERRY": "BUG",
    "WACANBERRY": "ELECTRIC",
    "YACHEBERRY": "ICE",
}
SPECIES_ORBS: Final = {
    "ADAMANTORB": ("DIALGA", ("DRAGON", "STEEL")),
    "LUSTROUSORB": ("PALKIA", ("DRAGON", "WATER")),
    "GRISEOUSORB": ("GIRATINA", ("DRAGON", "GHOST")),
}
SOUL_DEW_HOLDERS: Final = ("LATIAS", "LATIOS")
SOUL_DEW_TYPES: Final = ("DRAGON", "PSYCHIC")
LOADED_DICE: Final = "LOADEDDICE"
USER_ITEMS: Final = frozenset(
    {
        "CHOICEBAND",
        "CHOICESPECS",
        "MUSCLEBAND",
        "WISEGLASSES",
        "PUNCHINGGLOVE",
        "LIFEORB",
        "EXPERTBELT",
        "LIGHTBALL",
        "THICKCLUB",
        "DEEPSEATOOTH",
        "SOULDEW",
        "SUPEREVIOLITE",
        "UTILITYUMBRELLA",
        LOADED_DICE,
        *TYPE_ITEMS,
        *PLATES,
        *GEMS,
        *SPECIES_ORBS,
    }
)
TARGET_ITEMS: Final = frozenset(
    {
        "ASSAULTVEST",
        "DEEPSEASCALE",
        "EVIOLITE",
        "SUPEREVIOLITE",
        "METALPOWDER",
        "AIRBALLOON",
        "IRONBALL",
        "RINGTARGET",
        "FOCUSSASH",
        "ABILITYSHIELD",
        *RESIST_BERRIES,
    }
)
WEIGHT_ITEMS: Final = frozenset({"FLOATSTONE"})
MODELLED_ITEMS: Final = USER_ITEMS | TARGET_ITEMS | WEIGHT_ITEMS
UNMODELLED_ITEMS: Final = frozenset(
    {"METRONOME", "WELLSPRINGMASK", "HEARTHFLAMEMASK", "CORNERSTONEMASK"}
)
UNMODELLED_FIELD_EFFECTS: Final = frozenset({"WonderRoom"})

HAPPINESS_MAX: Final = 255
STATUS_SLEEP: Final = "SLEEP"
STATUS_PARALYSIS: Final = "PARALYSIS"
FACADE_STATUSES: Final = frozenset({POISON, BURN, STATUS_PARALYSIS})
DAMAGE_NEUTRAL_FUNCTIONS: Final = frozenset(
    {
        "AddMoneyGainedFromBattle",
        "AddMoneyGainedFromBattleLowerUserSpAtk1",
        "AttackAndSkipNextTurn",
        "AttackTwoTurnsLater",
        "BadPoisonTarget",
        "BindTarget",
        "BurnAttackerBeforeUserActs",
        "BurnFlinchTarget",
        "BurnTarget",
        "BurnTargetAlwaysHitsInRain",
        "BurnTargetIfTargetStatsRaisedThisTurn",
        "CannotBeRedirected",
        "CantSelectConsecutiveTurns",
        "ConfuseTarget",
        "ConfuseTargetAlwaysHitsInRainHitsTargetInSky",
        "ConfuseTargetIfTargetStatsRaisedThisTurn",
        "CureTargetBurn",
        "DamageAndCureUserPartyStatus",
        "DamageAndResetAllBattlersStatStages",
        "DamageAndStartWeakenPhysicalDamageAgainstUserSide",
        "DamageAndStartWeakenSpecialDamageAgainstUserSide",
        "DamageTargetAddLeechSeedToFoeSide",
        "DamageTargetAddSpikesToFoeSide",
        "DamageTargetAddStealthRocksToFoeSide",
        "DamageTargetAlly",
        "DestroyTargetBerryOrGem",
        "DisableTargetHealingMoves2Turns",
        "DisableTargetSoundMoves",
        "FailsIfNotUserFirstTurn",
        "FailsIfTargetActed",
        "FailsIfTargetHasNoItem",
        "FailsIfUserDamagedThisTurn",
        "FailsIfUserHasUnusedMove",
        "FailsIfUserNotConsumedBerry",
        "FailsUnlessTargetSharesTypeWithUser",
        "FlinchTarget",
        "FlinchTargetFailsIfNotUserFirstTurn",
        "FlinchTargetFailsIfTargetNotUsingPriorityMove",
        "FlinchTargetFailsIfUserNotAsleep",
        "FreezeFlinchTarget",
        "FreezeTarget",
        "FreezeTargetAlwaysHitsInHail",
        "HealUserByHalfOfDamageDone",
        "HealUserByHalfOfDamageDoneBurnTarget",
        "HealUserByHalfOfDamageDoneIfTargetAsleep",
        "HealUserByThreeQuartersOfDamageDone",
        "HigherPriorityInGrassyTerrain",
        "HigherPriorityInMistyTerrain",
        "HitsTargetInSky",
        "HoopaRemoveProtectionsBypassSubstituteLowerUserDef1",
        "LowerPPOfTargetLastMoveBy3",
        "LowerTargetAccuracy1",
        "LowerTargetAttack1",
        "LowerTargetDefense1",
        "LowerTargetDefense1FlinchTarget",
        "LowerTargetSpAtk1",
        "LowerTargetSpDef1",
        "LowerTargetSpDef2",
        "LowerTargetSpeed1",
        "LowerTargetSpeed1AlwaysHitsInRain",
        "LowerTargetSpeedOverTime",
        "LowerUserAtkDef1",
        "LowerUserDefSpDef1",
        "LowerUserDefSpDefSpd1",
        "LowerUserDefense1",
        "LowerUserSpAtk2",
        "LowerUserSpeed1",
        "LowerUserSpeed2",
        "MultiTurnAttackConfuseUserAtEnd",
        "MultiTurnAttackPreventSleeping",
        "NegateTargetAbilityIfTargetActed",
        "None",
        "NormalMovesBecomeElectric",
        "ParalyzeBurnOrFreezeTarget",
        "ParalyzeFlinchTarget",
        "ParalyzeTarget",
        "ParalyzeTargetAlwaysHitsInRain",
        "ParalyzeTargetAlwaysHitsInRainHitsDecreasesInSunTargetInSky",
        "PoisonParalyzeOrSleepTarget",
        "PoisonTarget",
        "RaiseUserAttack1",
        "RaiseUserAttack3IfTargetFaints",
        "RaiseUserDefense1",
        "RaiseUserDefense2",
        "RaiseUserMainStats1",
        "RaiseUserSpAtk1",
        "RaiseUserSpeed1",
        "RaiseUserStat1Commander",
        "RemoveProtections",
        "RemoveProtectionsBypassSubstitute",
        "RemoveTerrain",
        "RemoveTerrainIceSpinner",
        "RemoveUserBindingAndEntryHazards",
        "RemoveUserBindingAndEntryHazardsPoisonTarget",
        "ResetTargetStatStages",
        "SleepTargetChangeUserMeloettaForm",
        "StarmobileBurnTarget",
        "StarmobileConfuseTarget",
        "StarmobileParalyzeTarget",
        "StarmobilePoisonTarget",
        "StarmobileSleepTarget",
        "StartRaiseUserAtk1WhenDamaged",
        "StartSaltCureTarget",
        "SwitchOutTargetDamagingMove",
        "SwitchOutUserDamagingMove",
        "TrapTargetInBattle",
        "TrapTargetInBattleMainEffect",
        "TrapUserAndTargetInBattle",
        "TwoTurnAttackBurnTarget",
        "TwoTurnAttackChargeRaiseUserDefense1",
        "TwoTurnAttackChargeRaiseUserSpAtk1",
        "TwoTurnAttackFlinchTarget",
        "TwoTurnAttackInvulnerableInSky",
        "TwoTurnAttackInvulnerableInSkyParalyzeTarget",
        "TwoTurnAttackInvulnerableRemoveProtections",
        "TwoTurnAttackInvulnerableUnderground",
        "TwoTurnAttackInvulnerableUnderwater",
        "TwoTurnAttackOneTurnInRainRaiseUserSpAtk1",
        "TwoTurnAttackParalyzeTarget",
        "UsedAfterUserTakesPhysicalDamage",
        "UserConsumeTargetBerry",
        "UserLosesElectricType",
        "UserLosesFireType",
        "UserLosesHalfOfTotalHP",
        "UserLosesHalfOfTotalHPExplosive",
        "UserTakesTargetItem",
        "UserVulnerableUntilNextAction",
    }
)
FIXED_DAMAGE_FUNCTIONS: Final = frozenset(
    {
        "FixedDamage20",
        "FixedDamage40",
        "FixedDamageHalfTargetHP",
        "FixedDamageUserLevel",
        "FixedDamageUserLevelRandom",
        "LowerTargetHPToUserHP",
        "UserFaintsFixedDamageUserHP",
        "OHKO",
        "OHKOIce",
        "OHKOHitsUndergroundTarget",
    }
)
OHKO_FUNCTIONS: Final = frozenset({"OHKO", "OHKOIce", "OHKOHitsUndergroundTarget"})
POWER_FUNCTIONS: Final = frozenset(
    {
        "PowerHigherWithUserHP",
        "PowerLowerWithUserHP",
        "PowerHigherWithTargetHP",
        "PowerHigherWithTargetHP100PowerRange",
        "PowerHigherWithUserPositiveStatStages",
        "PowerHigherWithTargetPositiveStatStages",
        "PowerHigherWithTargetWeight",
        "PowerHigherWithUserHeavierThanTarget",
        "PowerHigherWithUserHappiness",
        "PowerLowerWithUserHappiness",
        "DoublePowerIfTargetHPLessThanHalf",
        "DoublePowerIfTargetPoisoned",
        "DoublePowerIfTargetPoisonedPoisonTarget",
        "DoublePowerIfTargetStatusProblem",
        "DoublePowerIfTargetStatusProblemBurnTarget",
        "DoublePowerIfTargetParalyzedCureTarget",
        "DoublePowerIfTargetAsleepCureTarget",
        "DoublePowerIfUserPoisonedBurnedParalyzed",
        "DoublePowerIfUserHasNoItem",
        "DoublePowerInElectricTerrain",
        "HitsAllFoesAndPowersUpInPsychicTerrain",
        "LowerTargetDefense1PowersUpInGravity",
        "LowerTargetSpeed1WeakerInGrassyTerrain",
        "IncreasePowerSuperEffective",
        "IncreasePowerInElectricTerrain",
        "IncreasePowerInSunWeather",
        "TwoTurnAttackOneTurnInSun",
        "RandomPowerDoublePowerIfTargetUnderground",
        "RandomlyDamageOrHealTarget",
        "RandomlyDealsDoubleDamage",
        "DoublePowerIfTargetUnderground",
        "DoublePowerIfTargetUnderwater",
        "DoublePowerIfTargetInSky",
        "FlinchTargetDoublePowerIfTargetInSky",
        "BindTargetDoublePowerIfTargetUnderwater",
    }
)
HIDDEN_POWER: Final = "TypeDependsOnUserIVs"
MORPEKO_WHEEL: Final = "TypeDependsOnUserMorpekoFormRaiseUserSpeed1"
FIRST_TYPE_MOVE: Final = "TypeIsUserFirstType"
SECOND_TYPE_MOVES: Final = {
    "TypeIsUserSecondType": "OGERPON",
    "TypeIsUserSecondTypeRemoveScreens": "TAUROS",
}
WEATHER_BALL: Final = "TypeAndPowerDependOnWeather"
TERRAIN_PULSE: Final = "TypeAndPowerDependOnTerrain"
NATURAL_GIFT: Final = "TypeAndPowerDependOnUserBerry"
TERA_STARSTORM: Final = "TerapagosCategoryDependsOnHigherDamage"
MEMORY_TYPES: Final = (
    "FIGHTING",
    "FLYING",
    "POISON",
    "GROUND",
    "ROCK",
    "BUG",
    "GHOST",
    "STEEL",
    "FIRE",
    "WATER",
    "GRASS",
    "ELECTRIC",
    "PSYCHIC",
    "ICE",
    "DRAGON",
    "DARK",
    "FAIRY",
)
HELD_TYPE_ITEMS: Final = {
    "TypeDependsOnUserPlate": PLATES,
    "TypeDependsOnUserMemory": {f"{kind}MEMORY": kind for kind in MEMORY_TYPES},
    "TypeDependsOnUserDrive": {
        "SHOCKDRIVE": "ELECTRIC",
        "BURNDRIVE": "FIRE",
        "CHILLDRIVE": "ICE",
        "DOUSEDRIVE": "WATER",
    },
}
BASE_TYPE_FUNCTIONS: Final = frozenset(
    {
        HIDDEN_POWER,
        MORPEKO_WHEEL,
        FIRST_TYPE_MOVE,
        WEATHER_BALL,
        TERRAIN_PULSE,
        NATURAL_GIFT,
        TERA_STARSTORM,
        *SECOND_TYPE_MOVES,
        *HELD_TYPE_ITEMS,
    }
)
FLYING_PRESS: Final = "EffectivenessIncludesFlyingType"
SUPER_EFFECTIVE_AGAINST: Final = {
    "FreezeTargetSuperEffectiveAgainstWater": "WATER",
    "SuperEffectiveAgainstBug": "BUG",
}
GROUNDS_TARGET: Final = "HitsTargetInSkyGroundsTarget"
SKY_DROP: Final = "TwoTurnAttackInvulnerableInSkyTargetCannotAct"
SKY_DROP_WEIGHT: Final = 2000
NIHIL_LIGHT: Final = "HitsFairysIgnoreTargetDefSpDefEvaStatStages"
TYPE_FUNCTIONS: Final = BASE_TYPE_FUNCTIONS | frozenset(
    {FLYING_PRESS, GROUNDS_TARGET, SKY_DROP, NIHIL_LIGHT, *SUPER_EFFECTIVE_AGAINST}
)
SCREEN_BREAKERS: Final = frozenset({"TypeIsUserSecondTypeRemoveScreens", "RemoveScreens"})
WEATHER_BALL_TYPES: Final = {
    "Sun": "FIRE",
    "HarshSun": "FIRE",
    "Rain": "WATER",
    "HeavyRain": "WATER",
    SAND: "ROCK",
    SNOW: "ICE",
}
TERRAIN_PULSE_TYPES: Final = {**TERRAIN_TYPES, MISTY: "FAIRY"}
HIDDEN_POWER_EXCLUDED: Final = frozenset({"NORMAL", "SHADOW"})
HIDDEN_POWER_BITS: Final = (HP, ATTACK, DEFENSE, SPEED, SPECIAL_ATTACK, SPECIAL_DEFENSE)
HIDDEN_POWER_TOP: Final = 63
NATURAL_GIFT_FLAG: Final = "NaturalGift_"
NATURAL_GIFT_FLOOR: Final = 10
NORMAL: Final = "NORMAL"
TWO_HITS: Final = frozenset({"HitTwoTimes", "HitTwoTimesPoisonTarget", "HitTwoTimesFlinchTarget"})
SURGING_STRIKES: Final = "HitThreeTimesAlwaysCriticalHit"
ALWAYS_CRITICAL_FUNCTIONS: Final = frozenset({SURGING_STRIKES, "AlwaysCriticalHit"})
THREE_HITS: Final = frozenset({"HitThreeTimes", SURGING_STRIKES})
RISING_HITS: Final = frozenset(
    {"HitThreeTimesPowersUpWithEachHit", "HitThreeTimesPowersUpWithEachHitFlinchTarget"}
)
WATER_SHURIKEN: Final = "HitTwoToFiveTimesOrThreeForAshGreninja"
TWO_TO_FIVE_HITS: Final = frozenset(
    {"HitTwoToFiveTimes", "HitTwoToFiveTimesRaiseUserSpd1LowerUserDef1", WATER_SHURIKEN}
)
TEN_HITS: Final = "HitTenTimes"
BEAT_UP: Final = "HitOncePerUserTeamMember"
DRAGON_DARTS: Final = "HitTwoTimesTargetThenTargetAlly"
MULTI_HIT_FUNCTIONS: Final = (
    TWO_HITS | THREE_HITS | RISING_HITS | TWO_TO_FIVE_HITS | {TEN_HITS, BEAT_UP, DRAGON_DARTS}
)
SINGLE_HIT_FUNCTIONS: Final = frozenset(
    {
        "LowerTargetHPToUserHP",
        "MultiTurnAttackPowersUpEachTurn",
        "ThrowUserItemAtTarget",
        "UserFaintsExplosive",
        "UserFaintsFixedDamageUserHP",
    }
)
CHARGING_FUNCTIONS: Final = frozenset(
    {
        "TwoTurnAttackBurnTarget",
        "TwoTurnAttackChargeRaiseUserDefense1",
        "TwoTurnAttackChargeRaiseUserSpAtk1",
        "TwoTurnAttackFlinchTarget",
        "TwoTurnAttackInvulnerableInSky",
        "TwoTurnAttackInvulnerableInSkyParalyzeTarget",
        "TwoTurnAttackInvulnerableInSkyTargetCannotAct",
        "TwoTurnAttackInvulnerableRemoveProtections",
        "TwoTurnAttackInvulnerableUnderground",
        "TwoTurnAttackInvulnerableUnderwater",
        "TwoTurnAttackOneTurnInRainRaiseUserSpAtk1",
        "TwoTurnAttackOneTurnInSun",
        "TwoTurnAttackParalyzeTarget",
    }
)
TWO_TO_FIVE: Final = (2, 5)
LOADED_DICE_FIVE: Final = (4, 5)
LOADED_DICE_TEN: Final = (4, 10)
SKILL_LINK_HITS: Final = 5
ASH_GRENINJA: Final = ("GRENINJA", 2)
ASH_SHURIKEN_HITS: Final = 3
ASH_SHURIKEN_POWER: Final = 20
BEAT_UP_BASE: Final = 5
BEAT_UP_DIVISOR: Final = 10
MAX_PARTY: Final = 6
RECOIL_DIVISORS: Final = {
    "RecoilQuarterOfDamageDealt": 4,
    "RecoilThirdOfDamageDealt": 3,
    "RecoilThirdOfDamageDealtBurnTarget": 3,
    "RecoilThirdOfDamageDealtParalyzeTarget": 3,
    "RecoilHalfOfDamageDealt": 2,
}
RECOIL_TOTAL_HP: Final = "RecoilHalfOfTotalHP"
CRASH_FUNCTIONS: Final = frozenset(
    {"CrashDamageIfFails", "CrashDamageIfFailsConfuseTarget", "CrashDamageIfFailsUnusableInGravity"}
)
RECOIL_FUNCTIONS: Final = frozenset({*RECOIL_DIVISORS, RECOIL_TOTAL_HP, *CRASH_FUNCTIONS})
RECOIL_BLOCKERS: Final = frozenset({"ROCKHEAD", "ICEHEAD"})
MAGIC_GUARD: Final = "MAGICGUARD"
CRIT_BLOCKERS: Final = frozenset({"BATTLEARMOR", "SHELLARMOR"})
BETWEEN_HIT_ABILITIES: Final = frozenset(
    {
        "STAMINA",
        "WEAKARMOR",
        "WATERCOMPACTION",
        "SEEDSOWER",
        "SANDSPIT",
        "MUMMY",
        "LINGERINGAROMA",
        "WANDERINGSPIRIT",
    }
)
BETWEEN_HIT_ITEMS: Final = frozenset({"KEEBERRY", "MARANGABERRY"})
FOUL_PLAY: Final = "UseTargetAttackInsteadOfUserAttack"
BODY_PRESS: Final = "UseUserDefenseInsteadOfUserAttack"
PSYSHOCK: Final = "UseTargetDefenseInsteadOfTargetSpDef"
STAGE_IGNORERS: Final = frozenset({"IgnoreTargetDefSpDefEvaStatStages", NIHIL_LIGHT})
SHELL_SIDE_ARM: Final = "CategoryDependsOnHigherDamagePoisonTarget"
PHOTON_GEYSER: Final = "CategoryDependsOnHigherDamageIgnoreTargetAbility"
ABILITY_IGNORERS: Final = frozenset({"IgnoreTargetAbility", PHOTON_GEYSER})
KNOCK_OFF: Final = "RemoveTargetItem"
KNOCK_OFF_BOOST: Final = 1.5
FLING: Final = "ThrowUserItemAtTarget"
FLING_FLAG: Final = "Fling_"
FLING_FLOOR: Final = 10
NON_LETHAL_FUNCTIONS: Final = frozenset({"CannotMakeTargetFaint"})
EXPLOSION: Final = "UserFaintsExplosive"
DAMP: Final = "DAMP"
SPECTRAL_THIEF: Final = "UserStealTargetPositiveStatStages"
STAGE_LIMIT: Final = 6
PLAIN_DAMAGE_FUNCTIONS: Final = frozenset({"EffectDependsOnEnvironment", "HealAllyOrDamageFoe"})
STAT_FUNCTIONS: Final = frozenset(
    {
        FOUL_PLAY,
        BODY_PRESS,
        PSYSHOCK,
        SHELL_SIDE_ARM,
        SPECTRAL_THIEF,
        KNOCK_OFF,
        FLING,
        EXPLOSION,
        *STAGE_IGNORERS,
        *ABILITY_IGNORERS,
        *SCREEN_BREAKERS,
        *ALWAYS_CRITICAL_FUNCTIONS,
        *NON_LETHAL_FUNCTIONS,
        *PLAIN_DAMAGE_FUNCTIONS,
    }
)
TARGET_ACTED: Final = "DoublePowerIfTargetActed"
TARGET_NOT_ACTED: Final = "DoublePowerIfTargetNotActed"
ASSURANCE: Final = "DoublePowerIfTargetLostHPThisTurn"
REVENGE: Final = "DoublePowerIfUserLostHPThisTurn"
RETALIATE: Final = "DoublePowerIfAllyFaintedLastTurn"
STOMPING_TANTRUM: Final = "DoublePowerIfUserLastMoveFailed"
LASH_OUT: Final = "DoublePowerIfUserStatsLoweredThisTurn"
PURSUIT: Final = "PursueSwitchingFoe"
ROUND: Final = "UsedAfterAllyRoundWithDoublePower"
FUSION_BOLT: Final = "DoublePowerAfterFusionFlare"
FUSION_FLARE: Final = "DoublePowerAfterFusionBolt"
PLEDGE_COMBOS: Final = {
    "FirePledge": {"WaterPledge": "WATER", "GrassPledge": None},
    "WaterPledge": {"GrassPledge": "GRASS", "FirePledge": None},
    "GrassPledge": {"FirePledge": "FIRE", "WaterPledge": None},
}
COUNTER: Final = "CounterPhysicalDamage"
MIRROR_COAT: Final = "CounterSpecialDamage"
METAL_BURST: Final = "CounterDamagePlusHalf"
BIDE: Final = "MultiTurnAttackBideThenReturnDoubleDamage"
COUNTER_FUNCTIONS: Final = frozenset({COUNTER, MIRROR_COAT, METAL_BURST, BIDE})
HISTORY_FUNCTIONS: Final = frozenset(
    {
        TARGET_ACTED,
        TARGET_NOT_ACTED,
        ASSURANCE,
        REVENGE,
        RETALIATE,
        STOMPING_TANTRUM,
        LASH_OUT,
        PURSUIT,
        ROUND,
        FUSION_BOLT,
        FUSION_FLARE,
        *PLEDGE_COMBOS,
        *COUNTER_FUNCTIONS,
    }
)
FURY_CUTTER: Final = "PowerHigherWithConsecutiveUse"
ECHOED_VOICE: Final = "PowerHigherWithConsecutiveUseOnUserSide"
ROLLOUT: Final = "MultiTurnAttackPowersUpEachTurn"
SPIT_UP: Final = "PowerDependsOnUserStockpile"
TRUMP_CARD: Final = "PowerHigherWithLessPP"
RAGE_FIST: Final = "IncreasePowerEachTimeHit"
LAST_RESPECTS: Final = "IncreasePowerEachFaintedAlly"
GYRO_BALL: Final = "PowerHigherWithTargetFasterThanUser"
ELECTRO_BALL: Final = "PowerHigherWithUserFasterThanTarget"
USAGE_FUNCTIONS: Final = frozenset(
    {FURY_CUTTER, ECHOED_VOICE, ROLLOUT, SPIT_UP, TRUMP_CARD, RAGE_FIST, LAST_RESPECTS}
)
SPEED_FUNCTIONS: Final = frozenset({GYRO_BALL, ELECTRO_BALL})
MODELLED_FUNCTIONS: Final = (
    FIXED_DAMAGE_FUNCTIONS
    | POWER_FUNCTIONS
    | TYPE_FUNCTIONS
    | MULTI_HIT_FUNCTIONS
    | RECOIL_FUNCTIONS
    | STAT_FUNCTIONS
    | HISTORY_FUNCTIONS
    | USAGE_FUNCTIONS
    | SPEED_FUNCTIONS
)
FURY_CUTTER_CAP: Final = 160
ECHOED_VOICE_MAX: Final = 5
ROLLOUT_TURNS: Final = 5
STOCKPILE_MAX: Final = 3
STOCKPILE_POWER: Final = 100
TRUMP_CARD_POWERS: Final = (200, 80, 60, 50, 40)
PRESSURE: Final = "PRESSURE"
RAGE_FIST_STEP: Final = 50
RAGE_FIST_CAP: Final = 350
LAST_RESPECTS_STEP: Final = 50
GYRO_BALL_SCALE: Final = 25
GYRO_BALL_CAP: Final = 150
ELECTRO_BALL_POWERS: Final = ((4, 150), (3, 120), (2, 80), (1, 60))
ELECTRO_BALL_FLOOR: Final = 40
ELECTRO_BALL_TOP: Final = 4
SPEED_WEATHER_ABILITIES: Final = {
    "CHLOROPHYLL": SUN_WEATHERS,
    "SWIFTSWIM": RAIN_WEATHERS,
    "SANDRUSH": frozenset({SAND}),
    "SLUSHRUSH": frozenset({SNOW}),
    "PODERGELIDO": frozenset({SNOW}),
}
PARADOX_ABILITIES: Final = frozenset({"PROTOSYNTHESIS", "QUARKDRIVE"})
QUICK_FEET: Final = "QUICKFEET"
HALF_SPEED_ITEMS: Final = frozenset(
    {
        "IRONBALL",
        "MACHOBRACE",
        "POWERANKLET",
        "POWERBAND",
        "POWERBELT",
        "POWERBRACER",
        "POWERLENS",
        "POWERWEIGHT",
    }
)
CHOICE_SCARF: Final = "CHOICESCARF"
QUICK_POWDER: Final = "QUICKPOWDER"
QUICK_POWDER_SPECIES: Final = "DITTO"
SUPER_EVIOLITE: Final = "SUPEREVIOLITE"
SPEED_ITEMS: Final = HALF_SPEED_ITEMS | {CHOICE_SCARF, QUICK_POWDER, SUPER_EVIOLITE}
SPEED_BOOST: Final = 1.5
SPEED_DOUBLE: Final = 2.0
SPEED_HALF: Final = 0.5
UMBRELLA_WEATHERS: Final = SUN_WEATHERS | RAIN_WEATHERS
MAIL_FLAGS: Final = frozenset({"Mail", "IconMail"})
BERRY_FLAG: Final = "Berry"
UNLOSABLE_ITEMS: Final = {
    "ARCEUS": (*PLATES, "LEGENDPLATE"),
    "SILVALLY": tuple(f"{kind}MEMORY" for kind in MEMORY_TYPES),
    "GENESECT": tuple(HELD_TYPE_ITEMS["TypeDependsOnUserDrive"]),
    "KYOGRE": ("BLUEORB",),
    "GROUDON": ("REDORB",),
    "ZACIAN": ("RUSTEDSWORD",),
    "ZAMAZENTA": ("RUSTEDSHIELD",),
    "DIALGA": ("ADAMANTCRYSTAL",),
    "PALKIA": ("LUSTROUSGLOBE",),
    "GIRATINA": ("GRISEOUSCORE",),
    "OGERPON": ("WELLSPRINGMASK", "HEARTHFLAMEMASK", "CORNERSTONEMASK"),
}
UNLOSABLE_ABILITIES: Final = {"ARCEUS": "MULTITYPE", "SILVALLY": "RKSSYSTEM"}
FACADE: Final = "DoublePowerIfUserPoisonedBurnedParalyzed"
GRASSY_HALVED: Final = frozenset(
    {"DoublePowerIfTargetUnderground", "RandomPowerDoublePowerIfTargetUnderground"}
)
HEALING_DRAWS: Final = frozenset({"RandomlyDamageOrHealTarget"})
MAGNITUDE_POWERS: Final = (10, 30, 50, 70, 90, 110, 150)
PRESENT_POWERS: Final = (40, 80, 120)
FLAIL_POWERS: Final = ((2, 200), (5, 150), (10, 100), (17, 80), (33, 40))
FLAIL_FLOOR: Final = 20
LOW_KICK_POWERS: Final = ((2000, 120), (1000, 100), (500, 80), (250, 60), (100, 40))
LOW_KICK_FLOOR: Final = 20
HEAVY_SLAM_POWERS: Final = ((5, 120), (4, 100), (3, 80), (2, 60))
HEAVY_SLAM_FLOOR: Final = 40
PUNISHMENT_CAP: Final = 200
ELECTRIC: Final = "ELECTRIC"
DARK: Final = "DARK"
FIRE: Final = "FIRE"
HELPING_HAND_BOOST: Final = 1.5
ME_FIRST_BOOST: Final = 1.5
CHARGE_BOOST: Final = 2.0
EFFECT_DOUBLE: Final = 2.0
TRAMPLES_MINIMIZE: Final = "TramplesMinimize"
INFILTRATOR: Final = "INFILTRATOR"
UNDERGROUND: Final = frozenset({"TwoTurnAttackInvulnerableUnderground"})
UNDERWATER: Final = frozenset({"TwoTurnAttackInvulnerableUnderwater"})
IN_SKY: Final = frozenset(
    {
        "TwoTurnAttackInvulnerableInSky",
        "TwoTurnAttackInvulnerableInSkyParalyzeTarget",
        "TwoTurnAttackInvulnerableInSkyTargetCannotAct",
    }
)
UNDERGROUND_HITTERS: Final = GRASSY_HALVED
UNDERWATER_HITTERS: Final = frozenset(
    {"DoublePowerIfTargetUnderwater", "BindTargetDoublePowerIfTargetUnderwater"}
)
SKY_HITTERS: Final = frozenset({"DoublePowerIfTargetInSky", "FlinchTargetDoublePowerIfTargetInSky"})

NOT_MODELLED_FOE_ABILITY: Final = "the foe's unrevealed ability, beyond the named risks"
NOT_MODELLED_FOE_ITEM: Final = "the foe's unrevealed held item, beyond the named risks"
NOT_MODELLED_ABILITY: Final = "ability {ability}"
NOT_MODELLED_ITEM: Final = "held item {item}"
NOT_MODELLED_FUNCTION: Final = "move effect {code}"
NOT_MODELLED_FOE_EFFECTS: Final = "the foe's battler effects"
NOT_MODELLED_HISTORY: Final = "the damage taken this round that move effect {code} returns"
EFFECT_NAME: Final = "battler effect {effect}"
NOT_MODELLED_FIELD_EFFECT: Final = "field effect {effect}"
NOT_MODELLED_OTHERS: Final = "other battlers' abilities"
NOT_MODELLED_HIDDEN_TYPES: Final = "the foe's types (shown none)"
NOT_MODELLED_SCRIPTED_WILD: Final = "a scripted wild battle's set IVs and EVs or boosted boss HP"
RISK_IMMUNE: Final = "immune"
RISK_SURVIVES: Final = "survives at 1 HP"
SURVIVAL_ABILITY: Final = "STURDY"
SURVIVAL_ITEM: Final = "FOCUSSASH"

STATUS_CATEGORY: Final = "status"
REVEALED_MOVE: Final = "revealed"
ASSUMED_MOVE: Final = "assumed"
BADGE_LEVEL_CAPS: Final = (14, 23, 30, 39, 49, 54, 59, 66, 75, 100)
EARLY_GAME_BADGES: Final = 3
EARLY_POWER_LIMIT: Final = 70
DAMAGING_POWER: Final = 10
MOVE_BLACKLIST: Final = frozenset(
    {"CHATTER", "DIG", "TELEPORT", "SONICBOOM", "DRAGONRAGE", "STRUGGLE", "NIHILLIGHT"}
)
OHKO_MARK: Final = "ohko"
FIXED_MAX_POWERS: Final = {
    "TypeDependsOnUserIVs": 70,
    "TypeAndPowerDependOnUserBerry": 100,
    "ThrowUserItemAtTarget": 130,
    "PowerHigherWithUserHP": 150,
    "PowerLowerWithUserHP": 200,
    "PowerHigherWithUserHappiness": 102,
    "PowerLowerWithUserHappiness": 102,
    "PowerHigherWithLessPP": 200,
}
MAX_POWER_FACTORS: Final = {
    "DoublePowerIfUserHasNoItem": 2,
    "HitThreeTimesPowersUpWithEachHit": 6,
    "HitThreeTimesPowersUpWithEachHitFlinchTarget": 6,
    "HitTwoTimes": 2,
    "HitTwoTimesFlinchTarget": 2,
    "HitTwoTimesPoisonTarget": 2,
    "HitTwoTimesTargetThenTargetAlly": 2,
    "HitTenTimes": 10,
}
FIVE_HITS_CODE: Final = "HitTwoToFiveTimes"
FIVE_HITS: Final = 5
CRITICAL_TRIPLE_HITS: Final = 3


@dataclass(frozen=True)
class Span:
    low: int
    high: int

    @staticmethod
    def exact(value: int) -> "Span":
        return Span(value, value)


@dataclass(frozen=True)
class Origin:
    name: str
    ivs: Span
    evs: Span


WILD: Final = Origin("wild", Span(0, IV_MAX), Span.exact(0))
TRAINER: Final = Origin("trainer", Span(0, IV_MAX), Span(0, TRAINER_EV_MAX))


@dataclass(frozen=True)
class Combatant:
    level: int
    types: tuple[str, ...]
    stats: dict[str, Span]
    hp: Span
    stages: dict[str, int]
    status: str
    not_modelled: tuple[str, ...] = ()
    species: str = ""
    evolutions: int = 0
    hp_percent: int | None = None
    ability: str | None = None
    ability_hidden: bool = False
    ability_options: tuple[str, ...] | None = None
    item: str | None = None
    item_hidden: bool = False
    weight: int = 0
    happiness: Span = Span(0, HAPPINESS_MAX)
    form: int = 0
    ivs: dict[str, int] | None = None
    pokemon_types: tuple[str, ...] = ()
    team: tuple[int, ...] | None = None
    effects: BattlerEffects | None = field(default_factory=BattlerEffects)
    pp: dict[str, int] | None = None


@dataclass(frozen=True)
class History:
    target_acted: Known[bool] = HIDDEN
    target_damaged: Known[bool] = HIDDEN
    hurt_by_target: Known[bool] = HIDDEN
    stats_lowered: Known[bool] = HIDDEN
    switching: Known[bool] = HIDDEN
    round_used: Known[bool] = HIDDEN
    fusion_bolt: Known[bool] = HIDDEN
    fusion_flare: Known[bool] = HIDDEN
    pledge: Known[str | None] = HIDDEN
    counter: Known[int | None] = HIDDEN
    mirror_coat: Known[int | None] = HIDDEN
    foe_hp_lost: Known[int | None] = HIDDEN
    bide: Known[int] = HIDDEN


@dataclass(frozen=True)
class Conditions:
    weather: str = NO_WEATHER
    terrain: str = NO_TERRAIN
    targets: int = 1
    reflect: bool = False
    light_screen: bool = False
    aurora_veil: bool = False
    defender_side_size: int = 1
    mud_sport: bool = False
    water_sport: bool = False
    gravity: bool = False
    magic_room: bool = False
    lucky_chant: bool = False
    unmodelled: tuple[str, ...] = ()
    others: bool = False
    attacker_side_size: int = 1
    history: History = field(default_factory=History)
    attacker_tailwind: bool = False
    defender_tailwind: bool = False
    attacker_swamp: bool = False
    defender_swamp: bool = False
    attacker_party: int = MAX_PARTY
    trick_room: bool = False


@dataclass(frozen=True)
class Hit:
    roll: int
    type_mod: float
    critical: bool


@dataclass(frozen=True)
class Risk:
    name: str
    damage: Span
    percent: Span
    note: str | None = None


@dataclass(frozen=True)
class Damage:
    move: str
    type: str
    category: str
    effectiveness: float
    rolls: tuple[Span, ...]
    crit_rolls: tuple[Span, ...]
    damage: Span
    crit_damage: Span
    percent: Span
    crit_percent: Span
    not_modelled: tuple[str, ...] = field(default=())
    immune: str | None = None
    risks: tuple[Risk, ...] = field(default=())
    fails: bool = False
    types: tuple[str, ...] = field(default=())
    hits: Span = Span(1, 1)
    hit_rolls: tuple[tuple[Span, ...], ...] = field(default=())
    hit_crit_rolls: tuple[tuple[Span, ...], ...] = field(default=())
    recoil: Span | None = None
    crash: Span | None = None
    substitute: int | None = None


@dataclass(frozen=True)
class Power:
    bases: tuple[float, ...]
    power_mults: tuple[float, ...] = (1.0,)
    final_mults: tuple[float, ...] = (1.0,)


@dataclass
class Mults:
    power: float = 1.0
    attack: float = 1.0
    defense: float = 1.0
    final: float = 1.0


@dataclass(frozen=True)
class Strike:
    move: Move
    user: Combatant
    target: Combatant
    terms: Conditions
    user_ability: str | None
    target_ability: str | None
    target_ignorable: str | None
    user_item: str | None
    target_item: str | None
    mold_breaker: bool
    weather: str
    boosted: bool = False
    no_berry: bool = False
    hit_index: int = 0


@dataclass(frozen=True)
class Health:
    third: bool
    half: bool
    full: bool


def ruby_round(value: float) -> int:
    whole = math.floor(value)
    return whole + 1 if value - whole >= 0.5 else whole


def hp_stat(base: int, level: int, iv: int, ev: int) -> int:
    if base == SHEDINJA_BASE_HP:
        return 1
    return (base * 2 + iv + ev // 4) * level // 100 + level + 10


def other_stat(base: int, level: int, iv: int, ev: int, nature: int) -> int:
    return ((base * 2 + iv + ev // 4) * level // 100 + 5) * nature // 100


def stat_span(stat: str, base: int, level: int, origin: Origin) -> Span:
    if stat == HP:
        return Span(
            hp_stat(base, level, origin.ivs.low, origin.evs.low),
            hp_stat(base, level, origin.ivs.high, origin.evs.high),
        )
    return Span(
        other_stat(base, level, origin.ivs.low, origin.evs.low, NATURE_LOW),
        other_stat(base, level, origin.ivs.high, origin.evs.high, NATURE_HIGH),
    )


def stat_spans(species: Species, level: int, origin: Origin) -> dict[str, Span]:
    return {stat: stat_span(stat, species.base_stats[stat], level, origin) for stat in STAT_FIELDS}


def hp_from_percent(percent: int, total: Span) -> Span:
    if percent <= 0:
        return Span.exact(0)
    return Span(
        (percent - 1) * total.low // 100 + 1,
        min(percent * total.high // 100, total.high),
    )


def species_id(species: str, form: int) -> str:
    return species if form == 0 else f"{species}_{form}"


def exact_stats(stats: Stats) -> dict[str, Span]:
    return {stat: Span.exact(getattr(stats, name)) for stat, name in STAT_FIELDS.items()}


def exact_values(stats: Stats) -> dict[str, int]:
    return {stat: getattr(stats, name) for stat, name in STAT_FIELDS.items()}


def evolution_count(found: Species) -> int:
    return sum(1 for each in found.evolutions if each.method != NO_EVOLUTION)


def team_attacks(
    connection: sqlite3.Connection, party: tuple[Pokemon | None, ...]
) -> tuple[int, ...]:
    return tuple(
        gamedb.species(connection, species_id(each.species.id, each.form)).base_stats[ATTACK]
        for each in party
        if each is not None and not each.egg and each.hp > 0 and each.status.id == NO_STATUS
    )


def own(
    connection: sqlite3.Connection,
    battler: Battler,
    pokemon: Pokemon | None = None,
    party: tuple[Pokemon | None, ...] | None = None,
) -> Combatant:
    found = gamedb.species(connection, species_id(battler.species.id, battler.form))
    happiness = Span(0, HAPPINESS_MAX) if pokemon is None else Span.exact(pokemon.happiness)
    effects = battler.battler_effects
    return Combatant(
        level=battler.level,
        types=active_types(tuple(each.id for each in battler.types), effects),
        stats=exact_stats(battler.stats),
        hp=Span.exact(battler.hp),
        stages=dict(battler.stages),
        status=battler.status.id,
        species=battler.species.id,
        evolutions=evolution_count(found),
        ability=None if battler.ability is None else battler.ability.id,
        item=None if battler.item is None else battler.item.id,
        weight=effective_weight(found.weight, effects),
        happiness=happiness,
        form=battler.form,
        ivs=None if pokemon is None else exact_values(pokemon.ivs),
        pokemon_types=found.types,
        team=None if party is None else team_attacks(connection, party),
        effects=effects,
        pp={each.move.id: each.pp for each in battler.moves},
    )


def active_types(types: tuple[str, ...], effects: BattlerEffects) -> tuple[str, ...]:
    found = list(dict.fromkeys(types))
    if effects.burn_up and FIRE in found:
        found.remove(FIRE)
    if effects.roost:
        if FLYING in found:
            found.remove(FLYING)
        if not found:
            found.append(NORMAL)
    if effects.extra_type is not None and effects.extra_type not in found:
        found.append(effects.extra_type)
    if effects.double_shock and ELECTRIC in found:
        found.remove(ELECTRIC)
    return tuple(found)


def effective_weight(weight: int, effects: BattlerEffects) -> int:
    return max(weight + effects.weight_change, 1)


def known[T](value: Known[T], default: T) -> T:
    return default if isinstance(value, Hidden) else value


def rolled_abilities(rolled: KnownRandom | None, species: str) -> tuple[str, ...] | None:
    if rolled is None or rolled.abilities is None:
        return None
    entry = rolled.abilities.get(species)
    if entry is None or isinstance(entry, Hidden):
        return None
    return entry.abilities + entry.hidden_abilities


def foe(
    connection: sqlite3.Connection,
    found: KnownFoe,
    origin: Origin | None = None,
    rolled: KnownRandom | None = None,
) -> Combatant | None:
    if isinstance(found.species, Hidden) or isinstance(found.level, Hidden):
        return None
    form = known(found.form, 0)
    species = gamedb.species(connection, species_id(found.species.id, form))
    shown_types = known(found.types, None)
    types = species.types if shown_types is None else tuple(each.id for each in shown_types)
    named = [] if shown_types is not None else [NOT_MODELLED_HIDDEN_TYPES]
    if found.trainer is None:
        named.append(NOT_MODELLED_SCRIPTED_WILD)
    status = known(found.status, None)
    stats = stat_spans(species, found.level, origin or (WILD if found.trainer is None else TRAINER))
    percent = known(found.hp_percent, None)
    ability = known(found.ability, None)
    item = known(found.held_item, None)
    return Combatant(
        level=found.level,
        types=types,
        stats=stats,
        hp=stats[HP] if percent is None else hp_from_percent(percent, stats[HP]),
        stages=known(found.stages, {}),
        status=NO_STATUS if status is None else status.id,
        not_modelled=tuple(named),
        species=found.species.id,
        evolutions=evolution_count(species),
        hp_percent=percent,
        ability=ability,
        ability_hidden=found.ability is HIDDEN,
        ability_options=rolled_abilities(rolled, found.species.id)
        if found.ability is HIDDEN
        else None,
        item=item,
        item_hidden=found.held_item is HIDDEN,
        weight=species.weight,
        form=form,
        pokemon_types=species.types,
        effects=None,
    )


def side_count(battle: KnownBattle, side: str) -> int:
    parity = 0 if side == PLAYER_SIDE else 1
    count = 0
    for battler in battle.battlers:
        if isinstance(battler, Hidden):
            continue
        if isinstance(battler, KnownFoe):
            if battler.index % 2 == parity and known(battler.fainted, False) is False:
                count += 1
        elif battler.index % 2 == parity and not battler.fainted:
            count += 1
    return max(count, 1)


def side_party(battle: KnownBattle, side: str) -> int:
    if side == OPPONENT_SIDE:
        return len(battle.opponent_party)
    party = known(battle.player_party, None)
    return MAX_PARTY if party is None else sum(1 for each in party if each is not None)


def conditions(
    battle: KnownBattle, defender_side: str = OPPONENT_SIDE, *, targets: int = 1
) -> Conditions:
    shown = known(battle.shown_effects, ())
    attacker_side = PLAYER_SIDE if defender_side == OPPONENT_SIDE else OPPONENT_SIDE
    side = {effect.effect for effect in shown if effect.side == defender_side}
    attacking = {effect.effect for effect in shown if effect.side == attacker_side}
    place = {effect.effect for effect in shown if effect.side == FIELD_SIDE}
    return Conditions(
        weather=known(battle.weather, NO_WEATHER),
        terrain=known(battle.terrain, NO_TERRAIN),
        targets=targets,
        reflect="Reflect" in side,
        light_screen="LightScreen" in side,
        aurora_veil="AuroraVeil" in side,
        defender_side_size=side_count(battle, defender_side),
        attacker_side_size=side_count(battle, attacker_side),
        mud_sport="MudSportField" in place,
        water_sport="WaterSportField" in place,
        gravity="Gravity" in place,
        magic_room="MagicRoom" in place,
        lucky_chant="LuckyChant" in side,
        unmodelled=tuple(sorted(place & UNMODELLED_FIELD_EFFECTS)),
        others=sum(battle.side_sizes) > 2,
        attacker_tailwind="Tailwind" in attacking,
        defender_tailwind="Tailwind" in side,
        attacker_swamp="Swamp" in attacking,
        defender_swamp="Swamp" in side,
        attacker_party=side_party(battle, attacker_side),
        trick_room="TrickRoom" in place,
    )


def staged(value: int, stage: int) -> int:
    index = stage + STAGE_NEUTRAL
    return value * STAGE_MULTIPLIERS[index] // STAGE_DIVISORS[index]


@functools.lru_cache(maxsize=4096)
def effectiveness(connection: sqlite3.Connection, move_type: str, types: tuple[str, ...]) -> float:
    return gamedb.matchup(connection, move_type, *types).multiplier


def suppressed(battler: Combatant) -> bool:
    return battler.effects is not None and battler.effects.gastro_acid


def ability_of(battler: Combatant, other: Combatant) -> str | None:
    if battler.ability is None or suppressed(battler):
        return None
    gas = other.ability == NEUTRALIZING_GAS and not suppressed(other)
    if battler.ability != NEUTRALIZING_GAS and gas:
        return None
    return battler.ability


def item_of(battler: Combatant, ability: str | None, terms: Conditions) -> str | None:
    if battler.item is None or terms.magic_room or ability == "KLUTZ":
        return None
    if battler.effects is not None and battler.effects.embargo > 0:
        return None
    return battler.item


def airborne(
    battler: Combatant, ability: str | None, item: str | None, terms: Conditions, mold: bool
) -> bool:
    effects = battler.effects
    if item == "IRONBALL" or terms.gravity:
        return False
    if effects is not None and (effects.ingrain or effects.smack_down):
        return False
    if FLYING in battler.types:
        return True
    if ability == "LEVITATE" and not mold:
        return True
    if item == "AIRBALLOON":
        return True
    return effects is not None and (effects.magnet_rise > 0 or effects.telekinesis > 0)


def strike(move: Move, user: Combatant, target: Combatant, terms: Conditions) -> Strike:
    user_ability = ability_of(user, target)
    target_ability = ability_of(target, user)
    shielded = item_of(target, target_ability, terms) == "ABILITYSHIELD"
    ignores = user_ability in MOLD_BREAKERS or move.function_code in ABILITY_IGNORERS
    mold = ignores and not shielded
    weather = terms.weather
    if user_ability in WEATHER_NEGATORS or target_ability in WEATHER_NEGATORS:
        weather = NO_WEATHER
    return Strike(
        move=move,
        user=user,
        target=target,
        terms=terms,
        user_ability=user_ability,
        target_ability=target_ability,
        target_ignorable=None if mold else target_ability,
        user_item=item_of(user, user_ability, terms),
        target_item=item_of(target, target_ability, terms),
        mold_breaker=mold,
        weather=weather,
    )


def weather_for(hit: Strike, item: str | None) -> str:
    if hit.weather in SUN_WEATHERS | RAIN_WEATHERS and item == "UTILITYUMBRELLA":
        return NO_WEATHER
    return hit.weather


@functools.lru_cache(maxsize=8)
def hidden_power_types(connection: sqlite3.Connection) -> tuple[str, ...]:
    found = [
        (each.raw["@icon_position"], each.id)
        for each in gamedb.entries(connection, "types")
        if not each.raw["@pseudo_type"] and each.id not in HIDDEN_POWER_EXCLUDED
    ]
    return tuple(kind for _, kind in sorted(found, key=lambda each: each[0]))


def hidden_power_type(ivs: dict[str, int], kinds: tuple[str, ...]) -> str:
    index = sum((ivs[stat] & 1) << bit for bit, stat in enumerate(HIDDEN_POWER_BITS))
    return kinds[(len(kinds) - 1) * index // HIDDEN_POWER_TOP]


@functools.lru_cache(maxsize=8)
def natural_gifts(connection: sqlite3.Connection) -> dict[str, tuple[str, int]]:
    found = {}
    for each in gamedb.entries(connection, "items"):
        for flag in each.raw["@flags"]:
            if flag.startswith(NATURAL_GIFT_FLAG):
                kind, _, power = flag.removeprefix(NATURAL_GIFT_FLAG).rpartition("_")
                found[each.id] = (kind, max(int(power), NATURAL_GIFT_FLOOR))
                break
    return found


@functools.lru_cache(maxsize=8)
def item_flags(connection: sqlite3.Connection) -> dict[str, tuple[str, ...]]:
    return {each.id: tuple(each.raw["@flags"]) for each in gamedb.entries(connection, "items")}


@functools.lru_cache(maxsize=8)
def fling_powers(connection: sqlite3.Connection) -> dict[str, int]:
    found = {}
    for item, flags in item_flags(connection).items():
        for flag in flags:
            if flag.startswith(FLING_FLAG) and flag.removeprefix(FLING_FLAG).isdigit():
                found[item] = max(int(flag.removeprefix(FLING_FLAG)), FLING_FLOOR)
                break
    return found


def fling_items(connection: sqlite3.Connection, user: Combatant) -> list[str]:
    flags = item_flags(connection)
    firsts: dict[int, str] = {}
    losable = (
        each
        for each in fling_powers(connection).items()
        if not unlosable(connection, user, each[0])
    )
    ranked = sorted(
        losable,
        key=lambda each: (each[0] in MODELLED_ITEMS, BERRY_FLAG in flags[each[0]], each[0]),
    )
    for item, power in ranked:
        firsts.setdefault(power, item)
    return sorted(firsts.values())


def user_variants(connection: sqlite3.Connection, move: Move, user: Combatant) -> list[Combatant]:
    code = move.function_code
    if not user.item_hidden or user.item is not None:
        return [user]
    if code in HELD_TYPE_ITEMS:
        items = sorted(HELD_TYPE_ITEMS[code])
    elif code == NATURAL_GIFT:
        firsts: dict[tuple[str, int], str] = {}
        for item, gift in sorted(natural_gifts(connection).items()):
            firsts.setdefault(gift, item)
        items = sorted(firsts.values())
    elif code == FLING:
        items = fling_items(connection, user)
    else:
        return [user]
    return [user, *(replace(user, item=each) for each in items)]


def ability_type(hit: Strike) -> tuple[str, bool]:
    ability, move = hit.user_ability, hit.move
    if ability in NORMAL_TYPE_ABILITIES and move.type == NORMAL:
        return NORMAL_TYPE_ABILITIES[ability], True
    if ability in SOUND_TYPE_ABILITIES and SOUND in move.flags:
        return SOUND_TYPE_ABILITIES[ability], True
    if ability == NORMALIZE:
        return NORMAL, True
    return move.type, False


def second_type(user: Combatant, holder: str, default: str) -> str:
    if user.species != holder or not user.pokemon_types:
        return default
    return user.pokemon_types[1] if len(user.pokemon_types) > 1 else user.pokemon_types[0]


def base_types(connection: sqlite3.Connection, hit: Strike) -> tuple[str, ...]:
    move, user, code = hit.move, hit.user, hit.move.function_code
    if code == HIDDEN_POWER:
        kinds = hidden_power_types(connection)
        return kinds if user.ivs is None else (hidden_power_type(user.ivs, kinds),)
    if code in HELD_TYPE_ITEMS:
        return (HELD_TYPE_ITEMS[code].get(hit.user_item or "", NORMAL),)
    if code == MORPEKO_WHEEL:
        return ("DARK" if user.species == "MORPEKO" and user.form == 1 else move.type,)
    if code == FIRST_TYPE_MOVE:
        return (user.types[0] if user.types else move.type,)
    if code in SECOND_TYPE_MOVES:
        return (second_type(user, SECOND_TYPE_MOVES[code], move.type),)
    if code == WEATHER_BALL:
        return (WEATHER_BALL_TYPES.get(weather_for(hit, hit.user_item), NORMAL),)
    if code == TERRAIN_PULSE:
        return (TERRAIN_PULSE_TYPES.get(hit.terms.terrain, NORMAL),)
    if code == TERA_STARSTORM:
        return (NORMAL,)
    gift = natural_gifts(connection).get(user.item or "")
    return (NORMAL if gift is None else gift[0],)


def typed(connection: sqlite3.Connection, hit: Strike) -> list[Strike]:
    found = base_typed(connection, hit)
    effects = hit.user.effects
    if effects is None or not effects.electrify:
        return found
    return [replace(each, move=replace(each.move, type=ELECTRIC), boosted=False) for each in found]


def pledge_moves(hit: Strike) -> list[Move]:
    move = hit.move
    combos = PLEDGE_COMBOS.get(move.function_code)
    if combos is None:
        return [move]
    pledge = hit.terms.history.pledge
    if not isinstance(pledge, Hidden):
        partners: list[str | None] = [pledge]
    elif hit.terms.attacker_side_size > 1:
        partners = [None, *combos]
    else:
        partners = [None]
    return [
        replace(move, type=combos[partner] or move.type, power=move.power * 2)
        if partner in combos
        else move
        for partner in partners
    ]


def base_typed(connection: sqlite3.Connection, hit: Strike) -> list[Strike]:
    move = hit.move
    code = move.function_code
    if code not in BASE_TYPE_FUNCTIONS:
        found = []
        for each in pledge_moves(hit):
            pledged = replace(hit, move=each)
            kind, boosted = ability_type(pledged)
            found.append(replace(pledged, move=replace(each, type=kind), boosted=boosted))
        return found
    if code == NATURAL_GIFT:
        gift = natural_gifts(connection).get(hit.user.item or "")
        power = 1 if gift is None else gift[1]
        no_berry = gift is None or hit.user_item is None
        move = replace(move, power=power)
        return [
            replace(hit, move=replace(move, type=kind), no_berry=no_berry)
            for kind in base_types(connection, hit)
        ]
    return [replace(hit, move=replace(move, type=kind)) for kind in base_types(connection, hit)]


def staged_span(battler: Combatant, stat: str) -> Span:
    stage = battler.stages.get(stat, 0)
    found = battler.stats[stat]
    return Span(staged(found.low, stage), staged(found.high, stage))


def chosen_categories(hit: Strike) -> tuple[str, ...]:
    code = hit.move.function_code
    attack = staged_span(hit.user, ATTACK)
    special = staged_span(hit.user, SPECIAL_ATTACK)
    if code == PHOTON_GEYSER:
        physical = attack.high > special.low
        specially = attack.low <= special.high
    else:
        defense = staged_span(hit.target, DEFENSE)
        special_defense = staged_span(hit.target, SPECIAL_DEFENSE)
        physical = attack.high * special_defense.high >= special.low * defense.low
        specially = special.high * defense.high >= attack.low * special_defense.low
    return (PHYSICAL,) * physical + (SPECIAL,) * specially


def categorized(hit: Strike) -> list[Strike]:
    move = hit.move
    if move.function_code not in (PHOTON_GEYSER, SHELL_SIDE_ARM):
        return [hit]
    found = []
    for category in chosen_categories(hit):
        flags = move.flags
        if move.function_code == SHELL_SIDE_ARM and category == PHYSICAL:
            flags = (*flags, CONTACT)
        found.append(replace(hit, move=replace(move, category=category, flags=flags)))
    return found


def strikes(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> list[Strike]:
    return [
        each
        for variant in user_variants(connection, move, user)
        for kind in typed(connection, strike(move, variant, target, terms))
        for each in categorized(kind)
    ]


def single_type_mod(
    connection: sqlite3.Connection, hit: Strike, move_type: str, defend: str
) -> float:
    code = hit.move.function_code
    if SUPER_EFFECTIVE_AGAINST.get(code) == defend:
        return 2.0
    if code == NIHIL_LIGHT and move_type == "DRAGON" and defend == "FAIRY":
        return 1.0
    if code == GROUNDS_TARGET and move_type == GROUND and defend == FLYING:
        return 1.0
    multiplier = plain_type_mod(connection, hit, move_type, defend)
    if code == FLYING_PRESS:
        multiplier *= effectiveness(connection, FLYING, (defend,))
    return multiplier


def plain_type_mod(
    connection: sqlite3.Connection, hit: Strike, move_type: str, defend: str
) -> float:
    raw = effectiveness(connection, move_type, (defend,))
    multiplier = raw
    effects = hit.target.effects or BattlerEffects()
    if raw == 0:
        if hit.target_item == "RINGTARGET":
            multiplier = 1.0
        if (hit.user_ability == "SCRAPPY" or effects.foresight) and defend == GHOST:
            multiplier = 1.0
        if effects.miracle_eye and defend == DARK:
            multiplier = 1.0
    elif raw > 1 and hit.weather == STRONG_WINDS and defend == FLYING:
        multiplier = 1.0
    target_airborne = airborne(
        hit.target, hit.target_ability, hit.target_item, hit.terms, hit.mold_breaker
    )
    if not target_airborne and defend == FLYING and move_type == GROUND:
        multiplier = 1.0
    if raw == 0 and hit.user_ability == "MINDSEYE" and defend == GHOST:
        multiplier = 1.0
    return multiplier


def type_mod(connection: sqlite3.Connection, hit: Strike) -> float:
    if hit.move.function_code == SKY_DROP and FLYING in hit.target.types:
        return 0.0
    if hit.move.type == GROUND and FLYING in hit.target.types and hit.target_item == "IRONBALL":
        return 1.0
    total = 1.0
    for defend in hit.target.types:
        total *= single_type_mod(connection, hit, hit.move.type, defend)
    effects = hit.target.effects
    if effects is not None and effects.tar_shot and hit.move.type == FIRE:
        total *= 2
    return total


def immunity(hit: Strike, typemod: float) -> str | None:
    move = hit.move
    ability = hit.target_ignorable
    if ability in ABSORBING_ABILITIES and ABSORBING_ABILITIES[ability] == move.type:
        return NOT_MODELLED_ABILITY.format(ability=ability)
    if ability in FLAG_IMMUNE_ABILITIES and FLAG_IMMUNE_ABILITIES[ability] in move.flags:
        return NOT_MODELLED_ABILITY.format(ability=ability)
    if ability == "WONDERGUARD" and typemod <= 1:
        return NOT_MODELLED_ABILITY.format(ability=ability)
    mold = hit.mold_breaker
    if (
        move.type == GROUND
        and move.function_code != GROUNDS_TARGET
        and airborne(hit.target, hit.target_ability, hit.target_item, hit.terms, mold)
    ):
        if hit.target_ability == "LEVITATE" and not mold:
            return NOT_MODELLED_ABILITY.format(ability="LEVITATE")
        if hit.target_item == "AIRBALLOON":
            return NOT_MODELLED_ITEM.format(item="AIRBALLOON")
        effects = hit.target.effects
        if effects is not None and effects.magnet_rise > 0:
            return EFFECT_NAME.format(effect="MagnetRise")
        if effects is not None and effects.telekinesis > 0:
            return EFFECT_NAME.format(effect="Telekinesis")
    return None


def global_mults(hit: Strike, mults: Mults) -> None:
    present = {hit.user_ability, hit.target_ability}
    if ("DARKAURA" in present and hit.move.type == "DARK") or (
        "FAIRYAURA" in present and hit.move.type == "FAIRY"
    ):
        mults.power *= 3 / 4.0 if "AURABREAK" in present else 4 / 3.0
    for index, ability in enumerate(RUIN_ABILITIES):
        if ability not in present:
            continue
        category = hit.move.category == (PHYSICAL if index < 2 else SPECIAL)
        if category and index % 2 == 0 and hit.user_ability != ability:
            mults.attack *= 0.75
        elif category and index % 2 == 1 and hit.target_ability != ability:
            mults.defense *= 0.75


def contact(hit: Strike) -> bool:
    if hit.user_ability == "LONGREACH":
        return False
    if hit.user_item == "PUNCHINGGLOVE" and PUNCHING in hit.move.flags:
        return False
    return CONTACT in hit.move.flags


def user_ability_mults(
    hit: Strike, health: Health, typemod: float, crit: bool, base: float, mults: Mults
) -> None:
    ability = hit.user_ability
    move = hit.move
    physical = move.category == PHYSICAL
    special = move.category == SPECIAL
    weather = weather_for(hit, hit.user_item)
    if ability in ("HUGEPOWER", "PUREPOWER") and physical:
        mults.attack *= 2
    if ability == "HUSTLE":
        mults.attack *= 1.5
    if ability == "GORILLATACTICS" and physical:
        mults.attack *= 1.5
    if ability == "PODERSABIO" and special:
        mults.attack *= 1.5
    if ability == "GUTS" and hit.user.status != NO_STATUS and physical:
        mults.attack *= 1.5
    if ability in PINCH_ABILITIES and health.third and move.type == PINCH_ABILITIES[ability]:
        mults.attack *= 1.5
    if ability == "DEFEATIST" and health.half:
        mults.attack /= 2
    if ability in TYPE_ATTACK_ABILITIES and move.type == TYPE_ATTACK_ABILITIES[ability][0]:
        mults.attack *= TYPE_ATTACK_ABILITIES[ability][1]
    if ability == "FLAREBOOST" and hit.user.status == BURN and special:
        mults.power *= 1.5
    if ability == "TOXICBOOST" and hit.user.status == POISON and physical:
        mults.power *= 1.5
    if ability == "FLOWERGIFT" and physical and weather in SUN_WEATHERS:
        mults.attack *= 1.5
    if ability == "SOLARPOWER" and special and weather in SUN_WEATHERS:
        mults.attack *= 1.5
    if ability == "ORICHALCUMPULSE" and physical and weather in SUN_WEATHERS:
        mults.attack *= 4 / 3.0
    if ability == "HADRONENGINE" and special and hit.terms.terrain == ELECTRIC_TERRAIN:
        mults.attack *= 4 / 3.0
    if ability == "SILVANO" and hit.terms.terrain == GRASSY_TERRAIN:
        mults.attack *= 1.3
    if ability == "REALEZA" and move.type not in hit.user.types:
        mults.attack *= 1.5
    if hit.boosted:
        mults.power *= TYPE_ABILITY_BOOST
    if ability == "RECKLESS" and move.function_code in RECOIL_FUNCTIONS:
        mults.power *= RECKLESS_BOOST
    if ability in FLAG_POWER_ABILITIES and FLAG_POWER_ABILITIES[ability][0] in move.flags:
        mults.power *= FLAG_POWER_ABILITIES[ability][1]
    if ability == "PUNKROCK" and SOUND in move.flags:
        mults.attack *= 1.3
    if ability == "SANDFORCE" and weather == SAND and move.type in ("ROCK", GROUND, "STEEL"):
        mults.power *= 1.3
    if ability == "SHEERFORCE" and move.effect_chance > 0:
        mults.power *= 1.3
    if (
        ability == "TECHNICIAN"
        and move.function_code != STRUGGLE_FUNCTION
        and base * mults.power <= TECHNICIAN_LIMIT
    ):
        mults.power *= 1.5
    if ability == "TINTEDLENS" and 0 < typemod < 1:
        mults.final *= 2
    if ability == "SNIPER" and crit:
        mults.final *= 1.5
    if ability == "NEUROFORCE" and typemod > 1:
        mults.final *= 1.25
    if ability == "STEELYSPIRIT" and move.type == "STEEL":
        mults.final *= 1.5


def target_ability_mults(hit: Strike, health: Health, typemod: float, mults: Mults) -> None:
    ability = hit.target_ignorable
    move = hit.move
    physical = move.category == PHYSICAL
    special = move.category == SPECIAL
    if ability == "DRYSKIN" and move.type == "FIRE":
        mults.power *= 1.25
    if ability in ("FILTER", "SOLIDROCK") and typemod > 1:
        mults.final *= 0.75
    if ability == "FLOWERGIFT" and special and weather_for(hit, hit.target_item) in SUN_WEATHERS:
        mults.defense *= 1.5
    if ability == "FLUFFY":
        if move.type == "FIRE":
            mults.final *= 2
        if contact(hit):
            mults.final /= 2
    if ability == "FURCOAT" and physical:
        mults.defense *= 2
    if ability == "GRASSPELT" and hit.terms.terrain == GRASSY_TERRAIN:
        mults.defense *= 1.5
    if ability == "HEATPROOF" and move.type == "FIRE":
        mults.power /= 2
    if ability == "ICESCALES" and special:
        mults.final /= 2
    if ability == "MARVELSCALE" and hit.target.status != NO_STATUS and physical:
        mults.defense *= 1.5
    if ability == "MULTISCALE" and health.full:
        mults.final /= 2
    if ability == "PUNKROCK" and SOUND in move.flags:
        mults.final /= 2
    if ability == "THICKFAT" and move.type in ("FIRE", "ICE"):
        mults.power /= 2
    if ability == "PURIFYINGSALT" and move.type == GHOST:
        mults.attack /= 2
    if ability == "WATERBUBBLE" and move.type == "FIRE":
        mults.final /= 2
    if hit.target_ability == "PRISMARMOR" and typemod > 1:
        mults.final *= 0.75
    if hit.target_ability == "SHADOWSHIELD" and health.full:
        mults.final /= 2


def user_item_mults(hit: Strike, typemod: float, mults: Mults) -> None:
    item = hit.user_item
    move = hit.move
    user = hit.user
    physical = move.category == PHYSICAL
    special = move.category == SPECIAL
    if item in TYPE_ITEMS and move.type == TYPE_ITEMS[item]:
        mults.power *= TYPE_ITEM_BOOST
    if item in PLATES and move.type == PLATES[item]:
        mults.power *= PLATE_BOOST
    if item in GEMS and move.type == GEMS[item]:
        mults.power *= GEM_BOOST
    if item in SPECIES_ORBS:
        holder, types = SPECIES_ORBS[item]
        if user.species == holder and move.type in types:
            mults.power *= 1.2
    if (item == "CHOICEBAND" and physical) or (item == "CHOICESPECS" and special):
        mults.power *= 1.5
    if (item == "MUSCLEBAND" and physical) or (item == "WISEGLASSES" and special):
        mults.power *= 1.1
    if item == "PUNCHINGGLOVE" and PUNCHING in move.flags:
        mults.power *= 1.1
    if item == "LIFEORB":
        mults.final *= 1.3
    if item == "EXPERTBELT" and typemod > 1:
        mults.final *= 1.2
    if item == "LIGHTBALL":
        if user.species == "PIKACHU":
            mults.attack *= 2
        if user.species == "RAICHU":
            mults.attack *= 1.5
    if item == "THICKCLUB" and user.species in ("CUBONE", "MAROWAK") and physical:
        mults.attack *= 2
    if item == "DEEPSEATOOTH" and user.species == "CLAMPERL" and special:
        mults.attack *= 2
    if item == "SOULDEW" and user.species in SOUL_DEW_HOLDERS and move.type in SOUL_DEW_TYPES:
        mults.final *= 1.2
    if item == "SUPEREVIOLITE" and user.evolutions > 1:
        mults.attack *= 1.5


def berry_weakens(hit: Strike, typemod: float) -> bool:
    item, kind = hit.target_item, hit.move.type
    return (
        item in RESIST_BERRIES and kind == RESIST_BERRIES[item] and (typemod > 1 or kind == NORMAL)
    )


def target_item_mults(hit: Strike, typemod: float, mults: Mults) -> None:
    item = hit.target_item
    move = hit.move
    target = hit.target
    special = move.category == SPECIAL
    if item == "ASSAULTVEST" and special:
        mults.defense *= 1.5
    if berry_weakens(hit, typemod):
        mults.final /= 2
        if hit.target_ability == "RIPEN":
            mults.final /= 2
    if item == "DEEPSEASCALE" and target.species == "CLAMPERL" and special:
        mults.defense *= 2
    if (item == "EVIOLITE" and target.evolutions > 0) or (
        item == "SUPEREVIOLITE" and target.evolutions > 1
    ):
        mults.defense *= 1.5
    if item == "METALPOWDER" and target.species == "DITTO":
        mults.defense *= 1.5


def field_mults(hit: Strike, mults: Mults) -> None:
    move = hit.move
    terms = hit.terms
    if move.type == "ELECTRIC" and terms.mud_sport:
        mults.power /= SPORT_DIVISOR
    if move.type == "FIRE" and terms.water_sport:
        mults.power /= SPORT_DIVISOR
    mold = hit.mold_breaker
    user_grounded = not airborne(hit.user, hit.user_ability, hit.user_item, terms, mold)
    target_grounded = not airborne(hit.target, hit.target_ability, hit.target_item, terms, mold)
    boosted = TERRAIN_TYPES.get(terms.terrain)
    if boosted == move.type and user_grounded:
        mults.power *= TERRAIN_BOOST
    elif (
        terms.terrain == ELECTRIC_TERRAIN
        and move.function_code == "IncreasePowerInElectricTerrain"
        and user_grounded
    ):
        mults.power *= 1.5
    if terms.terrain == MISTY and move.type == "DRAGON" and target_grounded:
        mults.power /= 2


def weather_mults(hit: Strike, mults: Mults) -> None:
    move = hit.move
    weather = weather_for(hit, hit.user_item)
    if weather in SUN_WEATHERS:
        steam = move.function_code == "IncreasePowerInSunWeather"
        if move.type == "FIRE" or (move.type == "WATER" and steam):
            mults.final *= WEATHER_BOOST
        elif move.type == "WATER":
            mults.final /= 2
    elif weather in RAIN_WEATHERS:
        if move.type == "FIRE":
            mults.final /= 2
        elif move.type == "WATER":
            mults.final *= WEATHER_BOOST
    elif weather == SAND:
        if (
            "ROCK" in hit.target.types
            and move.category == SPECIAL
            and move.function_code != PSYSHOCK
        ):
            mults.defense *= WEATHER_DEFENSE
    elif weather == SNOW and "ICE" in hit.target.types:
        if move.category == PHYSICAL or move.function_code == PSYSHOCK:
            mults.defense *= WEATHER_DEFENSE


def user_effect_mults(hit: Strike, mults: Mults) -> None:
    effects = hit.user.effects
    if effects is None:
        return
    if effects.me_first:
        mults.power *= ME_FIRST_BOOST
    if effects.helping_hand:
        mults.power *= HELPING_HAND_BOOST
    if effects.charge > 0 and hit.move.type == ELECTRIC:
        mults.power *= CHARGE_BOOST


def target_effect_mults(hit: Strike, mults: Mults) -> None:
    effects = hit.target.effects
    if effects is None:
        return
    if effects.minimize and TRAMPLES_MINIMIZE in hit.move.flags:
        mults.final *= EFFECT_DOUBLE
    if effects.glaive_rush > 0:
        mults.final *= EFFECT_DOUBLE


def multipliers(hit: Strike, health: Health, roll: Hit, power: tuple[float, float, float]) -> Mults:
    mults = Mults()
    move = hit.move
    terms = hit.terms
    typemod = roll.type_mod
    critical = roll.critical
    base, power_mult, final_mult = power
    global_mults(hit, mults)
    user_ability_mults(hit, health, typemod, critical, base, mults)
    target_ability_mults(hit, health, typemod, mults)
    user_item_mults(hit, typemod, mults)
    target_item_mults(hit, typemod, mults)
    if hit.hit_index == 1 and parental(hit):
        mults.power /= PARENTAL_DIVISOR
    user_effect_mults(hit, mults)
    field_mults(hit, mults)
    if terms.targets > 1:
        mults.final *= SPREAD_MULTIPLIER
    weather_mults(hit, mults)
    if critical:
        mults.final *= CRIT_MULTIPLIER
    mults.final *= roll.roll / 100.0
    if move.type in hit.user.types:
        mults.final *= ADAPTABILITY_STAB if hit.user_ability == "ADAPTABILITY" else STAB_MULTIPLIER
    mults.final *= typemod
    if (
        hit.user.status == BURN
        and move.category == PHYSICAL
        and hit.user_ability != "GUTS"
        and move.function_code != FACADE
    ):
        mults.final /= 2
    if (
        not critical
        and hit.user_ability != "INFILTRATOR"
        and move.function_code not in SCREEN_BREAKERS
        and (
            terms.aurora_veil
            or (terms.reflect and move.category == PHYSICAL)
            or (terms.light_screen and move.category == SPECIAL)
        )
    ):
        if terms.defender_side_size > 1:
            mults.final *= SCREEN_DOUBLES
        else:
            mults.final /= 2
    target_effect_mults(hit, mults)
    mults.power *= power_mult
    mults.final *= final_mult
    return mults


def attack_stats(move: Move) -> tuple[str, str]:
    if move.category == SPECIAL:
        return SPECIAL_ATTACK, SPECIAL_DEFENSE
    return ATTACK, DEFENSE


def attack_source(hit: Strike) -> tuple[bool, str]:
    code = hit.move.function_code
    attack_stat, _ = attack_stats(hit.move)
    if code == FOUL_PLAY:
        return True, attack_stat
    if code == BODY_PRESS:
        return False, DEFENSE
    return False, attack_stat


def defense_stat(hit: Strike) -> str:
    if hit.move.function_code == PSYSHOCK:
        return DEFENSE
    return attack_stats(hit.move)[1]


def stolen_stages(hit: Strike) -> tuple[dict[str, int], dict[str, int]]:
    users, targets = dict(hit.user.stages), dict(hit.target.stages)
    if hit.move.function_code != SPECTRAL_THIEF:
        return users, targets
    for stat, stage in hit.target.stages.items():
        if stage <= 0:
            continue
        targets[stat] = 0
        change = stage * 2 if hit.user_ability == "SIMPLE" else stage
        if hit.user_ability == "CONTRARY":
            change = -change
        users[stat] = max(min(users.get(stat, 0) + change, STAGE_LIMIT), -STAGE_LIMIT)
    return users, targets


def one_damage(
    hit: Strike,
    health: Health,
    attack: int,
    defense: int,
    roll: Hit,
    power: tuple[float, float, float],
) -> int:
    from_target, attack_stat = attack_source(hit)
    users, targets = stolen_stages(hit)
    attack_stage = (targets if from_target else users).get(attack_stat, 0)
    defense_stage = targets.get(defense_stat(hit), 0)
    if hit.move.function_code in STAGE_IGNORERS:
        defense_stage = 0
    if roll.critical:
        attack_stage = max(attack_stage, 0)
        defense_stage = min(defense_stage, 0)
    if hit.target_ignorable != "UNAWARE":
        attack = staged(attack, attack_stage)
    if hit.user_ability != "UNAWARE":
        defense = staged(defense, defense_stage)
    mults = multipliers(hit, health, roll, power)
    base = max(ruby_round(power[0] * mults.power), 1)
    attack = max(ruby_round(attack * mults.attack), 1)
    defense = max(ruby_round(defense * mults.defense), 1)
    damage = (2 * hit.user.level // 5 + 2) * base * attack // defense // 50 + 2
    return max(ruby_round(damage * mults.final), 1)


def at_most(battler: Combatant, divisor: int) -> bool | None:
    total = battler.stats[HP]
    if battler.hp.high <= total.low // divisor:
        return True
    if battler.hp.low > total.high // divisor:
        return False
    return None


def at_full(battler: Combatant) -> bool | None:
    total = battler.stats[HP]
    if battler.hp_percent is None:
        return battler.hp.low == total.low == total.high
    if battler.hp_percent < FULL_PERCENT:
        return False
    return True if total.high <= FULL_PERCENT else None


def healths(user: Combatant, target: Combatant) -> list[Health]:
    options = [
        (True, False) if state is None else (state,)
        for state in (at_most(user, 3), at_most(user, 2), at_full(target))
    ]
    return [Health(*each) for each in itertools.product(*options)]


def power_ends(
    hit: Strike, power: Power
) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]]]:
    bases = (
        power.bases if hit.user_ability == "TECHNICIAN" else (min(power.bases), max(power.bases))
    )
    low = [(base, min(power.power_mults), min(power.final_mults)) for base in bases]
    high = [(base, max(power.power_mults), max(power.final_mults)) for base in bases]
    return low, high


def roll_span(hit: Strike, roll: Hit, power: Power) -> Span:
    if roll.type_mod == 0:
        return Span.exact(0)
    from_target, attack_stat = attack_source(hit)
    attack = (hit.target if from_target else hit.user).stats[attack_stat]
    defense = hit.target.stats[defense_stat(hit)]
    states = healths(hit.user, hit.target)
    lows, highs = power_ends(hit, power)
    return Span(
        min(
            one_damage(hit, state, attack.low, defense.high, roll, each)
            for state in states
            for each in lows
        ),
        max(
            one_damage(hit, state, attack.high, defense.low, roll, each)
            for state in states
            for each in highs
        ),
    )


def percent_span(damage: Span, total: Span) -> Span:
    if total.high <= 0:
        return Span.exact(0)
    return Span(damage.low * 100 // total.high, -(-damage.high * 100 // max(total.low, 1)))


def battler_flags(battler: Combatant) -> list[str]:
    named = list(battler.not_modelled)
    if battler.ability in UNMODELLED_ABILITIES:
        named.append(NOT_MODELLED_ABILITY.format(ability=battler.ability))
    if battler.ability_hidden and (
        battler.ability_options is None
        or any(each in UNMODELLED_ABILITIES for each in battler.ability_options)
    ):
        named.append(NOT_MODELLED_FOE_ABILITY)
    if battler.item in UNMODELLED_ITEMS:
        named.append(NOT_MODELLED_ITEM.format(item=battler.item))
    if battler.item_hidden:
        named.append(NOT_MODELLED_FOE_ITEM)
    return named


def between_hits(target: Combatant) -> list[str]:
    named = []
    if target.ability in BETWEEN_HIT_ABILITIES:
        named.append(NOT_MODELLED_ABILITY.format(ability=target.ability))
    if target.ability_hidden and (
        target.ability_options is None or BETWEEN_HIT_ABILITIES.intersection(target.ability_options)
    ):
        named.append(NOT_MODELLED_FOE_ABILITY)
    if target.item in BETWEEN_HIT_ITEMS:
        named.append(NOT_MODELLED_ITEM.format(item=target.item))
    return named


def not_modelled(
    move: Move, user: Combatant, target: Combatant, terms: Conditions, repeats: bool = False
) -> tuple[str, ...]:
    named = [*battler_flags(user), *battler_flags(target)]
    if user.effects is None or target.effects is None:
        named.append(NOT_MODELLED_FOE_EFFECTS)
    if repeats:
        named += between_hits(target)
    named += [NOT_MODELLED_FIELD_EFFECT.format(effect=each) for each in terms.unmodelled]
    if terms.others:
        named.append(NOT_MODELLED_OTHERS)
    code = move.function_code
    if code not in DAMAGE_NEUTRAL_FUNCTIONS and code not in MODELLED_FUNCTIONS:
        named.append(NOT_MODELLED_FUNCTION.format(code=code))
    if code in COUNTER_FUNCTIONS and isinstance(taken(code, terms.history), Hidden):
        named.append(NOT_MODELLED_HISTORY.format(code=code))
    return tuple(dict.fromkeys(named))


@dataclass(frozen=True)
class Outcome:
    typemod: float
    immune: str | None
    fails: bool
    rolls: tuple[Span, ...]
    crit_rolls: tuple[Span, ...]
    hits: Span
    hit_rolls: tuple[tuple[Span, ...], ...]
    hit_crit_rolls: tuple[tuple[Span, ...], ...]


def has_status(battler: Combatant, status: str) -> bool:
    if battler.ability == "COMATOSE" and battler.species == "KOMALA" and status == STATUS_SLEEP:
        return True
    return battler.status == status


def any_status(battler: Combatant) -> bool:
    return has_status(battler, STATUS_SLEEP) or battler.status != NO_STATUS


def weight(battler: Combatant, ability: str | None, item: str | None) -> int:
    found = max(battler.weight, 1)
    if ability == "HEAVYMETAL":
        found *= 2
    elif ability == "LIGHTMETAL":
        found = max(found // 2, 1)
    if item == "FLOATSTONE":
        found = max(found // 2, 1)
    return found


def hp_ratio(scale: int, battler: Combatant) -> tuple[int, int]:
    total = battler.stats[HP]
    low = scale * battler.hp.low // max(total.high, 1)
    high = scale * battler.hp.high // max(total.low, 1)
    return max(low, 1), max(min(high, scale), 1)


def stepped(value: int, steps: tuple[tuple[int, int], ...], floor: int) -> int:
    return next((power for limit, power in steps if value >= limit), floor)


def flail_power(n: int) -> int:
    return next((power for limit, power in FLAIL_POWERS if n < limit), FLAIL_FLOOR)


def spread(low: int, high: int) -> tuple[float, ...]:
    return tuple(float(each) for each in range(low, high + 1))


def doubled(base: int, state: bool | None) -> tuple[float, ...]:
    if state is None:
        return (float(base), float(base * 2))
    return (float(base * 2 if state else base),)


def positive_stages(battler: Combatant) -> int:
    return sum(stage for stage in battler.stages.values() if stage > 0)


def grounded(hit: Strike, battler: Combatant, ability: str | None, item: str | None) -> bool:
    return not airborne(battler, ability, item, hit.terms, hit.mold_breaker)


def hp_power(hit: Strike, code: str) -> tuple[float, ...] | None:
    user, target = hit.user, hit.target
    if code == "PowerHigherWithUserHP":
        return spread(*hp_ratio(150, user))
    if code == "PowerHigherWithTargetHP":
        return spread(*hp_ratio(120, target))
    if code == "PowerHigherWithTargetHP100PowerRange":
        return spread(*hp_ratio(100, target))
    if code == "PowerLowerWithUserHP":
        total = user.stats[HP]
        low = 48 * user.hp.low // max(total.high, 1)
        high = 48 * user.hp.high // max(total.low, 1)
        return tuple(sorted({float(flail_power(n)) for n in range(low, high + 1)}))
    if code == "DoublePowerIfTargetHPLessThanHalf":
        return doubled(hit.move.power, at_most(target, 2))
    return None


def ignores_substitute(hit: Strike) -> bool:
    return SOUND in hit.move.flags or hit.user_ability == INFILTRATOR


def behind_substitute(hit: Strike) -> bool:
    effects = hit.target.effects
    return effects is not None and effects.substitute > 0 and not ignores_substitute(hit)


def substitute_hp(hit: Strike) -> int | None:
    effects = hit.target.effects
    return effects.substitute if effects is not None and behind_substitute(hit) else None


def two_turn_code(connection: sqlite3.Connection, battler: Combatant) -> str | None:
    effects = battler.effects
    if effects is None or effects.two_turn_attack is None:
        return None
    return gamedb.move(connection, effects.two_turn_attack).function_code


def in_sky(connection: sqlite3.Connection, battler: Combatant) -> bool:
    effects = battler.effects
    if effects is not None and effects.sky_drop >= 0:
        return True
    return two_turn_code(connection, battler) in IN_SKY


def sky_power(connection: sqlite3.Connection, hit: Strike, code: str) -> tuple[float, ...] | None:
    if code not in SKY_HITTERS:
        return None
    return doubled(hit.move.power, in_sky(connection, hit.target))


def hidden_target_mult(connection: sqlite3.Connection, hit: Strike, code: str) -> float:
    state = two_turn_code(connection, hit.target)
    if (code in UNDERGROUND_HITTERS and state in UNDERGROUND) or (
        code in UNDERWATER_HITTERS and state in UNDERWATER
    ):
        return EFFECT_DOUBLE
    return 1.0


def battler_power(hit: Strike, code: str) -> tuple[float, ...] | None:
    user, target, base = hit.user, hit.target, hit.move.power
    if code == "PowerHigherWithUserPositiveStatStages":
        return (float(20 * (1 + positive_stages(user))),)
    if code == "PowerHigherWithTargetPositiveStatStages":
        return (float(min(20 * (3 + positive_stages(target)), PUNISHMENT_CAP)),)
    if code == "PowerHigherWithTargetWeight":
        found = weight(target, hit.target_ignorable, hit.target_item)
        return (float(stepped(found, LOW_KICK_POWERS, LOW_KICK_FLOOR)),)
    if code == "PowerHigherWithUserHeavierThanTarget":
        ratio = weight(user, hit.user_ability, hit.user_item) // weight(
            target, hit.target_ignorable, hit.target_item
        )
        return (float(stepped(ratio, HEAVY_SLAM_POWERS, HEAVY_SLAM_FLOOR)),)
    if code == "PowerHigherWithUserHappiness":
        return spread(max(user.happiness.low * 2 // 5, 1), max(user.happiness.high * 2 // 5, 1))
    if code == "PowerLowerWithUserHappiness":
        low = (HAPPINESS_MAX - user.happiness.high) * 2 // 5
        high = (HAPPINESS_MAX - user.happiness.low) * 2 // 5
        return spread(max(low, 1), max(high, 1))
    open_target = not behind_substitute(hit)
    if code in ("DoublePowerIfTargetPoisoned", "DoublePowerIfTargetPoisonedPoisonTarget"):
        return doubled(base, has_status(target, POISON) and open_target)
    if code in ("DoublePowerIfTargetStatusProblem", "DoublePowerIfTargetStatusProblemBurnTarget"):
        return doubled(base, any_status(target) and open_target)
    if code == "DoublePowerIfTargetParalyzedCureTarget":
        return doubled(base, has_status(target, STATUS_PARALYSIS) and open_target)
    if code == "DoublePowerIfTargetAsleepCureTarget":
        return doubled(base, has_status(target, STATUS_SLEEP) and open_target)
    if code == FACADE:
        return doubled(base, any(has_status(user, each) for each in FACADE_STATUSES))
    return None


def field_power(hit: Strike, code: str, typemod: float) -> tuple[float, ...] | None:
    terms, base = hit.terms, hit.move.power
    if code == "DoublePowerInElectricTerrain":
        state = terms.terrain == ELECTRIC_TERRAIN and grounded(
            hit, hit.target, hit.target_ability, hit.target_item
        )
        return doubled(base, state)
    if code == "HitsAllFoesAndPowersUpInPsychicTerrain":
        boosted = terms.terrain == "Psychic" and grounded(
            hit, hit.user, hit.user_ability, hit.user_item
        )
        return (float(base * 3 // 2 if boosted else base),)
    if code == "LowerTargetDefense1PowersUpInGravity":
        return (float(base * 3 // 2 if terms.gravity else base),)
    if code == "LowerTargetSpeed1WeakerInGrassyTerrain":
        return (float(ruby_round(base / 2.0) if terms.terrain == GRASSY_TERRAIN else base),)
    if code == "IncreasePowerSuperEffective":
        return (base * 4 / 3.0 if typemod > 1 else float(base),)
    if code == "RandomPowerDoublePowerIfTargetUnderground":
        return tuple(float(each) for each in MAGNITUDE_POWERS)
    if code == "RandomlyDamageOrHealTarget":
        return tuple(float(each) for each in PRESENT_POWERS)
    if code == "RandomlyDealsDoubleDamage":
        return doubled(base, None)
    if code == WEATHER_BALL:
        return doubled(base, weather_for(hit, hit.user_item) != NO_WEATHER)
    if code == TERRAIN_PULSE:
        state = terms.terrain != NO_TERRAIN and grounded(
            hit, hit.user, hit.user_ability, hit.user_item
        )
        return doubled(base, state)
    return None


@functools.lru_cache(maxsize=8)
def mega_stones(connection: sqlite3.Connection) -> dict[str, tuple[tuple[int, int, str], ...]]:
    found: dict[str, list[tuple[int, int, str]]] = {}
    for each in gamedb.entries(connection, "species"):
        stone = each.raw["@mega_stone"]
        if stone:
            found.setdefault(each.raw["@species"], []).append(
                (each.raw["@form"], each.raw["@unmega_form"], stone)
            )
    return {species: tuple(stones) for species, stones in found.items()}


def unlosable(connection: sqlite3.Connection, battler: Combatant, item: str) -> bool | None:
    if MAIL_FLAGS.intersection(item_flags(connection).get(item, ())):
        return True
    for form, unmega, stone in mega_stones(connection).get(battler.species, ()):
        if stone == item and battler.form in (form, unmega):
            return True
    if item not in UNLOSABLE_ITEMS.get(battler.species, ()):
        return False
    needed = UNLOSABLE_ABILITIES.get(battler.species)
    if needed is None:
        return True
    if battler.ability_hidden:
        options = battler.ability_options
        return None if options is None or needed in options else False
    return battler.ability == needed


def item_power(connection: sqlite3.Connection, hit: Strike, code: str) -> tuple[float, ...] | None:
    base = hit.move.power
    if code == KNOCK_OFF:
        boosted = float(ruby_round(base * KNOCK_OFF_BOOST))
        target = hit.target
        if target.item is None:
            return (float(base), boosted) if target.item_hidden else (float(base),)
        state = unlosable(connection, target, target.item)
        if state is None:
            return (float(base), boosted)
        return (float(base),) if state else (boosted,)
    if code == FLING:
        return (float(fling_powers(connection).get(hit.user.item or "", FLING_FLOOR)),)
    return None


def fling_fails(connection: sqlite3.Connection, hit: Strike) -> bool | None:
    item = hit.user.item
    if item is None or hit.user_item is None:
        return True
    state = unlosable(connection, hit.user, item)
    if state is True or item not in fling_powers(connection):
        return True
    if BERRY_FLAG in item_flags(connection).get(item, ()) and hit.target_ability in BERRY_BLOCKERS:
        return True
    return None if state is None else False


@functools.lru_cache(maxsize=8)
def beat_up_bounds(connection: sqlite3.Connection) -> tuple[int, int]:
    attacks = [each.raw["@base_stats"][ATTACK] for each in gamedb.entries(connection, "species")]
    return min(attacks), max(attacks)


def beat_up_power(attack: int) -> int:
    return BEAT_UP_BASE + attack // BEAT_UP_DIVISOR


def ash_greninja(battler: Combatant) -> bool:
    return (battler.species, battler.form) == ASH_GRENINJA


def hit_power(connection: sqlite3.Connection, hit: Strike, code: str) -> tuple[float, ...] | None:
    if code in RISING_HITS:
        return (float(hit.move.power * (hit.hit_index + 1)),)
    if code == BEAT_UP:
        team = hit.user.team
        if team is not None and hit.hit_index < len(team):
            return (float(beat_up_power(team[hit.hit_index])),)
        low, high = beat_up_bounds(connection)
        return spread(beat_up_power(low), beat_up_power(high))
    if code == WATER_SHURIKEN and ash_greninja(hit.user):
        return (float(ASH_SHURIKEN_POWER),)
    return None


def flag(value: Known[bool]) -> bool | None:
    return None if isinstance(value, Hidden) else value


def last_round(hit: Strike, code: str) -> bool | None:
    effects = hit.user.effects
    if effects is None:
        return None
    if code == STOMPING_TANTRUM:
        return effects.last_round_move_failed
    if effects.ally_fainted_last_round and hit.terms.attacker_side_size > 1:
        return None
    return effects.ally_fainted_last_round


def round_used(hit: Strike) -> bool | None:
    found = flag(hit.terms.history.round_used)
    if found is None and hit.terms.attacker_side_size == 1:
        return False
    return found


def history_power(hit: Strike, code: str) -> tuple[float, ...] | None:
    history, base = hit.terms.history, hit.move.power
    states = {
        TARGET_ACTED: lambda: flag(history.target_acted),
        TARGET_NOT_ACTED: lambda: flag(history.target_acted),
        ASSURANCE: lambda: flag(history.target_damaged),
        REVENGE: lambda: flag(history.hurt_by_target),
        LASH_OUT: lambda: flag(history.stats_lowered),
        PURSUIT: lambda: flag(history.switching),
        ROUND: lambda: round_used(hit),
        STOMPING_TANTRUM: lambda: last_round(hit, code),
        RETALIATE: lambda: last_round(hit, code),
    }
    if code not in states:
        return None
    state = states[code]()
    if code == TARGET_NOT_ACTED and state is not None:
        state = not state
    return doubled(base, state)


def fusion_mults(hit: Strike, code: str) -> tuple[float, ...]:
    history = hit.terms.history
    state = flag(history.fusion_flare if code == FUSION_BOLT else history.fusion_bolt)
    if state is None:
        return (1.0, 2.0)
    return (2.0,) if state else (1.0,)


def move_power(connection: sqlite3.Connection, hit: Strike, typemod: float) -> Power:
    code = hit.move.function_code
    bases = (
        hp_power(hit, code)
        or battler_power(hit, code)
        or field_power(hit, code, typemod)
        or hit_power(connection, hit, code)
        or item_power(connection, hit, code)
        or sky_power(connection, hit, code)
        or history_power(hit, code)
        or usage_power(hit, code)
        or speed_power(hit, code)
        or (float(hit.move.power),)
    )
    power_mults = (1.0,)
    final_mults = (1.0,)
    if code in (FUSION_BOLT, FUSION_FLARE):
        power_mults = fusion_mults(hit, code)
    if code == "DoublePowerIfUserHasNoItem":
        user = hit.user
        gem = hit.user_item in GEMS and GEMS[hit.user_item] == hit.move.type
        bare = user.item is None or gem
        power_mults = (1.0, 2.0) if user.item_hidden else ((2.0,) if bare else (1.0,))
    if code == "TwoTurnAttackOneTurnInSun" and weather_for(hit, hit.user_item) not in (
        NO_WEATHER,
        *SUN_WEATHERS,
    ):
        power_mults = (0.5,)
    final = hidden_target_mult(connection, hit, code)
    if code in GRASSY_HALVED and hit.terms.terrain == GRASSY_TERRAIN:
        final /= 2
    if final != 1.0:
        final_mults = (final,)
    return Power(bases, power_mults, final_mults)


def fury_cutter_top(power: int) -> int:
    top = 1
    while power << (top - 1) < FURY_CUTTER_CAP:
        top += 1
    return top


def rollout_shifts(effects: BattlerEffects | None) -> range:
    if effects is None:
        return range(ROLLOUT_TURNS + 1)
    shift = 0 if effects.rollout == 0 else ROLLOUT_TURNS - effects.rollout
    shift += effects.defense_curl
    return range(shift, shift + 1)


def own_pp(hit: Strike) -> int | None:
    found = hit.user.pp
    return None if found is None else found.get(hit.move.id)


def pressured(hit: Strike) -> tuple[bool, ...]:
    target = hit.target
    if target.ability_hidden and PRESSURE in (target.ability_options or ()):
        return (False, True)
    return (hit.target_ability == PRESSURE,)


def trump_card_power(hit: Strike) -> tuple[float, ...]:
    pp = own_pp(hit)
    if pp is None:
        return tuple(float(each) for each in sorted(set(TRUMP_CARD_POWERS)))
    top = len(TRUMP_CARD_POWERS) - 1
    lefts = {min(max(pp - 1 - extra, 0), top) for extra in pressured(hit)}
    return tuple(float(TRUMP_CARD_POWERS[left]) for left in sorted(lefts))


def counted(base: int, step: int, counts: range, cap: int | None = None) -> tuple[float, ...]:
    found = {base + step * each for each in counts}
    return tuple(float(each if cap is None else min(each, cap)) for each in sorted(found))


def rage_hits(hit: Strike, effects: BattlerEffects | None) -> range:
    spread_to_cap = max(RAGE_FIST_CAP - hit.move.power, 0) // RAGE_FIST_STEP + 2
    if effects is None:
        return range(spread_to_cap)
    start = effects.times_hit
    hurt = flag(hit.terms.history.hurt_by_target)
    if hurt is False and not hit.terms.others:
        return range(start, start + 1)
    low = start + (1 if hurt else 0)
    return range(low, low + spread_to_cap)


def usage_power(hit: Strike, code: str) -> tuple[float, ...] | None:
    effects, base = hit.user.effects, hit.move.power
    if code == FURY_CUTTER:
        top = fury_cutter_top(base)
        uses = range(1, top + 1) if effects is None else [min(effects.fury_cutter + 1, top)]
        return tuple(float(base << (each - 1)) for each in uses)
    if code == ECHOED_VOICE:
        if effects is None:
            return tuple(float(base * each) for each in range(1, ECHOED_VOICE_MAX + 1))
        count = effects.echoed_voice
        if not effects.echoed_voice_used:
            count = min(count + 1, ECHOED_VOICE_MAX)
        return (float(base * count),)
    if code == ROLLOUT:
        return tuple(float(base * 2**each) for each in rollout_shifts(effects))
    if code == SPIT_UP:
        piles = range(1, STOCKPILE_MAX + 1) if effects is None else [effects.stockpile]
        return tuple(float(STOCKPILE_POWER * each) for each in piles)
    if code == TRUMP_CARD:
        return trump_card_power(hit)
    if code == RAGE_FIST:
        return counted(base, RAGE_FIST_STEP, rage_hits(hit, effects), RAGE_FIST_CAP)
    if code == LAST_RESPECTS:
        if effects is None:
            fainted = range(max(hit.terms.attacker_party, 1))
        else:
            allies = hit.terms.attacker_side_size - 1
            fainted = range(effects.fainted_allies, effects.fainted_allies + allies + 1)
        return counted(base, LAST_RESPECTS_STEP, fainted)
    return None


def speed_abilities(battler: Combatant, other: Combatant) -> tuple[str | None, ...]:
    if battler.ability_hidden and battler.ability_options is not None:
        return tuple(
            dict.fromkeys(
                ability_of(replace(battler, ability=each, ability_hidden=False), other)
                for each in battler.ability_options
            )
        )
    return (ability_of(battler, other),)


def speed_items(
    battler: Combatant, ability: str | None, terms: Conditions
) -> tuple[tuple[str | None, bool], ...]:
    if battler.item_hidden and battler.item is None:
        held = [
            (each, False)
            for each in sorted(SPEED_ITEMS)
            if item_of(replace(battler, item=each), ability, terms) is not None
        ]
        return ((None, True), *held)
    return ((item_of(battler, ability, terms), battler.item is None),)


def either(state: bool | None, mult: float) -> tuple[float, ...]:
    if state is None:
        return (1.0, mult)
    return (mult,) if state else (1.0,)


def effect_state(effects: BattlerEffects | None, test: str) -> bool | None:
    if effects is None:
        return None
    if test == "slow_start":
        return effects.slow_start > 0
    if test == "paradox":
        return effects.paradox_stat == SPEED and not effects.transformed
    if test == "first_turn":
        return effects.turn_count == 0
    if test == "unburden":
        return effects.unburden
    return not effects.transformed


def ability_speed(
    battler: Combatant, ability: str | None, bare: bool, weather: str, terms: Conditions
) -> tuple[float, ...]:
    effects = battler.effects
    if ability in SPEED_WEATHER_ABILITIES:
        return either(weather in SPEED_WEATHER_ABILITIES[ability], SPEED_DOUBLE)
    if ability == "SURGESURFER":
        return either(terms.terrain == ELECTRIC_TERRAIN, SPEED_DOUBLE)
    if ability == QUICK_FEET:
        return either(any_status(battler), SPEED_BOOST)
    if ability == "SLOWSTART":
        return either(effect_state(effects, "slow_start"), SPEED_HALF)
    if ability in PARADOX_ABILITIES:
        return either(effect_state(effects, "paradox"), SPEED_BOOST)
    if ability == "ACOMETIDA":
        return either(effect_state(effects, "first_turn"), SPEED_BOOST)
    if ability == "UNBURDEN" and bare:
        return either(effect_state(effects, "unburden"), SPEED_DOUBLE)
    return (1.0,)


def item_speed(battler: Combatant, item: str | None) -> tuple[float, ...]:
    if item == CHOICE_SCARF:
        return (SPEED_BOOST,)
    if item in HALF_SPEED_ITEMS:
        return (SPEED_HALF,)
    if item == QUICK_POWDER and battler.species == QUICK_POWDER_SPECIES:
        return either(effect_state(battler.effects, "untransformed"), SPEED_DOUBLE)
    if item == SUPER_EVIOLITE:
        return either(battler.evolutions > 1, SPEED_BOOST)
    return (1.0,)


def speed_mults(
    battler: Combatant, other: Combatant, terms: Conditions, weather: str, side: tuple[bool, bool]
) -> set[float]:
    tailwind, swamp = side
    found = set()
    for ability in speed_abilities(battler, other):
        for item, bare in speed_items(battler, ability, terms):
            own_weather = (
                NO_WEATHER
                if weather in UMBRELLA_WEATHERS and item == "UTILITYUMBRELLA"
                else weather
            )
            for first in ability_speed(battler, ability, bare, own_weather, terms):
                for second in item_speed(battler, item):
                    mult = first * second
                    if tailwind:
                        mult *= SPEED_DOUBLE
                    if swamp:
                        mult *= SPEED_HALF
                    if battler.status == STATUS_PARALYSIS and ability != QUICK_FEET:
                        mult *= SPEED_HALF
                    found.add(mult)
    return found


def effective_speed(
    battler: Combatant, other: Combatant, terms: Conditions, *, attacker: bool
) -> Span:
    weather = terms.weather
    if ability_of(battler, other) in WEATHER_NEGATORS or ability_of(other, battler) in (
        WEATHER_NEGATORS
    ):
        weather = NO_WEATHER
    side = (
        (terms.attacker_tailwind, terms.attacker_swamp)
        if attacker
        else (terms.defender_tailwind, terms.defender_swamp)
    )
    mults = speed_mults(battler, other, terms, weather, side)
    found = staged_span(battler, SPEED)
    return Span(
        max(ruby_round(found.low * min(mults)), 1), max(ruby_round(found.high * max(mults)), 1)
    )


def gyro_ball(target: int, user: int) -> int:
    return max(min(GYRO_BALL_SCALE * target // user, GYRO_BALL_CAP), 1)


def speed_power(hit: Strike, code: str) -> tuple[float, ...] | None:
    if code not in SPEED_FUNCTIONS:
        return None
    user = effective_speed(hit.user, hit.target, hit.terms, attacker=True)
    target = effective_speed(hit.target, hit.user, hit.terms, attacker=False)
    if code == GYRO_BALL:
        return spread(gyro_ball(target.low, user.high), gyro_ball(target.high, user.low))
    low = min(user.low // target.high, ELECTRO_BALL_TOP)
    high = min(user.high // target.low, ELECTRO_BALL_TOP)
    return tuple(
        float(stepped(each, ELECTRO_BALL_POWERS, ELECTRO_BALL_FLOOR))
        for each in range(low, high + 1)
    )


def taken(code: str, history: History) -> Known[int | None]:
    return {
        COUNTER: history.counter,
        MIRROR_COAT: history.mirror_coat,
        METAL_BURST: history.foe_hp_lost,
        BIDE: history.bide,
    }[code]


def countered(hit: Strike) -> Span:
    found = taken(hit.move.function_code, hit.terms.history)
    if isinstance(found, Hidden):
        return Span(1, max(hit.target.stats[HP].high, 1))
    amount = found or 0
    return Span.exact(
        max(amount * 3 // 2 if hit.move.function_code == METAL_BURST else amount * 2, 1)
    )


def counter_fails(hit: Strike) -> bool | None:
    found = taken(hit.move.function_code, hit.terms.history)
    if isinstance(found, Hidden):
        return None
    return found is None or (hit.move.function_code == BIDE and found == 0)


def fails(connection: sqlite3.Connection, hit: Strike) -> bool | None:
    code = hit.move.function_code
    user, target = hit.user, hit.target
    if hit.no_berry:
        return True
    if code in COUNTER_FUNCTIONS:
        return counter_fails(hit)
    if code == SPIT_UP:
        return None if user.effects is None else user.effects.stockpile == 0
    if code == TRUMP_CARD:
        return own_pp(hit) == 0
    if code in PLEDGE_COMBOS:
        unknown = isinstance(hit.terms.history.pledge, Hidden)
        return None if unknown and hit.terms.attacker_side_size > 1 else False
    if code == FLING:
        return fling_fails(connection, hit)
    if code == EXPLOSION and not hit.mold_breaker:
        return DAMP in (hit.user_ability, hit.target_ability)
    if code == BEAT_UP and user.team == ():
        return True
    if code == SKY_DROP:
        return weight(target, hit.target_ignorable, hit.target_item) >= SKY_DROP_WEIGHT
    if code == "LowerTargetHPToUserHP":
        if user.hp.low >= target.hp.high:
            return True
        return False if user.hp.high < target.hp.low else None
    if code in OHKO_FUNCTIONS:
        if target.level > user.level or hit.target_ignorable == SURVIVAL_ABILITY:
            return True
        return code == "OHKOIce" and "ICE" in target.types
    return False


def fixed_damage(connection: sqlite3.Connection, hit: Strike) -> Span | None:
    code = hit.move.function_code
    if code in COUNTER_FUNCTIONS:
        found = countered(hit)
        return Span(0 if fails(connection, hit) is None else found.low, found.high)
    if code not in FIXED_DAMAGE_FUNCTIONS:
        return None
    user, target = hit.user, hit.target
    found = {
        "FixedDamage20": Span.exact(20),
        "FixedDamage40": Span.exact(40),
        "FixedDamageHalfTargetHP": Span(
            ruby_round(target.hp.low / 2.0), ruby_round(target.hp.high / 2.0)
        ),
        "FixedDamageUserLevel": Span.exact(user.level),
        "FixedDamageUserLevelRandom": Span(user.level // 2, user.level * 3 // 2),
        "LowerTargetHPToUserHP": Span(target.hp.low - user.hp.high, target.hp.high - user.hp.low),
        "UserFaintsFixedDamageUserHP": user.hp,
    }.get(code, target.stats[HP])
    low = 0 if fails(connection, hit) is None else max(found.low, 1)
    return Span(low, max(found.high, 1))


def parental(hit: Strike) -> bool:
    code = hit.move.function_code
    return (
        hit.user_ability == "PARENTALBOND"
        and code not in MULTI_HIT_FUNCTIONS | SINGLE_HIT_FUNCTIONS | CHARGING_FUNCTIONS
        and hit.terms.targets == 1
    )


def hit_count(hit: Strike) -> Span:
    code = hit.move.function_code
    skill = hit.user_ability == "SKILLLINK"
    dice = hit.user_item == LOADED_DICE
    sure = skill or dice or hit.move.accuracy == 0
    if code in TWO_HITS:
        return Span.exact(2)
    if code in THREE_HITS:
        return Span.exact(3)
    if code in RISING_HITS:
        return Span(3 if sure else 1, 3)
    if code == TEN_HITS:
        return Span(*LOADED_DICE_TEN) if dice else Span(10 if sure else 1, 10)
    if code == WATER_SHURIKEN and dice:
        return Span(*LOADED_DICE_FIVE)
    if code == WATER_SHURIKEN and ash_greninja(hit.user):
        return Span.exact(ASH_SHURIKEN_HITS)
    if code in TWO_TO_FIVE_HITS:
        if skill:
            return Span.exact(SKILL_LINK_HITS)
        return Span(*LOADED_DICE_FIVE) if dice else Span(*TWO_TO_FIVE)
    if code == BEAT_UP:
        team = hit.user.team
        return Span(1, MAX_PARTY) if team is None else Span.exact(len(team))
    if code == DRAGON_DARTS:
        return Span.exact(2) if hit.terms.defender_side_size == 1 else Span(1, 2)
    return Span.exact(2) if parental(hit) else Span.exact(1)


def crit_blocked(hit: Strike) -> bool | None:
    if hit.terms.lucky_chant or hit.target_ignorable in CRIT_BLOCKERS:
        return True
    target = hit.target
    if target.ability_hidden and not hit.mold_breaker:
        options = target.ability_options
        if options is None or CRIT_BLOCKERS.intersection(options):
            return None
    return False


def always_critical(hit: Strike) -> bool | None:
    effects = hit.user.effects
    focused = effects is not None and effects.laser_focus > 0
    if hit.move.function_code not in ALWAYS_CRITICAL_FUNCTIONS and not focused:
        return False
    blocked = crit_blocked(hit)
    return None if blocked is None else not blocked


def later(hit: Strike, index: int, dealt: Span, typemod: float) -> Strike:
    if index == 0:
        return hit
    target = hit.target
    hp = Span(max(target.hp.low - dealt.high, 1), max(target.hp.high - dealt.low, 1))
    if berry_weakens(hit, typemod):
        target = replace(target, item=None)
        hit = replace(hit, target_item=None)
    return replace(hit, target=replace(target, hp=hp, hp_percent=None), hit_index=index)


def hit_spans(
    connection: sqlite3.Connection,
    hit: Strike,
    typemod: float,
    rolls: tuple[int, ...],
    critical: bool,
) -> tuple[Span, ...]:
    fixed = fixed_damage(connection, hit)
    if fixed is not None:
        return tuple(fixed for _ in rolls)
    power = move_power(connection, hit, typemod)
    spans = tuple(roll_span(hit, Hit(roll, typemod, critical), power) for roll in rolls)
    if hit.move.function_code in HEALING_DRAWS or fails(connection, hit) is None:
        spans = tuple(Span(0, span.high) for span in spans)
    return spans


def chain(
    connection: sqlite3.Connection,
    hit: Strike,
    typemod: float,
    count: int,
    rolls: tuple[int, ...],
    critical: bool,
) -> tuple[tuple[Span, ...], ...]:
    found = []
    dealt = Span.exact(0)
    for index in range(count):
        spans = hit_spans(connection, later(hit, index, dealt, typemod), typemod, rolls, critical)
        found.append(spans)
        dealt = Span(
            dealt.low + min(span.low for span in spans),
            dealt.high + max(span.high for span in spans),
        )
    return tuple(found)


def joined_hits(
    found: list[tuple[tuple[Span, ...], ...]], width: int
) -> tuple[tuple[Span, ...], ...]:
    count = max((len(each) for each in found), default=0)
    zero = tuple(Span.exact(0) for _ in range(width))
    return tuple(
        joined([each[index] if index < len(each) else zero for each in found])
        for index in range(count)
    )


def plain_chain(
    connection: sqlite3.Connection,
    hit: Strike,
    typemod: float,
    count: int,
    rolls: tuple[int, ...],
) -> tuple[tuple[Span, ...], ...]:
    state = always_critical(hit)
    if state is not None:
        return chain(connection, hit, typemod, count, rolls, state)
    both = [chain(connection, hit, typemod, count, rolls, each) for each in (False, True)]
    return joined_hits(both, len(rolls))


def outcome(
    connection: sqlite3.Connection,
    hit: Strike,
    rolls: tuple[int, ...] = ROLLS,
    crits: bool = True,
) -> Outcome:
    typemod = type_mod(connection, hit)
    immune = immunity(hit, typemod) if typemod != 0 else None
    failed = immune is None and typemod != 0 and fails(connection, hit) is True
    if immune is not None or failed or typemod == 0:
        zero = tuple(Span.exact(0) for _ in rolls)
        crit_zero = zero if crits else ()
        return Outcome(
            typemod, immune, failed, zero, crit_zero, Span.exact(0), (zero,), (crit_zero,)
        )
    count = hit_count(hit)
    plain = plain_chain(connection, hit, typemod, count.high, rolls)
    critical = crit_blocked(hit) is not True
    crit = chain(connection, hit, typemod, count.high, rolls, critical) if crits else ((),)
    return Outcome(typemod, None, False, plain[0], crit[0], count, plain, crit)


def joined(spans: list[tuple[Span, ...]]) -> tuple[Span, ...]:
    return tuple(
        Span(min(each.low for each in column), max(each.high for each in column))
        for column in zip(*spans, strict=True)
    )


def outcomes(
    connection: sqlite3.Connection,
    hits: list[Strike],
    rolls: tuple[int, ...] = ROLLS,
    crits: bool = True,
) -> tuple[Strike, Outcome]:
    found = [(hit, outcome(connection, hit, rolls, crits)) for hit in hits]
    if len(found) == 1:
        return found[0]
    worst, top = max(found, key=lambda each: total(each[1].hits, each[1].hit_rolls).high)
    landed = [each for _, each in found if each.immune is None and not each.fails]
    plain = joined_hits([each.hit_rolls for _, each in found], len(rolls))
    crit = joined_hits([each.hit_crit_rolls for _, each in found], len(rolls) if crits else 0)
    merged = Outcome(
        top.typemod,
        None if landed else top.immune,
        not landed and top.fails,
        plain[0],
        crit[0],
        Span(min(each.hits.low for _, each in found), max(each.hits.high for _, each in found)),
        plain,
        crit,
    )
    return worst, merged


def total(hits: Span, per_hit: tuple[tuple[Span, ...], ...]) -> Span:
    if not per_hit or not per_hit[0]:
        return Span.exact(0)
    return Span(
        sum(min(span.low for span in spans) for spans in per_hit[: hits.low]),
        sum(max(span.high for span in spans) for spans in per_hit[: hits.high]),
    )


def hp_lost(move: Move, target: Combatant, dealt: Span) -> Span:
    if move.function_code not in NON_LETHAL_FUNCTIONS:
        return dealt
    return Span(
        max(min(dealt.low, target.hp.low - 1), 0), max(min(dealt.high, target.hp.high - 1), 0)
    )


def quick_span(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> Span:
    hits = strikes(connection, move, user, target, terms)
    _, found = outcomes(connection, hits, (ROLLS[0], ROLLS[-1]), crits=False)
    return hp_lost(move, target, total(found.hits, found.hit_rolls))


def may_have(hit: Strike, abilities: frozenset[str]) -> bool:
    user = hit.user
    if not user.ability_hidden:
        return False
    return user.ability_options is None or bool(abilities.intersection(user.ability_options))


def capped(amount: Span, hp: Span) -> Span:
    return Span(min(amount.low, hp.low), min(amount.high, hp.high))


def recoil(hit: Strike, dealt: Span, landed: bool) -> Span | None:
    code = hit.move.function_code
    if code not in RECOIL_DIVISORS and code != RECOIL_TOTAL_HP:
        return None
    blockers = RECOIL_BLOCKERS | {MAGIC_GUARD}
    if not landed or hit.user_ability in blockers:
        return Span.exact(0)
    if code == RECOIL_TOTAL_HP:
        hp = hit.user.stats[HP]
        amount = capped(Span(-(-hp.low // 2), -(-hp.high // 2)), hit.user.hp)
    else:
        divisor = RECOIL_DIVISORS[code]
        cover = substitute_hp(hit)
        target = hit.target.hp if cover is None else Span.exact(cover)
        amount = Span(
            max(ruby_round(min(dealt.low, target.low) / divisor), 1),
            max(ruby_round(min(dealt.high, target.high) / divisor), 1),
        )
    return Span(0, amount.high) if may_have(hit, blockers) else amount


def crash(hit: Strike) -> Span | None:
    if hit.move.function_code not in CRASH_FUNCTIONS:
        return None
    if hit.user_ability == MAGIC_GUARD:
        return Span.exact(0)
    hp = hit.user.stats[HP]
    amount = capped(Span(hp.low // 2, hp.high // 2), hit.user.hp)
    return Span(0, amount.high) if may_have(hit, frozenset({MAGIC_GUARD})) else amount


def change(base: Span, found: Span) -> float:
    if found.high == 0 and base.high > 0:
        return math.inf
    return abs(math.log((found.high + 1) / (base.high + 1)))


def risk_candidates(battler: Combatant) -> tuple[list[str], list[str]]:
    abilities: list[str] = []
    items: list[str] = []
    if battler.ability_hidden:
        pool = battler.ability_options
        abilities = sorted(
            MODELLED_ABILITIES if pool is None else MODELLED_ABILITIES.intersection(pool)
        )
    if battler.item_hidden:
        items = sorted(MODELLED_ITEMS)
    return abilities, items


def variant_risks(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
    base: Span,
) -> list[Risk]:
    chosen = []
    total = target.stats[HP]
    for role, battler in (("user", user), ("target", target)):
        abilities, items = risk_candidates(battler)
        if role == "user" and move.function_code == NATURAL_GIFT:
            items = [each for each in items if each in natural_gifts(connection)]
        if role == "user" and move.function_code == FLING:
            items = [each for each in items if each in fling_powers(connection)]
        groups = (
            [
                (NOT_MODELLED_ABILITY.format(ability=each), replace(battler, ability=each))
                for each in abilities
            ],
            [(NOT_MODELLED_ITEM.format(item=each), replace(battler, item=each)) for each in items],
        )
        for variants in groups:
            found = []
            for name, swapped in variants:
                pair = (swapped, target) if role == "user" else (user, swapped)
                span = quick_span(connection, move, pair[0], pair[1], terms)
                if span == base:
                    continue
                note = RISK_IMMUNE if span.high == 0 else None
                found.append(
                    (change(base, span), Risk(name, span, percent_span(span, total), note))
                )
            found.sort(key=lambda each: (-each[0], each[1].name))
            chosen += [risk for _, risk in found[:RISK_COUNT]]
    return chosen


def survival_risks(
    move: Move, user: Combatant, target: Combatant, terms: Conditions, base: Span, hits: Span
) -> list[Risk]:
    if at_full(target) is False or base.high < target.hp.low or hits.low > 1:
        return []
    found = []
    mold = strike(move, user, target, terms).mold_breaker
    options = target.ability_options
    if target.ability_hidden and not mold and (options is None or SURVIVAL_ABILITY in options):
        found.append(SURVIVAL_ABILITY)
    if target.item_hidden and not terms.magic_room:
        found.append(SURVIVAL_ITEM)
    survived = Span(base.low, min(base.high, max(target.hp.high - 1, 0)))
    names = {
        SURVIVAL_ABILITY: NOT_MODELLED_ABILITY.format(ability=SURVIVAL_ABILITY),
        SURVIVAL_ITEM: NOT_MODELLED_ITEM.format(item=SURVIVAL_ITEM),
    }
    total = target.stats[HP]
    return [
        Risk(names[each], survived, percent_span(survived, total), RISK_SURVIVES) for each in found
    ]


def risks(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
    base: Span,
    hits: Span,
) -> tuple[Risk, ...]:
    chosen = variant_risks(connection, move, user, target, terms, base)
    return tuple(chosen + survival_risks(move, user, target, terms, base, hits))


def damage(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> Damage:
    hits = strikes(connection, move, user, target, terms)
    worst, found = outcomes(connection, hits)
    typemod, immune, rolls, crit_rolls = found.typemod, found.immune, found.rolls, found.crit_rolls
    dealt = hp_lost(move, target, total(found.hits, found.hit_rolls))
    crit_total = hp_lost(move, target, total(found.hits, found.hit_crit_rolls))
    landed = immune is None and not found.fails and typemod != 0
    hp = target.stats[HP]
    return Damage(
        move=move.id,
        type=worst.move.type,
        category=worst.move.category,
        effectiveness=typemod,
        rolls=rolls,
        crit_rolls=crit_rolls,
        damage=dealt,
        crit_damage=crit_total,
        percent=percent_span(dealt, hp),
        crit_percent=percent_span(crit_total, hp),
        not_modelled=not_modelled(move, user, target, terms, found.hits.high > 1),
        immune=immune,
        risks=risks(connection, move, user, target, terms, dealt, found.hits),
        fails=found.fails,
        types=tuple(dict.fromkeys(hit.move.type for hit in hits)),
        hits=found.hits,
        hit_rolls=found.hit_rolls,
        hit_crit_rolls=found.hit_crit_rolls,
        recoil=recoil(worst, dealt, landed),
        crash=crash(worst),
        substitute=substitute_hp(worst) if landed else None,
    )


@dataclass(frozen=True)
class Threat:
    move: str
    source: str
    damage: Damage


def max_power(move: Move, ignore_multihit: bool = True) -> int:
    code = move.function_code
    if code in FIXED_MAX_POWERS:
        return FIXED_MAX_POWERS[code]
    if code in MAX_POWER_FACTORS:
        return move.power * MAX_POWER_FACTORS[code]
    if code == FIVE_HITS_CODE:
        return move.power if ignore_multihit else move.power * FIVE_HITS
    if code == SURGING_STRIKES:
        return int(move.power * CRITICAL_TRIPLE_HITS * CRIT_MULTIPLIER)
    return move.power


def plugin_ohko(move: Move) -> bool:
    return OHKO_MARK in move.function_code.lower() or any(
        OHKO_MARK in each.lower() for each in move.flags
    )


def level_window(level: int) -> int:
    for badges, cap in enumerate(BADGE_LEVEL_CAPS):
        if level <= cap:
            return badges
    return 0


def window_allows(move: Move, badges: int) -> bool:
    return badges >= EARLY_GAME_BADGES or max_power(move) <= EARLY_POWER_LIMIT


@functools.lru_cache(maxsize=8)
def drawable_moves(connection: sqlite3.Connection) -> tuple[Move, ...]:
    found = (gamedb.move(connection, each.id) for each in gamedb.entries(connection, "moves"))
    return tuple(
        move
        for move in found
        if move.allowed
        and move.category != STATUS_CATEGORY
        and move.id not in MOVE_BLACKLIST
        and not plugin_ohko(move)
    )


def move_pool(connection: sqlite3.Connection, badges: int) -> tuple[Move, ...]:
    return tuple(move for move in drawable_moves(connection) if window_allows(move, badges))


def foe_window(found: KnownFoe, badges: int) -> int:
    if found.trainer is not None or isinstance(found.level, Hidden):
        return badges
    return max(badges, level_window(found.level))


def knowable_moves(moves: tuple[LevelMove, ...], level: int) -> tuple[str, ...]:
    latest = list(
        reversed(dict.fromkeys(each.move for each in reversed(moves) if 0 <= each.level <= level))
    )
    return tuple(latest[-MAX_MOVES:])


def rolled_learnset(rolled: KnownRandom | None, found: KnownFoe) -> tuple[LevelMove, ...] | None:
    if found.trainer is not None or rolled is None or rolled.learnsets is None:
        return None
    if isinstance(found.species, Hidden):
        return None
    entry = rolled.learnsets.get(species_id(found.species.id, known(found.form, 0)))
    if entry is None or isinstance(entry, Hidden):
        return None
    return entry.moves


def ranked(
    connection: sqlite3.Connection,
    moves: list[Move],
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> list[Move]:
    unused = replace(user, effects=BattlerEffects())
    scored = [(quick_span(connection, move, unused, target, terms).high, move) for move in moves]
    scored.sort(key=lambda each: (-each[0], each[1].id))
    return [move for _, move in scored]


def strongest_by_type(moves: list[Move]) -> list[Move]:
    chosen: dict[str, Move] = {}
    for move in moves:
        chosen.setdefault(move.type, move)
    return list(chosen.values())


def assumed_moves(
    connection: sqlite3.Connection,
    found: KnownFoe,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
    badges: int,
    rolled: KnownRandom | None = None,
) -> list[Move]:
    revealed = {each for each in found.moves if not isinstance(each, Hidden)}
    unseen = sum(1 for each in found.moves if isinstance(each, Hidden))
    if unseen == 0:
        return []
    learnset = rolled_learnset(rolled, found)
    level = found.level
    if learnset is None or isinstance(level, Hidden):
        wide = [
            move
            for move in move_pool(connection, foe_window(found, badges))
            if move.id not in revealed and move.function_code not in COUNTER_FUNCTIONS
        ]
        return strongest_by_type(ranked(connection, wide, user, target, terms))[:unseen]
    knowable = [gamedb.move(connection, each) for each in knowable_moves(learnset, level)]
    chosen = ranked(
        connection,
        [move for move in knowable if move.id not in revealed and move.category != STATUS_CATEGORY],
        user,
        target,
        terms,
    )
    if not any(move.power > DAMAGING_POWER for move in knowable):
        pool = [
            move
            for move in move_pool(connection, badges)
            if move.id not in revealed and move.function_code not in COUNTER_FUNCTIONS
        ]
        added = ranked(connection, pool, user, target, terms)[:1]
        chosen = ranked(connection, chosen + added, user, target, terms)
    return chosen[:unseen]


def threats(
    connection: sqlite3.Connection,
    found: KnownFoe,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
    badges: int,
    rolled: KnownRandom | None = None,
) -> tuple[Threat, ...]:
    shown = [gamedb.move(connection, each) for each in found.moves if not isinstance(each, Hidden)]
    guessed = assumed_moves(connection, found, user, target, terms, badges, rolled)
    return tuple(
        Threat(move.id, source, damage(connection, move, user, target, terms))
        for source, moves in ((REVEALED_MOVE, shown), (ASSUMED_MOVE, guessed))
        for move in moves
        if move.category != STATUS_CATEGORY
    )


ACCURACY: Final = "ACCURACY"
EVASION: Final = "EVASION"
ACC_EVA_MULTIPLIERS: Final = (3, 3, 3, 3, 3, 3, 3, 4, 5, 6, 7, 8, 9)
ACC_EVA_DIVISORS: Final = (9, 8, 7, 6, 5, 4, 3, 3, 3, 3, 3, 3, 3)
PERCENT: Final = 100
OHKO_ICE: Final = "OHKOIce"
OHKO_ICE_PENALTY: Final = 10
RAIN_SURE_FUNCTIONS: Final = frozenset(
    {
        "ParalyzeTargetAlwaysHitsInRain",
        "BurnTargetAlwaysHitsInRain",
        "LowerTargetSpeed1AlwaysHitsInRain",
    }
)
SUN_UNSURE_FUNCTIONS: Final = frozenset(
    {
        "ParalyzeTargetAlwaysHitsInRainHitsDecreasesInSunTargetInSky",
        "ConfuseTargetAlwaysHitsInRainHitsTargetInSky",
    }
)
HAIL_SURE_FUNCTION: Final = "FreezeTargetAlwaysHitsInHail"
SUN_ACCURACY: Final = 50
TOXIC: Final = "BadPoisonTarget"
FUTURE_SIGHT: Final = "AttackTwoTurnsLater"
ACCURACY_FUNCTIONS: Final = (
    OHKO_FUNCTIONS
    | RAIN_SURE_FUNCTIONS
    | SUN_UNSURE_FUNCTIONS
    | STAGE_IGNORERS
    | {HAIL_SURE_FUNCTION, PURSUIT, TOXIC, FUTURE_SIGHT}
)
NO_GUARD: Final = "NOGUARD"
COMPOUND_EYES_BOOST: Final = 1.3
HUSTLE_ACCURACY: Final = 0.8
VICTORY_STAR_BOOST: Final = 1.1
EVASION_WEATHER_ABILITIES: Final = {"SANDVEIL": SAND, "SNOWCLOAK": SNOW}
EVASION_WEATHER_BOOST: Final = 1.25
EVASION_SEEING_ABILITIES: Final = frozenset({"KEENEYE", "MINDSEYE"})
ABSORB_ABILITIES: Final = {"LIGHTNINGROD": ELECTRIC, "STORMDRAIN": "WATER"}
WONDER_SKIN_ACCURACY: Final = 50
WIDE_LENS_BOOST: Final = 1.1
ZOOM_LENS_BOOST: Final = 1.2
EVASION_ITEMS: Final = frozenset({"BRIGHTPOWDER", "LAXINCENSE"})
EVASION_ITEM_ACCURACY: Final = 0.9
GRAVITY_ACCURACY: Final = 5 / 3.0
ACCURACY_USER_ITEMS: Final = frozenset({"WIDELENS", "ZOOMLENS"})
ACCURACY_TARGET_ITEMS: Final = EVASION_ITEMS
ACCURACY_ABILITIES: Final = frozenset(
    {
        NO_GUARD,
        "COMPOUNDEYES",
        "HUSTLE",
        "UNAWARE",
        "VICTORYSTAR",
        "TANGLEDFEET",
        "WONDERSKIN",
        *EVASION_SEEING_ABILITIES,
        *EVASION_WEATHER_ABILITIES,
        *ABSORB_ABILITIES,
    }
)

CRIT_RATIOS: Final = (24, 8, 2, 1)
CRIT_ALWAYS_STAGE: Final = 50
MERCILESS_STAGE: Final = 99
HIGH_CRIT_FLAG: Final = "HighCriticalHitRate"
SPACIAL_REND: Final = "SPACIALREND"
CRIT_ITEMS: Final = {
    "RAZORCLAW": ((), 1),
    "SCOPELENS": ((), 1),
    "LUCKYPUNCH": (("CHANSEY",), 2),
    "LEEK": (("FARFETCHD", "SIRFETCHD"), 2),
    "STICK": (("FARFETCHD", "SIRFETCHD"), 2),
}
CRIT_ABILITIES: Final = frozenset({"SUPERLUCK", "MERCILESS", *CRIT_BLOCKERS})

PRIORITY_TERRAINS: Final = {
    "HigherPriorityInGrassyTerrain": GRASSY_TERRAIN,
    "HigherPriorityInMistyTerrain": MISTY,
}
HEALING_FUNCTIONS: Final = frozenset(
    {
        "CureTargetStatusHealUserHalfOfTotalHP",
        "HealTargetDependingOnGrassyTerrain",
        "HealTargetHalfOfTotalHP",
        "HealUserAndAlliesQuarterOfTotalHP",
        "HealUserAndAlliesQuarterOfTotalHPCureStatus",
        "HealUserByHalfOfDamageDone",
        "HealUserByHalfOfDamageDoneBurnTarget",
        "HealUserByHalfOfDamageDoneIfTargetAsleep",
        "HealUserByTargetAttackLowerTargetAttack1",
        "HealUserByThreeQuartersOfDamageDone",
        "HealUserDependingOnSandstorm",
        "HealUserDependingOnUserStockpile",
        "HealUserDependingOnWeather",
        "HealUserFullyAndFallAsleep",
        "HealUserHalfOfTotalHP",
        "HealUserHalfOfTotalHPLoseFlyingTypeThisTurn",
        "HealUserPositionNextTurn",
        "RevivePokemonHalfHP",
        "UserFaintsHealAndCureReplacement",
        "UserFaintsHealAndCureReplacementRestorePP",
    }
)
PRIORITY_ABILITIES: Final = frozenset({"GALEWINGS", "PRANKSTER", "TRIAGE"})
TRIAGE_BOOST: Final = 3
BRACKET_ABILITIES: Final = frozenset({"STALL", "MYCELIUMMIGHT", "QUICKDRAW"})
SLOW_BRACKET_ITEMS: Final = frozenset({"LAGGINGTAIL", "FULLINCENSE"})
QUICK_CLAW: Final = "QUICKCLAW"
CUSTAP_BERRY: Final = "CUSTAPBERRY"
BRACKET_ITEMS: Final = SLOW_BRACKET_ITEMS | {QUICK_CLAW, CUSTAP_BERRY}
QUICK_CLAW_PERCENT: Final = 20
QUICK_DRAW_PERCENT: Final = 30
PINCH_DIVISOR: Final = 4
GLUTTONY_DIVISOR: Final = 2
UNNERVERS: Final = frozenset({"UNNERVE", "ASONECHILLINGNEIGH", "ASONEGRIMNEIGH"})
ORDER_ITEMS: Final = SPEED_ITEMS | BRACKET_ITEMS
USER_FIRST: Final = "user"
TARGET_FIRST: Final = "target"
EITHER_FIRST: Final = "depends"

TARGET_FOES: Final = "foes"
TARGET_ALLIES: Final = "allies"
TARGET_USER: Final = "user"
SPREAD_TARGETS: Final = {
    "AllNearFoes": frozenset({TARGET_FOES}),
    "AllFoes": frozenset({TARGET_FOES}),
    "AllNearOthers": frozenset({TARGET_FOES, TARGET_ALLIES}),
    "AllBattlers": frozenset({TARGET_FOES, TARGET_ALLIES, TARGET_USER}),
    "AllAllies": frozenset({TARGET_ALLIES}),
    "UserAndAllies": frozenset({TARGET_USER, TARGET_ALLIES}),
}
FOE_TARGETS: Final = frozenset({"NearFoe", "RandomNearFoe", "Foe", "NearOther", "Other"})
EXPANDING_FORCE: Final = "HitsAllFoesAndPowersUpInPsychicTerrain"
TARGET_FUNCTIONS: Final = frozenset({EXPANDING_FORCE, TERA_STARSTORM})
TARGET_NEUTRAL_FUNCTIONS: Final = frozenset(
    {"HealAllyOrDamageFoe", "CurseTargetOrLowerUserSpd1RaiseUserAtkDef1"}
)
PSYCHIC_TERRAIN: Final = "Psychic"
TERAPAGOS: Final = "TERAPAGOS"
TERAPAGOS_STELLAR: Final = 2
NOT_MODELLED_UNSEEN_ABILITY: Final = "the foe's unrevealed ability"
NOT_MODELLED_SEMI_INVULNERABLE: Final = "the target's semi-invulnerable state"
INVULNERABLE: Final = (
    UNDERGROUND | UNDERWATER | IN_SKY | {"TwoTurnAttackInvulnerableRemoveProtections"}
)


@dataclass(frozen=True)
class Chance:
    low: float
    high: float


@dataclass(frozen=True)
class Accuracy:
    move: str
    chance: Chance
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class Critical:
    move: str
    chance: Chance
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class Order:
    first: str
    reasons: tuple[str, ...]
    user_priority: Span
    target_priority: Span
    user_speed: Span
    target_speed: Span
    trick_room: bool
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class Targets:
    move: str
    target: str
    spread: bool
    battlers: tuple[int, ...]


def ability_variants(battler: Combatant) -> list[Combatant]:
    if not battler.ability_hidden or battler.ability_options is None:
        return [battler]
    return [
        replace(battler, ability=each, ability_hidden=False)
        for each in dict.fromkeys(battler.ability_options)
    ]


def item_variants(battler: Combatant, items: frozenset[str]) -> list[Combatant]:
    if not battler.item_hidden or battler.item is not None:
        return [battler]
    return [replace(battler, item_hidden=False)] + [
        replace(battler, item=each, item_hidden=False) for each in sorted(items)
    ]


def variants(battler: Combatant, items: frozenset[str]) -> list[Combatant]:
    return [found for each in ability_variants(battler) for found in item_variants(each, items)]


def unseen(battler: Combatant, abilities: frozenset[str]) -> bool:
    return battler.ability_hidden and (
        battler.ability_options is None or bool(abilities.intersection(battler.ability_options))
    )


def odds_named(user: Combatant, target: Combatant, terms: Conditions) -> list[str]:
    named = []
    for battler in (user, target):
        if battler.ability_hidden and battler.ability_options is None:
            named.append(NOT_MODELLED_UNSEEN_ABILITY)
        if battler.effects is None:
            named.append(NOT_MODELLED_FOE_EFFECTS)
    if terms.others:
        named.append(NOT_MODELLED_OTHERS)
    return list(dict.fromkeys(named))


def semi_invulnerable(connection: sqlite3.Connection, battler: Combatant) -> bool:
    effects = battler.effects
    if effects is None:
        return False
    return effects.sky_drop >= 0 or two_turn_code(connection, battler) in INVULNERABLE


def base_accuracy(hit: Strike) -> int:
    code = hit.move.function_code
    weather = weather_for(hit, hit.target_item)
    if code in SUN_UNSURE_FUNCTIONS and weather in SUN_WEATHERS:
        return SUN_ACCURACY
    if code in SUN_UNSURE_FUNCTIONS | RAIN_SURE_FUNCTIONS and weather in RAIN_WEATHERS:
        return 0
    if code == HAIL_SURE_FUNCTION and weather == SNOW:
        return 0
    return hit.move.accuracy


def acc_eva(stage: int) -> float:
    index = max(min(stage, STAGE_LIMIT), -STAGE_LIMIT) + STAGE_LIMIT
    return 100.0 * ACC_EVA_MULTIPLIERS[index] / ACC_EVA_DIVISORS[index]


def threshold(hit: Strike, base: int, acted: bool, confused: bool) -> float:
    move, user, target = hit.move, hit.user, hit.target
    damaging = move.category != STATUS_CATEGORY
    accuracy_stage = user.stages.get(ACCURACY, 0)
    evasion_stage = target.stages.get(EVASION, 0)
    accuracy_mult = evasion_mult = 1.0
    ability = hit.user_ability
    if ability == "COMPOUNDEYES":
        accuracy_mult *= COMPOUND_EYES_BOOST
    elif ability == "HUSTLE" and damaging:
        accuracy_mult *= HUSTLE_ACCURACY
    elif (ability in EVASION_SEEING_ABILITIES and evasion_stage > 0) or (
        ability == "UNAWARE" and damaging
    ):
        evasion_stage = 0
    elif ability == "VICTORYSTAR":
        accuracy_mult *= VICTORY_STAR_BOOST
    guarding = hit.target_ignorable
    weather = weather_for(hit, hit.target_item)
    if guarding in ABSORB_ABILITIES and move.type == ABSORB_ABILITIES[guarding]:
        base = 0
    elif guarding in EVASION_WEATHER_ABILITIES and weather == EVASION_WEATHER_ABILITIES[guarding]:
        evasion_mult *= EVASION_WEATHER_BOOST
    elif guarding == "TANGLEDFEET" and confused:
        accuracy_mult /= 2
    elif guarding == "UNAWARE" and damaging:
        accuracy_stage = 0
    elif guarding == "WONDERSKIN" and not damaging and base > WONDER_SKIN_ACCURACY:
        base = WONDER_SKIN_ACCURACY
    if hit.user_item == "WIDELENS":
        accuracy_mult *= WIDE_LENS_BOOST
    elif hit.user_item == "ZOOMLENS" and acted:
        accuracy_mult *= ZOOM_LENS_BOOST
    if hit.target_item in EVASION_ITEMS:
        accuracy_mult *= EVASION_ITEM_ACCURACY
    if hit.terms.gravity:
        accuracy_mult *= GRAVITY_ACCURACY
    effects = target.effects
    seen = effects is not None and (effects.foresight or effects.miracle_eye)
    if seen and evasion_stage > 0:
        evasion_stage = 0
    if move.function_code in STAGE_IGNORERS:
        evasion_stage = 0
    if base == 0:
        return 1.0
    accuracy = ruby_round(acc_eva(accuracy_stage) * accuracy_mult)
    evasion = max(ruby_round(acc_eva(evasion_stage) * evasion_mult), 1)
    return min(max(base * accuracy // evasion, 0), PERCENT) / PERCENT


def both_ways(state: Known[bool]) -> tuple[bool, ...]:
    return (False, True) if isinstance(state, Hidden) else (state,)


def confusion_states(battler: Combatant) -> tuple[bool, ...]:
    if battler.effects is None:
        return (False, True)
    return (battler.effects.confusion > 0,)


def hit_chances(hit: Strike) -> list[float]:
    move, user, target = hit.move, hit.user, hit.target
    code = move.function_code
    if NO_GUARD in (hit.user_ability, hit.target_ability):
        return [1.0]
    if code == TOXIC and move.category == STATUS_CATEGORY and POISON in user.types:
        return [1.0]
    effects = target.effects
    if effects is not None and effects.glaive_rush > 0:
        return [1.0]
    if code in OHKO_FUNCTIONS:
        penalty = OHKO_ICE_PENALTY if code == OHKO_ICE and "ICE" not in user.types else 0
        chance = move.accuracy + user.level - target.level - penalty
        return [min(max(chance, 0), PERCENT) / PERCENT]
    found = []
    if code == PURSUIT:
        switching = both_ways(hit.terms.history.switching)
        if True in switching:
            found.append(1.0)
        if False not in switching:
            return found
    if effects is not None and (
        effects.telekinesis > 0 or (effects.minimize and TRAMPLES_MINIMIZE in move.flags)
    ):
        return [1.0]
    base = base_accuracy(hit)
    if base == 0:
        return [1.0]
    for acted in both_ways(hit.terms.history.target_acted):
        for confused in confusion_states(target):
            found.append(threshold(hit, base, acted, confused))
    return found


def accuracy(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> Accuracy:
    found = [
        chance
        for attacker in variants(user, ACCURACY_USER_ITEMS)
        for defender in variants(target, ACCURACY_TARGET_ITEMS)
        for hit in typed(connection, strike(move, attacker, defender, terms))
        for chance in hit_chances(hit)
    ]
    named = odds_named(user, target, terms)
    if semi_invulnerable(connection, target):
        named.append(NOT_MODELLED_SEMI_INVULNERABLE)
    return Accuracy(move.id, Chance(min(found), max(found)), tuple(named))


def crit_bonus(move: Move) -> int:
    for flag in move.flags:
        if HIGH_CRIT_FLAG in flag:
            _, _, stage = flag.partition("_")
            return int(stage) if stage else 1
    return 0


def crit_odds(hit: Strike) -> float:
    if hit.terms.lucky_chant:
        return 0.0
    user, target = hit.user, hit.target
    stage = 0
    if hit.user_ability == "MERCILESS" and target.status == POISON:
        stage = MERCILESS_STAGE
    elif hit.user_ability == "SUPERLUCK":
        stage += 1
    if hit.target_ignorable in CRIT_BLOCKERS:
        return 0.0
    if hit.user_item in CRIT_ITEMS:
        species, bonus = CRIT_ITEMS[hit.user_item]
        if not species or user.species in species:
            stage += bonus
    if hit.move.function_code in ALWAYS_CRITICAL_FUNCTIONS or stage > CRIT_ALWAYS_STAGE:
        return 1.0
    effects = user.effects
    if effects is not None and effects.laser_focus > 0:
        return 1.0
    stage += crit_bonus(hit.move)
    if effects is not None:
        stage += effects.focus_energy
    if hit.move.id == SPACIAL_REND and user.species == "PALKIA" and user.form == 1:
        stage += 1
    return 1 / CRIT_RATIOS[min(stage, len(CRIT_RATIOS) - 1)]


def critical(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> Critical:
    found = [
        crit_odds(strike(move, attacker, defender, terms))
        for attacker in variants(user, frozenset(CRIT_ITEMS))
        for defender in ability_variants(target)
    ]
    if unseen(target, CRIT_BLOCKERS) and target.ability_options is None:
        hit = strike(move, user, target, terms)
        if not hit.mold_breaker:
            found.append(0.0)
    return Critical(move.id, Chance(min(found), max(found)), tuple(odds_named(user, target, terms)))


def grounded_user(battler: Combatant, terms: Conditions, other: Combatant) -> bool:
    ability = ability_of(battler, other)
    return not airborne(battler, ability, item_of(battler, ability, terms), terms, False)


def move_priorities(
    move: Move, battler: Combatant, other: Combatant, terms: Conditions
) -> tuple[int, ...]:
    base = move.priority
    terrain = PRIORITY_TERRAINS.get(move.function_code)
    if terrain is not None and terms.terrain == terrain and grounded_user(battler, terms, other):
        base += 1
    ability = ability_of(battler, other)
    if ability == "GALEWINGS" and move.type == FLYING:
        full = at_full(battler)
        return (base, base + 1) if full is None else (base + 1 if full else base,)
    if ability == "PRANKSTER" and move.category == STATUS_CATEGORY:
        return (base + 1,)
    if ability == "TRIAGE" and move.function_code in HEALING_FUNCTIONS:
        return (base + TRIAGE_BOOST,)
    return (base,)


def ability_brackets(ability: str | None, move: Move | None) -> tuple[int, ...]:
    if ability == "STALL":
        return (-1,)
    if move is None:
        return (0,)
    if ability == "MYCELIUMMIGHT" and move.category == STATUS_CATEGORY:
        return (-1,)
    if ability == "QUICKDRAW" and move.category != STATUS_CATEGORY:
        return (0, 1)
    return (0,)


def pinch_states(battler: Combatant, ability: str | None, other: Combatant) -> tuple[bool, ...]:
    if ability_of(other, battler) in UNNERVERS:
        return (False,)
    divisor = GLUTTONY_DIVISOR if ability == "GLUTTONY" else PINCH_DIVISOR
    state = at_most(battler, divisor)
    return (False, True) if state is None else (state,)


def item_brackets(
    battler: Combatant, ability: str | None, item: str | None, move: Move | None, other: Combatant
) -> tuple[int, ...]:
    if item in SLOW_BRACKET_ITEMS:
        return (-1,)
    if item == QUICK_CLAW:
        own = ability_brackets(ability, move) if ability == "MYCELIUMMIGHT" else (0,)
        return own if own != (0,) else (0, 1)
    if item == CUSTAP_BERRY:
        return tuple(1 if each else 0 for each in pinch_states(battler, ability, other))
    return (0,)


def brackets(
    battler: Combatant, move: Move | None, other: Combatant, terms: Conditions
) -> tuple[int, ...]:
    ability = ability_of(battler, other)
    item = item_of(battler, ability, terms)
    found = set()
    for first in ability_brackets(ability, move):
        for second in item_brackets(battler, ability, item, move, other):
            found.add(
                second if (first == 0 and second != 0) or (first < 0 and second >= 1) else first
            )
    return tuple(sorted(found))


@dataclass(frozen=True)
class Turn:
    battler: Combatant
    priorities: tuple[int, ...]
    brackets: tuple[int, ...]
    speed: Span
    assumed: str | None


def assumption(original: Combatant, found: Combatant) -> str | None:
    parts = []
    if original.ability_hidden and not found.ability_hidden:
        parts.append(f"ability {found.ability}")
    if original.item_hidden and not found.item_hidden:
        parts.append("no held item" if found.item is None else f"held item {found.item}")
    return f"if {' and '.join(parts)}" if parts else None


def turns(
    battler: Combatant,
    move: Move | None,
    other: Combatant,
    terms: Conditions,
    *,
    attacker: bool,
) -> list[Turn]:
    found = []
    for each in variants(battler, ORDER_ITEMS):
        found.append(
            Turn(
                battler=each,
                priorities=(0,) if move is None else move_priorities(move, each, other, terms),
                brackets=brackets(each, move, other, terms),
                speed=effective_speed(each, other, terms, attacker=attacker),
                assumed=assumption(battler, each),
            )
        )
    return found


def speed_outcome(ours: Span, theirs: Span, trick_room: bool) -> tuple[set[str], str]:
    room = "Trick Room: " if trick_room else ""
    shown = f"Speed {span_text(ours)} against {span_text(theirs)}"
    if ours.low == ours.high == theirs.low == theirs.high:
        return {USER_FIRST, TARGET_FIRST}, f"{room}speed tie at {ours.low}, random"
    if ours.low > theirs.high:
        return ({TARGET_FIRST} if trick_room else {USER_FIRST}), f"{room}{shown}"
    if ours.high < theirs.low:
        return ({USER_FIRST} if trick_room else {TARGET_FIRST}), f"{room}{shown}"
    return {USER_FIRST, TARGET_FIRST}, f"{room}{shown} overlap"


def span_text(found: Span) -> str:
    return str(found.low) if found.low == found.high else f"{found.low}-{found.high}"


def turn_outcomes(ours: Turn, theirs: Turn, trick_room: bool) -> tuple[set[str], list[str]]:
    outcomes: set[str] = set()
    reasons = []
    for mine in ours.priorities:
        for other in theirs.priorities:
            if mine != other:
                outcomes.add(USER_FIRST if mine > other else TARGET_FIRST)
                reasons.append(f"priority {mine:+d} against {other:+d}")
                continue
            for low in ours.brackets:
                for high in theirs.brackets:
                    if low != high:
                        outcomes.add(USER_FIRST if low > high else TARGET_FIRST)
                        reasons.append(bracket_reason(ours, theirs, low, high))
                        continue
                    found, why = speed_outcome(ours.speed, theirs.speed, trick_room)
                    outcomes |= found
                    reasons.append(why)
    prefix = " and ".join(each for each in (ours.assumed, theirs.assumed) if each)
    return outcomes, [f"{prefix}: {each}" if prefix else each for each in reasons]


def bracket_reason(ours: Turn, theirs: Turn, mine: int, other: int) -> str:
    names = []
    for label, turn, value in (("user", ours, mine), ("target", theirs, other)):
        if value == 0:
            continue
        held = [turn.battler.ability, turn.battler.item]
        causes = [each for each in held if each in BRACKET_ABILITIES | BRACKET_ITEMS] or [
            "its bracket"
        ]
        names.append(f"{label} {'first' if value > 0 else 'last'} in its bracket ({causes[0]})")
    return ", ".join(names)


def speed_order(
    user: Combatant,
    user_move: Move | None,
    target: Combatant,
    target_move: Move | None,
    terms: Conditions,
) -> Order:
    ours = turns(user, user_move, target, terms, attacker=True)
    theirs = turns(target, target_move, user, terms, attacker=False)
    results = [
        (
            mine.assumed is None and other.assumed is None,
            *turn_outcomes(mine, other, terms.trick_room),
        )
        for mine in ours
        for other in theirs
    ]
    outcomes = {each for _, found, _ in results for each in found}
    plain = [found for neutral, found, _ in results if neutral]
    usual = set().union(*plain) if plain else None
    reasons = [
        each
        for neutral, found, why in results
        if neutral or usual is None or found != usual
        for each in why
    ]
    first = next(iter(outcomes)) if len(outcomes) == 1 else EITHER_FIRST
    named = []
    for battler in (user, target):
        if battler.ability_hidden and battler.ability_options is None:
            named.append(NOT_MODELLED_UNSEEN_ABILITY)
        if battler.effects is None:
            named.append(NOT_MODELLED_FOE_EFFECTS)
    return Order(
        first=first,
        reasons=tuple(dict.fromkeys(reasons)),
        user_priority=priority_span(ours),
        target_priority=priority_span(theirs),
        user_speed=Span(min(t.speed.low for t in ours), max(t.speed.high for t in ours)),
        target_speed=Span(min(t.speed.low for t in theirs), max(t.speed.high for t in theirs)),
        trick_room=terms.trick_room,
        not_modelled=tuple(dict.fromkeys(named)),
    )


def priority_span(found: list[Turn]) -> Span:
    values = [each for turn in found for each in turn.priorities]
    return Span(min(values), max(values))


def move_target(move: Move, user: Combatant, terms: Conditions, side_size: int) -> str:
    code = move.function_code
    if code == EXPANDING_FORCE and terms.terrain == PSYCHIC_TERRAIN:
        ability = ability_of(user, user)
        if not airborne(user, ability, item_of(user, ability, terms), terms, False):
            return "AllNearFoes"
    stellar = user.species == TERAPAGOS and user.form == TERAPAGOS_STELLAR
    if code == TERA_STARSTORM and side_size > 1 and stellar:
        return "AllNearFoes"
    return move.target


def standing(battle: KnownBattle) -> list[tuple[int, bool]]:
    found = []
    for battler in battle.battlers:
        if isinstance(battler, Hidden):
            continue
        if isinstance(battler, KnownFoe):
            fainted = known(battler.fainted, False)
        else:
            fainted = battler.fainted
        if not fainted:
            found.append((battler.index, battler.index % 2 == 0))
    return found


def move_targets(
    move: Move, user: Combatant, user_index: int, battle: KnownBattle, terms: Conditions
) -> list[Targets]:
    ours = user_index % 2 == 0
    target = move_target(move, user, terms, battle.side_sizes[0])
    present = standing(battle)
    foes = [index for index, side in present if side != ours]
    allies = [index for index, side in present if side == ours and index != user_index]
    kinds = SPREAD_TARGETS.get(target)
    if kinds is not None:
        hit = sorted(
            (foes if TARGET_FOES in kinds else [])
            + (allies if TARGET_ALLIES in kinds else [])
            + ([user_index] if TARGET_USER in kinds else [])
        )
        return [Targets(move.id, target, True, tuple(hit))]
    if target in FOE_TARGETS:
        return [Targets(move.id, target, False, (index,)) for index in foes]
    return []


EOR_SIXTEENTH: Final = 16
EOR_EIGHTH: Final = 8
EOR_QUARTER: Final = 4
BINDING_BAND_DIVISOR: Final = 6
TOXIC_CAP: Final = 16
ROOT_BOOST: Final = 1.3
KO_ROUNDS: Final = 20
HEAL: Final = "heal"
LOSE: Final = "lose"
TOXIC_LOSS: Final = "toxic"
TRAP_LOSS: Final = "trap"
SAND_IMMUNE_TYPES: Final = frozenset({"GROUND", "ROCK", "STEEL"})
SAND_IMMUNE_ABILITIES: Final = frozenset({"OVERCOAT", "SANDFORCE", "SANDRUSH", "SANDVEIL"})
SAND_SHELTERS: Final = UNDERGROUND | UNDERWATER
SALT_CURE_TYPES: Final = frozenset({"STEEL", "WATER"})
SAFETY_GOGGLES: Final = "SAFETYGOGGLES"
UTILITY_UMBRELLA: Final = "UTILITYUMBRELLA"
BINDING_BAND: Final = "BINDINGBAND"
BIG_ROOT: Final = "BIGROOT"
STURDY_ROOT: Final = "STURDYROOT"
POISON_HEAL: Final = "POISONHEAL"
HEATPROOF: Final = "HEATPROOF"
HYDRATION: Final = "HYDRATION"
SHED_SKIN: Final = "SHEDSKIN"
HP_HEAL_ITEMS: Final = frozenset(
    {
        "AGUAVBERRY",
        "BERRYJUICE",
        "FIGYBERRY",
        "IAPAPABERRY",
        "MAGOBERRY",
        "ORANBERRY",
        "SITRUSBERRY",
        "WIKIBERRY",
    }
)
EFFECT_TURNS_MAX: Final = 5
TRAPPING_MAX: Final = 8
COUNTED_EFFECTS: Final = ("heal_block", "embargo", "magnet_rise", "telekinesis")
FOE_HARMS: Final = BattlerEffects(
    leech_seed=0,
    curse=True,
    nightmare=True,
    salt_cure=True,
    trapping=TRAPPING_MAX,
    heal_block=EFFECT_TURNS_MAX,
    magnet_rise=EFFECT_TURNS_MAX,
)
FOE_HELPS: Final = BattlerEffects(aqua_ring=True, ingrain=True)
NOT_MODELLED_UNSEEN_ITEM: Final = "the foe's unrevealed held item"
NOT_MODELLED_SUBSTITUTE: Final = "the target's substitute"


@dataclass(frozen=True)
class Step:
    kind: str
    amount: int = 0
    rounds: int = 0


@dataclass(frozen=True)
class Upkeep:
    total: int
    start: int
    rounds: tuple[tuple[Step, ...], ...]


@dataclass(frozen=True)
class EndOfTurn:
    change: Span
    hp: tuple[Span, ...]
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class KnockOut:
    fewest: int | None
    most: int | None


@dataclass(frozen=True)
class HitsToKO:
    plain: KnockOut
    crit: KnockOut
    end_of_turn: EndOfTurn
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class UpkeepState:
    battler: Combatant
    bad_poison: bool
    toxic: int
    band: bool


def upkeep_weather(
    battler: Combatant, other: Combatant, ability: str | None, item: str | None, terms: Conditions
) -> str:
    weather = terms.weather
    if ability in WEATHER_NEGATORS or ability_of(other, battler) in WEATHER_NEGATORS:
        return NO_WEATHER
    if weather in SUN_WEATHERS | RAIN_WEATHERS and item == UTILITY_UMBRELLA:
        return NO_WEATHER
    return weather


def weather_steps(
    connection: sqlite3.Connection,
    battler: Combatant,
    held: tuple[str | None, str | None],
    weather: str,
    total: int,
) -> list[Step]:
    steps = []
    ability, item = held
    indirect = ability != MAGIC_GUARD
    if ability == "DRYSKIN" and weather in SUN_WEATHERS and indirect:
        steps.append(Step(LOSE, total // EOR_EIGHTH))
    if ability == "DRYSKIN" and weather in RAIN_WEATHERS:
        steps.append(Step(HEAL, total // EOR_EIGHTH))
    if ability == "SOLARPOWER" and weather in SUN_WEATHERS and indirect:
        steps.append(Step(LOSE, total // EOR_EIGHTH))
    if ability == "RAINDISH" and weather in RAIN_WEATHERS:
        steps.append(Step(HEAL, total // EOR_SIXTEENTH))
    if ability == "ICEBODY" and weather == SNOW:
        steps.append(Step(HEAL, total // EOR_SIXTEENTH))
    sheltered = (
        SAND_IMMUNE_TYPES.intersection(battler.types)
        or two_turn_code(connection, battler) in SAND_SHELTERS
        or ability in SAND_IMMUNE_ABILITIES
        or item == SAFETY_GOGGLES
    )
    if weather == SAND and indirect and not sheltered:
        steps.append(Step(LOSE, total // EOR_SIXTEENTH))
    return steps


def root_heal(total: int, held: tuple[str | None, str | None]) -> int:
    ability, item = held
    gain = total // EOR_SIXTEENTH
    if item == BIG_ROOT:
        gain = math.floor(gain * ROOT_BOOST)
    if ability == STURDY_ROOT:
        gain = math.floor(gain * ROOT_BOOST)
    return gain


def status_steps(
    battler: Combatant, state: UpkeepState, ability: str | None, status: str, total: int
) -> list[Step]:
    indirect = ability != MAGIC_GUARD
    effects = battler.effects or BattlerEffects()
    steps = []
    if status == POISON and ability == POISON_HEAL:
        steps.append(Step(HEAL, total // EOR_EIGHTH))
    elif status == POISON and indirect:
        steps.append(
            Step(TOXIC_LOSS, state.toxic) if state.bad_poison else Step(LOSE, total // EOR_EIGHTH)
        )
    if status == BURN and indirect:
        loss = total // EOR_SIXTEENTH
        steps.append(Step(LOSE, ruby_round(loss / 2) if ability == HEATPROOF else loss))
    if not indirect:
        return steps
    if effects.nightmare and status == STATUS_SLEEP:
        steps.append(Step(LOSE, total // EOR_QUARTER))
    if effects.curse:
        steps.append(Step(LOSE, total // EOR_QUARTER))
    if effects.salt_cure:
        salted = SALT_CURE_TYPES.intersection(battler.types)
        steps.append(Step(LOSE, total // (EOR_QUARTER if salted else EOR_EIGHTH)))
    if effects.trapping > 0:
        divisor = BINDING_BAND_DIVISOR if state.band else EOR_EIGHTH
        steps.append(Step(TRAP_LOSS, total // divisor, effects.trapping))
    return steps


def counted_down(battler: Combatant, passed: int) -> Combatant:
    effects = battler.effects
    if effects is None or passed == 0:
        return battler
    update = {name: max(getattr(effects, name) - passed, 0) for name in COUNTED_EFFECTS}
    return replace(battler, effects=effects.model_copy(update=update))


def upkeep_steps(
    connection: sqlite3.Connection,
    battler: Combatant,
    other: Combatant,
    terms: Conditions,
    state: UpkeepState,
    total: int,
    cured: bool,
) -> tuple[Step, ...]:
    effects = battler.effects or BattlerEffects()
    ability = ability_of(battler, other)
    item = item_of(battler, ability, terms)
    held = (ability, item)
    weather = upkeep_weather(battler, other, ability, item, terms)
    steps = weather_steps(connection, battler, held, weather, total)
    grounded_here = not airborne(battler, ability, item, terms, False)
    if (
        terms.terrain == GRASSY_TERRAIN
        and grounded_here
        and not semi_invulnerable(connection, battler)
    ):
        steps.append(Step(HEAL, total // EOR_SIXTEENTH))
    status = battler.status
    if cured or (ability == HYDRATION and weather in RAIN_WEATHERS):
        status = NO_STATUS
    indirect = ability != MAGIC_GUARD
    if item == "LEFTOVERS":
        steps.append(Step(HEAL, total // EOR_SIXTEENTH))
    if item == "BLACKSLUDGE" and POISON in battler.types:
        steps.append(Step(HEAL, total // EOR_SIXTEENTH))
    elif item == "BLACKSLUDGE" and indirect:
        steps.append(Step(LOSE, total // EOR_EIGHTH))
    if effects.aqua_ring:
        steps.append(Step(HEAL, root_heal(total, held)))
    if effects.ingrain:
        steps.append(Step(HEAL, root_heal(total, held)))
    if effects.leech_seed >= 0 and indirect:
        steps.append(Step(LOSE, total // EOR_EIGHTH))
    steps.extend(status_steps(battler, state, ability, status, total))
    if effects.heal_block > 0:
        steps = [step for step in steps if step.kind != HEAL]
    return tuple(steps)


def upkeep_round(upkeep: Upkeep, hp: int, round_number: int) -> int:
    total = upkeep.total
    for step in upkeep.rounds[min(round_number, len(upkeep.rounds)) - 1]:
        if hp <= 0:
            return 0
        if step.kind == HEAL:
            if hp < total:
                hp += min(max(step.amount, 1), total - hp)
            continue
        amount = step.amount
        if step.kind == TOXIC_LOSS:
            amount = total * min(step.amount + round_number, TOXIC_CAP) // EOR_SIXTEENTH
        elif step.kind == TRAP_LOSS and step.rounds - round_number <= 0:
            continue
        hp -= min(max(amount, 1), hp)
    return max(hp, 0)


def hp_starts(battler: Combatant) -> list[tuple[int, int]]:
    total = battler.stats[HP]
    found = []
    for each in range(total.low, total.high + 1):
        if battler.hp_percent is not None:
            span = hp_from_percent(battler.hp_percent, Span.exact(each))
        elif total.low == total.high:
            span = battler.hp
        else:
            span = Span.exact(each)
        found.extend([(each, span.low), (each, span.high)])
    return list(dict.fromkeys(found))


def poison_states(battler: Combatant) -> list[tuple[bool, int]]:
    if battler.status != POISON:
        return [(False, 0)]
    if battler.effects is None:
        return [(False, 0), (True, 0), (True, TOXIC_CAP - 1)]
    return [(battler.effects.status_count > 0, battler.effects.toxic)]


def band_states(battler: Combatant, other: Combatant, terms: Conditions) -> list[bool]:
    if battler.effects is None or battler.effects.trapping <= 0:
        return [False]
    if other.item_hidden and other.item is None:
        return [False, True]
    return [item_of(other, ability_of(other, battler), terms) == BINDING_BAND]


def effect_variants(battler: Combatant) -> list[Combatant]:
    if battler.effects is not None:
        return [battler]
    return [
        replace(battler, effects=found.model_copy(update={"embargo": embargo}))
        for found in (BattlerEffects(), FOE_HARMS, FOE_HELPS)
        for embargo in (0, EFFECT_TURNS_MAX)
    ]


def upkeep_states(
    battler: Combatant, other: Combatant, terms: Conditions
) -> tuple[list[UpkeepState], list[str]]:
    named = []
    if battler.ability_hidden and battler.ability_options is None:
        named.append(NOT_MODELLED_UNSEEN_ABILITY)
    if battler.item_hidden and battler.item is None:
        named.append(NOT_MODELLED_UNSEEN_ITEM)
    if battler.effects is None:
        named.append(NOT_MODELLED_FOE_EFFECTS)
    if NOT_MODELLED_SCRIPTED_WILD in battler.not_modelled:
        named.append(NOT_MODELLED_SCRIPTED_WILD)
    if battler.item in HP_HEAL_ITEMS and not battler.item_hidden:
        named.append(NOT_MODELLED_ITEM.format(item=battler.item))
    states = []
    for each in ability_variants(battler):
        for bad, toxic in poison_states(battler):
            for found in effect_variants(each):
                for band in band_states(found, other, terms):
                    states.append(UpkeepState(found, bad, toxic, band))
    return states, named


def upkeep_plan(
    connection: sqlite3.Connection,
    other: Combatant,
    terms: Conditions,
    state: UpkeepState,
    total: int,
    cured: bool,
) -> tuple[tuple[Step, ...], ...]:
    effects = state.battler.effects or BattlerEffects()
    counted = 1 + max(getattr(effects, name) for name in COUNTED_EFFECTS)
    return tuple(
        upkeep_steps(
            connection, counted_down(state.battler, passed), other, terms, state, total, cured
        )
        for passed in range(counted)
    )


def upkeeps(
    connection: sqlite3.Connection, battler: Combatant, other: Combatant, terms: Conditions
) -> tuple[list[Upkeep], list[str]]:
    states, named = upkeep_states(battler, other, terms)
    starts = hp_starts(battler)
    totals = list(dict.fromkeys(total for total, _ in starts))
    found = []
    for state in states:
        ability = ability_of(state.battler, other)
        curable = ability == SHED_SKIN and battler.status != NO_STATUS
        for cured in (False, True) if curable else (False,):
            plans = {
                total: upkeep_plan(connection, other, terms, state, total, cured)
                for total in totals
            }
            found.extend(Upkeep(total, start, plans[total]) for total, start in starts)
    return list(dict.fromkeys(found)), named


def end_of_turn(
    connection: sqlite3.Connection,
    battler: Combatant,
    other: Combatant,
    terms: Conditions,
    rounds: int = 1,
) -> EndOfTurn:
    plans, named = upkeeps(connection, battler, other, terms)
    after: list[list[int]] = [[] for _ in range(max(rounds, 1))]
    changes = []
    for plan in plans:
        hp = plan.start
        for index in range(len(after)):
            hp = upkeep_round(plan, hp, index + 1)
            after[index].append(hp)
        changes.append(after[0][-1] - plan.start)
    return EndOfTurn(
        change=Span(min(changes), max(changes)),
        hp=tuple(Span(min(each), max(each)) for each in after),
        not_modelled=tuple(named),
    )


def rounds_to_ko(plan: Upkeep, damage: int) -> int | None:
    hp = plan.start
    for number in range(1, KO_ROUNDS + 1):
        hp -= min(damage, hp)
        if hp <= 0:
            return number
        hp = upkeep_round(plan, hp, number)
        if hp <= 0:
            return number
    return None


def knock_out(plans: list[Upkeep], damage: Span) -> KnockOut:
    fewest = [found for plan in plans if (found := rounds_to_ko(plan, damage.high)) is not None]
    most = [rounds_to_ko(plan, damage.low) for plan in plans]
    return KnockOut(
        fewest=min(fewest) if fewest else None,
        most=None if None in most else max(found for found in most if found is not None),
    )


def hits_to_ko(
    connection: sqlite3.Connection,
    found: Damage,
    user: Combatant,
    target: Combatant,
    terms: Conditions,
) -> HitsToKO:
    plans, named = upkeeps(connection, target, user, terms)
    if found.substitute is not None:
        named.append(NOT_MODELLED_SUBSTITUTE)
    return HitsToKO(
        plain=knock_out(plans, found.damage),
        crit=knock_out(plans, found.crit_damage),
        end_of_turn=end_of_turn(connection, target, user, terms),
        not_modelled=tuple(named),
    )


NOT_MODELLED_HIDDEN_FOE: Final = "the foe's species or level, hidden"
NO_PRIORITY: Final = Span.exact(0)


@dataclass(frozen=True)
class DamageRange:
    type: str
    types: tuple[str, ...]
    category: str
    effectiveness: float
    damage: Span
    crit_damage: Span
    percent: Span
    crit_percent: Span
    hits: Span
    immune: str | None
    fails: bool
    recoil: Span | None
    crash: Span | None
    substitute: int | None
    risks: tuple[Risk, ...]
    not_modelled: tuple[str, ...]


def damage_range(found: Damage) -> DamageRange:
    return DamageRange(
        type=found.type,
        types=found.types,
        category=found.category,
        effectiveness=found.effectiveness,
        damage=found.damage,
        crit_damage=found.crit_damage,
        percent=found.percent,
        crit_percent=found.crit_percent,
        hits=found.hits,
        immune=found.immune,
        fails=found.fails,
        recoil=found.recoil,
        crash=found.crash,
        substitute=found.substitute,
        risks=found.risks,
        not_modelled=found.not_modelled,
    )


@dataclass(frozen=True)
class MoveCalc:
    move: str
    target: int
    targets: tuple[int, ...]
    spread: bool
    damage: DamageRange | None
    hits_to_ko: HitsToKO | None
    accuracy: Accuracy
    critical: Critical | None
    order: Order | None


@dataclass(frozen=True)
class OwnCalc:
    battler: int
    moves: tuple[MoveCalc, ...]


@dataclass(frozen=True)
class ThreatCalc:
    move: str
    source: str
    target: int
    damage: DamageRange
    hits_to_ko: HitsToKO
    accuracy: Accuracy
    order: Order | None


@dataclass(frozen=True)
class FoeCalc:
    battler: int
    threats: tuple[ThreatCalc, ...]
    not_modelled: tuple[str, ...] = ()


@dataclass(frozen=True)
class BattleCalc:
    ours: tuple[OwnCalc, ...]
    foes: tuple[FoeCalc, ...]


def own_battlers(battle: KnownBattle) -> list[Battler]:
    return [
        battler
        for battler in battle.battlers
        if isinstance(battler, Battler) and battler.side == PLAYER_SIDE and not battler.fainted
    ]


def standing_foes(battle: KnownBattle) -> list[KnownFoe]:
    return [
        battler
        for battler in battle.battlers
        if isinstance(battler, KnownFoe) and known(battler.fainted, False) is False
    ]


def own_combatant(
    connection: sqlite3.Connection, battle: KnownBattle, battler: Battler
) -> Combatant:
    party = known(battle.player_party, None)
    pokemon = None
    if party is not None and 0 <= battler.pokemon_index < len(party):
        pokemon = party[battler.pokemon_index]
    return own(connection, battler, pokemon, party)


def ally_conditions(battle: KnownBattle, targets: int) -> Conditions:
    attacking = conditions(battle, OPPONENT_SIDE, targets=targets)
    return replace(
        conditions(battle, PLAYER_SIDE, targets=targets),
        attacker_side_size=attacking.attacker_side_size,
        attacker_tailwind=attacking.attacker_tailwind,
        attacker_swamp=attacking.attacker_swamp,
        attacker_party=attacking.attacker_party,
    )


def move_calc(
    connection: sqlite3.Connection,
    move: Move,
    user: Combatant,
    target: Combatant,
    index: int,
    found: Targets,
    terms: Conditions,
    foe_target: bool,
) -> MoveCalc:
    hit = None
    knock = None
    crit = None
    if move.category != STATUS_CATEGORY:
        hit = damage(connection, move, user, target, terms)
        knock = hits_to_ko(connection, hit, user, target, terms)
        crit = critical(connection, move, user, target, terms)
    return MoveCalc(
        move=move.id,
        target=index,
        targets=found.battlers,
        spread=found.spread,
        damage=None if hit is None else damage_range(hit),
        hits_to_ko=knock,
        accuracy=accuracy(connection, move, user, target, terms),
        critical=crit,
        order=speed_order(user, move, target, None, terms) if foe_target else None,
    )


def own_calc(
    connection: sqlite3.Connection,
    battle: KnownBattle,
    battler: Battler,
    combatants: dict[int, Combatant],
) -> OwnCalc:
    user = combatants[battler.index]
    found = []
    for slot in battler.moves:
        move = gamedb.move(connection, slot.move.id)
        for targets in move_targets(move, user, battler.index, battle, conditions(battle)):
            count = len(targets.battlers)
            for index in targets.battlers:
                target = combatants.get(index)
                if target is None or index == battler.index:
                    continue
                foe_target = index % 2 == 1
                terms = (
                    conditions(battle, OPPONENT_SIDE, targets=count)
                    if foe_target
                    else ally_conditions(battle, count)
                )
                found.append(
                    move_calc(connection, move, user, target, index, targets, terms, foe_target)
                )
    return OwnCalc(battler.index, tuple(found))


def foe_calc(
    connection: sqlite3.Connection,
    battle: KnownBattle,
    found: KnownFoe,
    combatants: dict[int, Combatant],
    ours: list[Battler],
    badges: int,
    rolled: KnownRandom | None,
) -> FoeCalc:
    user = combatants.get(found.index)
    if user is None:
        return FoeCalc(found.index, (), (NOT_MODELLED_HIDDEN_FOE,))
    hit_terms = conditions(battle, PLAYER_SIDE)
    order_terms = conditions(battle, OPPONENT_SIDE)
    listed = []
    for battler in ours:
        target = combatants[battler.index]
        for threat in threats(connection, found, user, target, hit_terms, badges, rolled):
            move = gamedb.move(connection, threat.move)
            order = speed_order(target, None, user, move, order_terms)
            listed.append(
                ThreatCalc(
                    move=threat.move,
                    source=threat.source,
                    target=battler.index,
                    damage=damage_range(threat.damage),
                    hits_to_ko=hits_to_ko(connection, threat.damage, user, target, hit_terms),
                    accuracy=accuracy(connection, move, user, target, hit_terms),
                    order=None if order.target_priority == NO_PRIORITY else order,
                )
            )
    return FoeCalc(found.index, tuple(listed))


def annotate(
    connection: sqlite3.Connection,
    battle: KnownBattle,
    badges: int,
    rolled: KnownRandom | None = None,
) -> BattleCalc:
    ours = own_battlers(battle)
    foes = standing_foes(battle)
    combatants: dict[int, Combatant] = {
        battler.index: own_combatant(connection, battle, battler) for battler in ours
    }
    for each in foes:
        made = foe(connection, each, rolled=rolled)
        if made is not None:
            combatants[each.index] = made
    return BattleCalc(
        ours=tuple(own_calc(connection, battle, battler, combatants) for battler in ours),
        foes=tuple(
            foe_calc(connection, battle, each, combatants, ours, badges, rolled) for each in foes
        ),
    )
