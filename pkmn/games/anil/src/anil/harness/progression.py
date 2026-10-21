from dataclasses import dataclass
from typing import Literal

from anil.harness.gamedb import WORLD, Tag
from anil.harness.state import GameState

COMPLETO_VERSION = 1


@dataclass(frozen=True)
class Leader:
    trainer_type: str
    name: str
    version: int
    double: bool


@dataclass(frozen=True)
class Flag:
    kind: Literal["switch", "variable", "self_switch"]
    id: int
    value: int = 1
    map_id: int = 0


@dataclass(frozen=True)
class Opener:
    needs: tuple[Flag, ...] = ()
    question: str | None = None
    options: tuple[str, ...] = ()
    answer: int = 0
    talk: tuple[int, ...] = ()


@dataclass(frozen=True)
class Gate:
    name: str
    kind: Literal["wall", "scene"]
    map_id: int
    events: tuple[int, ...]
    opens: Flag
    done_by: str
    done_at: tuple[int, int] | None = None
    tag: Tag = WORLD
    opener: Opener | None = None


@dataclass(frozen=True)
class Gym:
    order: int
    town: str
    town_map: int
    gym_map: int
    leader_event: int
    badge_switch: int
    leader: Leader
    challenge_cap: int
    cap: int
    gates: tuple[Gate, ...] = ()
    key_items: tuple[str, ...] = ()
    tag: Tag = WORLD

    @property
    def badge_index(self) -> int:
        return self.order - 1


def leader(trainer_type: str, name: str, *, double: bool = False) -> Leader:
    return Leader(trainer_type, name, COMPLETO_VERSION, double)


def switch(id: int) -> Flag:
    return Flag("switch", id)


def variable(id: int, value: int) -> Flag:
    return Flag("variable", id, value)


def self_switch(map_id: int, event_id: int) -> Flag:
    return Flag("self_switch", event_id, map_id=map_id)


GYM_1_GATES = (
    Gate(
        "Prof. Oak's stop at Pueblo Paleta's north exit",
        "scene",
        2,
        (11, 12, 13, 14),
        variable(55, 1),
        "walking over it: Prof. Oak stops the player and takes them to his lab, where his scene (map 29 event 13) sets variable 55 to 2",
        (2, 11),
    ),
    Gate(
        "the lab's door before a starter",
        "wall",
        29,
        (3,),
        variable(55, 5),
        "taking a starter (map 29 events 28 to 30 set variable 55 to 4); Azul's autorun scene after it (event 2, page 3) sets it to 5",
        (29, 2),
    ),
    Gate(
        "Azul's battle at the lab's door",
        "scene",
        29,
        (3,),
        switch(67),
        "walking over it: a battle with Azul (AZUL1) under the canLose rule",
        (29, 3),
    ),
    Gate(
        "Ciudad Verde's north exit",
        "wall",
        4,
        (14, 15, 34, 36, 37, 38),
        switch(69),
        "Prof. Oak's Pokédex scene in his lab (map 29 event 19, an autorun page on switch 68), after meeting the classmate in Ciudad Verde (map 4 event 39 turns switch 68 on)",
        (29, 19),
    ),
    Gate(
        "the classmate's battle on Ruta 2 Sur",
        "scene",
        6,
        (3,),
        switch(71),
        "walking over it: a battle with the classmate (HOJA1 or ROJO1)",
        (6, 3),
    ),
    Gate(
        "Ciudad Plateada's gym door",
        "wall",
        9,
        (26, 27),
        variable(151, 5),
        "talking to Brock in the Museo Pokémon (map 40 event 22), which plays a battle with a Team Rocket grunt (ROCKETA Marineta) and sets variable 151 to 5",
        (40, 22),
    ),
)

GYM_2_GATES = (
    Gate(
        "Ciudad Plateada's east exit",
        "wall",
        9,
        (30,),
        switch(184),
        "beating Brock (map 42 event 16)",
        (42, 16),
    ),
    Gate(
        "the classmate's battle outside Monte Moon",
        "scene",
        12,
        (20,),
        switch(73),
        "walking over it: a battle with the classmate (HOJA2 or ROJO2)",
        (12, 20),
    ),
    Gate(
        "the fossils in Monte Moon",
        "wall",
        13,
        (36, 37),
        switch(75),
        "taking either fossil",
        (13, 37),
    ),
    Gate(
        "Atlas's battle in Monte Moon",
        "scene",
        13,
        (35,),
        switch(74),
        "walking over it: a battle with Atlas (ATLAS1); switch 74 also clears the rocks 60 and 61 and the grunts beside him",
        (13, 35),
    ),
    Gate(
        "Azul's battle in Ciudad Celeste",
        "scene",
        15,
        (61,),
        switch(76),
        "walking over it: a battle with Azul (AZUL3)",
        (15, 61),
    ),
    Gate(
        "the Team Rocket battle at the end of Ruta 20's bridge",
        "scene",
        16,
        (6, 34, 35, 38, 39),
        switch(80),
        "walking over it: a battle with a Team Rocket grunt (ELITEROCKET Menio)",
        (16, 34),
    ),
    Gate(
        "Misty at Ruta 21's lookout",
        "scene",
        109,
        (33,),
        variable(152, 3),
        "stepping on the strip west of Misty: she tells the player to come to her gym. Talking to Misty does nothing, and the navigator's path to her goes round the strip",
        (109, 33),
    ),
    Gate(
        "Ciudad Celeste's gym hall",
        "wall",
        57,
        (7, 8, 9),
        variable(152, 3),
        "Misty at Ruta 21's lookout",
        (109, 33),
    ),
)

GYM_3_GATES = (
    Gate(
        "Ciudad Celeste's south exit",
        "wall",
        15,
        (39, 42),
        switch(185),
        "beating Misty (map 57 event 11)",
        (57, 11),
    ),
    Gate(
        "the S.S. Anne's dock",
        "wall",
        19,
        (46, 47, 48),
        switch(83),
        'in Bill\'s house (map 62): talking to Bill, turned into a Pokémon (event 3), turns switch 81 on; the machine\'s computer (event 4) then asks to start the machine, and "Sí" turns switches 82 and 83 on and gives TICKETBARCO. Walking past the strips with switch 83 on turns switch 85 "SS Anne" on',
        (62, 4),
    ),
    Gate(
        "meeting Azul and the classmate on the S.S. Anne",
        "scene",
        58,
        (3, 4, 5, 6, 63),
        variable(155, 2),
        "walking over it: Azul and the classmate meet the player and see a Team Rocket grunt; no battle",
        (58, 3),
    ),
    Gate(
        "Azul's stand outside Atenea's cabin",
        "scene",
        59,
        (30,),
        variable(155, 4),
        "walking over it: Azul and the classmate hold off the grunts and send the player into the cabin; it turns switches 87 and 152 on; no battle",
        (59, 30),
    ),
    Gate(
        "Ciudad Carmín's gym door",
        "wall",
        19,
        (44, 45),
        switch(89),
        "talking to Atenea in her cabin (map 59 event 87) plays a battle with her (ATENEA1) and turns switch 88 on; the captain's autorun scene on it (event 88) gives CUTITEM and turns switch 89 on",
        (59, 88),
    ),
    Gate(
        "the electric barrier in Ciudad Carmín's gym",
        "wall",
        56,
        (10, 11, 12, 13, 14),
        variable(130, 2),
        "searching the gym's bins (events 16 to 30) for the two with switches: the parallel event 31 places them at random the first time the gym is entered (variables 126 and 128, the second next to the first), then turns its self switch A on. The first found sets variable 130 to 1, the second to 2; a wrong bin after the first sets it back to 0 and turns event 31's self switch off, so the two are placed again",
    ),
)

GYM_4_GATES = (
    Gate(
        "Lorelei's stop on Ruta 10 Norte",
        "scene",
        23,
        (24,),
        switch(92),
        'walking over it: the strip moves the player to (11, 18), and Lorelei asks about Team Rocket and warns of them near Pueblo Lavanda; no battle. It also turns switches 120 "Escena Lorelei" and 301 "Vuelo Tunel Roca" on',
        (23, 24),
    ),
    Gate(
        "the classmate's battle on Ruta 10 Norte",
        "scene",
        23,
        (26, 30),
        variable(58, 3),
        "walking over it: a battle with the classmate (HOJA3 or ROJO3), then Lorelei's talk; page 2 of both strips needs variable 58 at 3",
        (23, 26),
    ),
    Gate(
        "the Cubone running past on Ruta 8",
        "scene",
        71,
        (28, 29, 30, 31),
        switch(94),
        'walking over it: a Cubone cries ("Cuuuub...") and runs past; no battle',
        (71, 28),
    ),
    Gate(
        "the Cubone running past in the Subterráneo",
        "scene",
        75,
        (20, 23, 24, 25, 26),
        switch(95),
        "walking over it: the same Cubone cries and runs past; no battle",
        (75, 20),
    ),
    Gate(
        "Ciudad Azulona's gym door",
        "wall",
        76,
        (51, 52),
        switch(271),
        "talking to Erika in Ciudad Azulona (event 50 at (38, 37)): she is worried about a Cubone and goes back to her gym",
        (76, 50),
    ),
)

GYM_5_GATES = (
    Gate(
        "the Team Rocket grunt on the Casino Azulona's stairs",
        "wall",
        39,
        (29,),
        switch(96),
        "talking to him: a battle with a Team Rocket grunt (ROCKETO Cristian), after which he leaves to warn his bosses; his page 2, on switch 96, has no graphic",
        (39, 29),
    ),
    Gate(
        "Atlas's report to Giovanni in the Guarida Rocket",
        "scene",
        85,
        (13, 14, 15),
        variable(59, 1),
        "walking over it: Atlas reports to Giovanni and is sent away; no battle",
        (85, 13),
    ),
    Gate(
        "Azul's battle in the Torre Pokémon",
        "scene",
        64,
        (53, 54, 55, 56),
        switch(93),
        "walking over it: Azul battles (AZUL5); if the battle is lost the event stops before the switch",
        (64, 53),
    ),
    Gate(
        "the ghost on the Torre Pokémon's stairs to the top floor",
        "wall",
        64,
        (22,),
        switch(98),
        "beating Giovanni in the Guarida Rocket (map 85 event 11), who gives VISORSILPH",
        (85, 11),
    ),
    Gate(
        "the Marowak's spirit on the Torre Pokémon's stairs to the top floor",
        "scene",
        64,
        (22,),
        switch(101),
        "walking over it with switch 98 on: the Silph Scope reveals the Marowak's spirit and a wild battle with a Marowak at level 40 starts that cannot be fled (cannotRun) and allows no Poké Balls; if it is lost the event stops before the switches",
        (64, 22),
    ),
    Gate(
        "Mr. Fuji and Urano on the Torre Pokémon's top floor",
        "scene",
        65,
        (2,),
        switch(105),
        'talking to Mr. Fuji: the scene turns switch 102 "Urano" on, Urano comes in and battles (URANO1); after it Azul and the classmate arrive, the scene turns switches 103 and 104 on, 99 off and 105 on, and moves the player to Mr. Fuji\'s house (map 67 (10, 10)); if the battle is lost the event stops before them',
        (65, 2),
    ),
    Gate(
        "Mr. Fuji's Poké Flute in his house",
        "scene",
        67,
        (11,),
        switch(106),
        "talking to Mr. Fuji: he tells the story of Mewtwo and gives POKEFLUTE",
        (67, 11),
    ),
    Gate(
        "the Snorlax asleep on Ruta 12",
        "wall",
        86,
        (3, 4, 5, 6, 8, 10, 11, 12),
        switch(107),
        'talking to it with switch 106 on: "¡Usas la Pokéflauta!", "¡El Snorlax se está despertando!" and a wild battle with a Snorlax at level 40; after the battle, whatever its outcome, the page turns switch 107 on and the Snorlax is gone. With switch 106 off its page only says "Parece que hay un Pokémon profundamente dormido... Es imposible pasar por aquí."',
        (86, 4),
    ),
    Gate(
        "Azul and Agatha in Pueblo Marengo",
        "scene",
        91,
        (46,),
        variable(178, 3),
        'walking over it: Azul stops the player ("¡Espera, <player>! ¿A dónde crees que vas?"), Agatha arrives and talks to both, and the scene sets variable 178 to 1, 2 and 3; no battle',
        (91, 46),
    ),
    Gate(
        "the classmate's battle in the gatehouse to Ciudad Fucsia",
        "scene",
        137,
        (6, 8, 10, 11),
        switch(190),
        "walking over it: the classmate (Hoja or Rojo) asks for a battle (HOJA4 or ROJO4), then turns switch 190 on",
        (137, 6),
    ),
    Gate(
        "the assistant's question in Koga's gym",
        "scene",
        125,
        (35,),
        switch(191),
        'entering the gym: the assistant asks "¿Vienes a desafiar al gimnasio de Ciudad Fucsia?". "Sí" tells the player that Koga has hidden the gym\'s paths and that the warden in the Casa del Guarda has a Lente de la Verdad, and turns switch 191 on; "No" sends the player back out to map 94 (18, 44) with switch 191 still off. Page 2, on switch 191, repeats the hint and offers to heal the party once LENSOFTRUTH is held',
        (125, 35),
    ),
)

GYM_6_GATES = (
    Gate(
        "Sachiko's tea outside Koga's gym",
        "scene",
        94,
        (52,),
        switch(193),
        'leaving Koga\'s gym with his badge: Sachiko stops the player ("¡Espera, \\PN!"), tells of the guards on strike in Ciudad Azafrán and gives TESECRETO; no battle',
        (94, 52),
    ),
    Gate(
        "the guards on strike in Ciudad Azafrán's north gatehouse",
        "wall",
        46,
        (5, 10, 11),
        switch(201),
        "talking to a guard at any of Ciudad Azafrán's four gatehouses with switch 193 on",
        (46, 5),
        opener=Opener((switch(193),)),
    ),
    Gate(
        "the guards on strike in Ciudad Azafrán's south gatehouse",
        "wall",
        47,
        (9, 13, 15),
        switch(201),
        "talking to a guard at any of Ciudad Azafrán's four gatehouses with switch 193 on",
        (47, 9),
        opener=Opener((switch(193),)),
    ),
    Gate(
        "the guards on strike in Ciudad Azafrán's east gatehouse",
        "wall",
        73,
        (8, 12, 14),
        switch(201),
        "talking to a guard at any of Ciudad Azafrán's four gatehouses with switch 193 on",
        (73, 8),
        opener=Opener((switch(193),)),
    ),
    Gate(
        "the guards on strike in Ciudad Azafrán's west gatehouse",
        "wall",
        74,
        (8, 12, 14),
        switch(201),
        "talking to a guard at any of Ciudad Azafrán's four gatehouses with switch 193 on",
        (74, 8),
        opener=Opener((switch(193),)),
    ),
    Gate(
        "the secretary and Bruno in Silph S.A.'s lobby",
        "scene",
        100,
        (27,),
        variable(182, 2),
        "entering Silph S.A.: the secretary tells of Team Rocket's takeover, Bruno arrives and goes to meditate, and Azul goes ahead; no battle",
        (100, 27),
    ),
    Gate(
        "Atlas's battle in Silph S.A.",
        "scene",
        101,
        (104,),
        switch(197),
        "talking to Atlas: a battle with him; after it he gives TMAGN1 (Tarjeta Magnética 1) and turns switch 197 and his self switch A on",
        (101, 104),
    ),
    Gate(
        "Atenea's battle in Silph S.A.",
        "scene",
        102,
        (89,),
        switch(198),
        "talking to Atenea: a battle with her; after it she gives TMAGN2 (Tarjeta Magnética 2) and turns switch 198 and her self switch A on",
        (102, 89),
    ),
    Gate(
        "the magnetic door to the warp to Azul in Silph S.A.",
        "wall",
        101,
        (72, 73, 74, 75),
        self_switch(101, 72),
        'talking to the door with switches 197 and 198 on and answering "Sí"',
        (101, 74),
        opener=Opener(
            (switch(197), switch(198)),
            "¿Quieres abrir la puerta magnética?",
            ("Sí", "No"),
            0,
        ),
    ),
    Gate(
        "Azul's battle in Silph S.A.",
        "scene",
        102,
        (91, 92),
        variable(182, 3),
        "walking over it: Azul asks for a warm-up battle (AZUL6), then sets variable 182 to 3",
        (102, 91),
    ),
    Gate(
        "Giovanni and Azul in Silph S.A.",
        "scene",
        100,
        (34, 35, 36),
        variable(182, 7),
        "walking over it: Giovanni has just beaten Azul, who leaves; the scene sets variable 182 to 4 and 7; no battle",
        (100, 34),
    ),
    Gate(
        "Giovanni's battle in Silph S.A.",
        "scene",
        100,
        (38,),
        switch(199),
        "talking to Giovanni: a battle with him (GIOVANNI2); after it he leaves, the president gives MASTERBALL, and Sabrina comes in and leaves for her gym; the scene turns switch 199 on",
        (100, 38),
    ),
    Gate(
        "the Team Rocket grunts at Sabrina's gym door",
        "wall",
        99,
        (46, 47),
        switch(199),
        'Giovanni\'s battle in Silph S.A.; their page 2, on switch 199, has no graphic, and with it off they only talk ("Ni se te ocurra acercarte a las oficinas de Silph S.A., ¿eh?")',
        (100, 38),
    ),
)

GYM_7_GATES = (
    Gate(
        "the classmate's Surf gift outside Sabrina's gym",
        "scene",
        99,
        (50,),
        switch(216),
        "leaving Sabrina's gym with her badge: the classmate gives SURFITEM (Montura Surf) and says Isla Canela is reached from Pueblo Paleta or Ruta 17; no battle. Nothing else reads switch 216",
        (99, 50),
    ),
    Gate(
        "Blaine at the Mansión Quemada's door",
        "wall",
        116,
        (40,),
        switch(207),
        "talking to Blaine: he asks the player to find out what Team Rocket seeks in the mansion; no battle. His page 2, on switch 207, has no graphic, and event 41 (Blaine at (51, 20)) shows instead",
        (116, 40),
        opener=Opener(),
    ),
    Gate(
        "the doors of the Persian statue at (28, 42) in the Mansión Quemada",
        "wall",
        122,
        (13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 31, 32, 33, 34),
        switch(205),
        'talking to the statue (event 35) and answering "Sí", which turns switch 205 on, or off when it is on',
        (122, 35),
        opener=Opener(
            question="Parece un interruptor, ¿quieres pulsarlo?",
            options=("Sí", "No"),
            talk=(35,),
        ),
    ),
    Gate(
        "the doors of the Persian statue at (39, 5) in the Mansión Quemada",
        "wall",
        122,
        (37, 38, 39, 40),
        switch(206),
        'talking to the statue (event 36) and answering "Sí", which turns switch 206 on, or off when it is on',
        (122, 36),
        opener=Opener(
            question="Parece un interruptor, ¿quieres pulsarlo?",
            options=("Sí", "No"),
            talk=(36,),
        ),
    ),
    Gate(
        "Surya's battle in the Mansión Quemada",
        "scene",
        122,
        (54, 55),
        switch(210),
        "walking over it: Surya's grunts search the mansion for her, then a battle with her (SURYA)",
        (122, 54),
    ),
    Gate(
        "Blaine's talk outside the Mansión Quemada",
        "scene",
        116,
        (41,),
        switch(211),
        "talking to Blaine with switch 210 on: he hears of the Psicorradar and of Mewtwo and leaves for his gym",
        (116, 41),
    ),
    Gate(
        "Isla Canela's gym door",
        "wall",
        116,
        (38, 39),
        switch(211),
        "Blaine's talk outside the Mansión Quemada",
        (116, 41),
    ),
    Gate(
        "the assistant's welcome in Blaine's gym",
        "scene",
        131,
        (4,),
        variable(60, 2),
        "entering the gym: Blaine asks a first riddle too early and the assistant explains the riddle doors and gives LEMONADE; no battle",
        (131, 4),
    ),
    Gate(
        "the first riddle door in Blaine's gym",
        "scene",
        131,
        (14, 16, 17),
        variable(64, 1),
        "walking over it: a riddle, then a battle with Erick (CEREBRITO)",
        (131, 16),
    ),
    Gate(
        "the second riddle door in Blaine's gym",
        "scene",
        131,
        (21, 32, 33),
        variable(64, 2),
        "walking over it: a riddle, then a battle with Quinn (LADRON)",
        (131, 32),
    ),
    Gate(
        "the third riddle door in Blaine's gym",
        "scene",
        131,
        (48, 49, 50),
        variable(64, 3),
        "walking over it: a riddle, then a battle with Anastasia (CIENTIFICA)",
        (131, 49),
    ),
    Gate(
        "the fourth riddle door in Blaine's gym",
        "scene",
        131,
        (51, 52, 53),
        variable(64, 4),
        "walking over it: a riddle, then a battle with Lucy (CIENTIFICA)",
        (131, 52),
    ),
    Gate(
        "the fifth riddle door in Blaine's gym",
        "scene",
        131,
        (54, 55, 56),
        variable(64, 5),
        "walking over it: a riddle (Blaine's name); no battle",
        (131, 55),
    ),
)

GYM_8_GATES = (
    Gate(
        "Bill's arrival in Isla Canela",
        "scene",
        116,
        (42,),
        switch(213),
        "leaving Blaine's gym with his badge: Bill tells of Giovanni's hunt for Mewtwo and asks the player to his house in Ciudad Celeste; no battle",
        (116, 42),
    ),
    Gate(
        "Bill's boat from Isla Canela",
        "scene",
        116,
        (42,),
        switch(231),
        'talking to Bill: "¿Todo listo para marcharnos?"; "Sí" turns switch 231 on and moves the player to Ruta 21, map 109 (56, 18); "No" leaves things as they are. Page 3, on switch 231, has no graphic',
        (116, 42),
    ),
    Gate(
        "the meeting in Bill's house",
        "scene",
        62,
        (8,),
        switch(232),
        "entering Bill's house from Ruta 21 with switch 231 on: Bill, Prof. Oak, Azul and the classmate meet, and Bill and Prof. Oak send the three to the Cueva Celeste; no battle",
        (62, 8),
    ),
    Gate(
        "the psychic and her Hypno at the Cueva Celeste's entrance",
        "wall",
        15,
        (7, 8),
        switch(232),
        "the meeting in Bill's house",
        (62, 8),
    ),
    Gate(
        "Azul against Atlas and Atenea in the Cueva Celeste",
        "scene",
        168,
        (31, 37, 38, 39, 40, 67),
        switch(236),
        "walking over it: Azul, beaten by Atlas and Atenea, is joined by the classmate, and the two stay to fight them and send the player on; the scene turns switches 233 to 236 on; no battle",
        (168, 37),
    ),
    Gate(
        "Surya's battle in the Cueva Celeste",
        "scene",
        170,
        (23, 25),
        switch(237),
        "walking over it: a double battle with Surya (SURYA2); after it she leaves Team Rocket",
        (170, 23),
    ),
    Gate(
        "Lance and the Team Rocket squad in the Bosque Celeste",
        "scene",
        174,
        (26, 29, 30, 31, 32),
        variable(67, 5),
        'walking over it: the grunts stop the player, Lance and his Dragonite arrive, and Lance stays to hold them off; it asks "¿…puedo contar contigo…?", and either answer goes on; no battle',
        (174, 26),
    ),
    Gate(
        "Giovanni's battle and Mewtwo in the Bosque Celeste",
        "scene",
        174,
        (13,),
        switch(241),
        "walking over it: a battle with Giovanni (GIOVANNI3), then a scene in which Mewtwo appears, then the Mewtwo battle beside Azul; the page ends by turning switch 239 on, and page 2 then turns switches 240 and 241 on, asks the player how they are (either answer goes on) and moves them to Ruta 21, map 109 (54, 17)",
        (174, 13),
    ),
    Gate(
        "Prof. Oak's Rock Climb gift on Ruta 21",
        "scene",
        109,
        (4,),
        switch(242),
        "arriving on Ruta 21 from Giovanni's scene: Prof. Oak gives ROCKCLIMBITEM (Equipo de Escalada) and says Ciudad Verde's gym has reopened; the scene turns switches 229 and 242 on; no battle",
        (109, 4),
    ),
    Gate(
        "Ciudad Verde's gym door",
        "wall",
        4,
        (32, 33),
        switch(242),
        "Prof. Oak's Rock Climb gift on Ruta 21",
        (109, 4),
    ),
    Gate(
        "the Llave Roja in Urano's gym",
        "scene",
        182,
        (8,),
        switch(226),
        'talking to it: "¡Coges una Llave Roja!"; no item enters the bag',
        (182, 8),
    ),
    Gate(
        "the Llave Azul in Urano's gym",
        "scene",
        182,
        (9,),
        switch(227),
        'talking to it: "¡Coges una Llave Azul!"; no item enters the bag',
        (182, 9),
    ),
    Gate(
        "the two-key door in Urano's gym",
        "wall",
        182,
        (16, 20),
        switch(228),
        "talking to the door with switches 226 and 227 on",
        (182, 16),
        opener=Opener((switch(226), switch(227))),
    ),
)

GYMS = (
    Gym(
        1,
        "Ciudad Plateada",
        9,
        42,
        16,
        184,
        leader("LIDER1", "Brock"),
        14,
        23,
        GYM_1_GATES,
    ),
    Gym(
        2,
        "Ciudad Celeste",
        15,
        57,
        11,
        185,
        leader("LIDER2", "Misty"),
        23,
        30,
        GYM_2_GATES,
    ),
    Gym(
        3,
        "Ciudad Carmín",
        19,
        56,
        7,
        186,
        leader("LIDER3", "Teniente Surge"),
        30,
        39,
        GYM_3_GATES,
    ),
    Gym(
        4,
        "Ciudad Azulona",
        76,
        81,
        9,
        187,
        leader("LIDER4", "Erika"),
        39,
        49,
        GYM_4_GATES,
        ("CUTITEM",),
    ),
    Gym(
        5,
        "Ciudad Fucsia",
        94,
        125,
        39,
        192,
        leader("LIDER5", "Koga y Sachiko", double=True),
        49,
        54,
        GYM_5_GATES,
        ("LLAVEROCKET", "POKEFLUTE", "LENSOFTRUTH"),
    ),
    Gym(
        6,
        "Ciudad Azafrán",
        99,
        127,
        41,
        196,
        leader("LIDER6", "Sabrina"),
        54,
        59,
        GYM_6_GATES,
    ),
    Gym(
        7,
        "Isla Canela",
        116,
        131,
        12,
        212,
        leader("LIDER7", "Blaine"),
        59,
        66,
        GYM_7_GATES,
        ("SURFITEM",),
    ),
    Gym(
        8,
        "Ciudad Verde",
        4,
        182,
        7,
        225,
        leader("LIDER8", "Urano"),
        66,
        75,
        GYM_8_GATES,
    ),
)

GATES = tuple(gate for found in GYMS for gate in found.gates)


class ProgressionError(Exception):
    pass


def gym(order: int) -> Gym:
    if not 1 <= order <= len(GYMS):
        raise ProgressionError(f"no gym {order}; gyms run 1 to {len(GYMS)}")
    return GYMS[order - 1]


def held(badges: list[bool], found: Gym) -> bool:
    return found.badge_index < len(badges) and badges[found.badge_index]


def next_gym(badges: list[bool]) -> Gym | None:
    return next((found for found in GYMS if not held(badges, found)), None)


def next_gym_of(state: GameState) -> Gym | None:
    if state.trainer is None:
        raise ProgressionError("no trainer in the state read; the game has not started")
    return next_gym(state.trainer.badges)
