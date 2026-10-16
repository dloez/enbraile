# Open Sheet: Site Discovery

The decisions behind part 2 of [Open Sheet](open-sheet.md): the web app that reads open-sheet exports and helps the reader understand them and build teams from them. It is the first tool of the pkmn site, which will grow more tools and, later, a backend. Scoped with the owner on 2026-10-15.

## Goal and Success

**Q: What is the site?**
A: The group's Pokémon site, `pkmn/site/`. For now it holds one tool, Open Sheet; later tools join it, and a Cloudflare Workers backend may follow.
**Why:** the owner: the site will grow in depth over the series, and this is the tool needed now.

**Q: What does the Open Sheet tool do?**
A: It imports exports, each into its own tab, and on every tab lets the reader look through the sheet in a PC, search it and filter it by type, build teams from it in that same PC, and analyse a team on a team page.
**Why:** the owner chose the browse, filter, two-sheet and team-builder jobs; the team page follows pokeos's builder: stats, what is effective and what is not.

**Q: Does the site know whose sheet is whose?**
A: No. It has no notion of "my sheet" or "the rival's sheet". Any number of exports can be imported, each opens in its own tab, and every feature works on every tab.
**Why:** the owner: the reader does whatever they want with each import.

**Q: When is it done?**
A: Deployed at `pkmn.enbraile.vip`, a reader drops in two exports, gets two tabs, browses each with sprites, Showdown base stats, abilities, items and TMs, builds a named team in either tab, sees its stats, defensive chart and offensive coverage, and copies it as Showdown text; closing and reopening the browser keeps the tabs and teams.

## Scope Edges

**Q: What is out?**
A: A matchup of a team against another tab's Pokémon (the team page analyses the team alone), a damage calculator, shareable links, accounts and any server-side storage, a Spanish UI, and TM compatibility (the export leaves it out on purpose: [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md)).
**Why:** the owner chose team-only analysis and no damage calc for now; the rest follows from the decisions below.

**Q: Does the design account for data the export does not carry?**
A: Yes. Moves, learnsets and IVs or stats are not in the default export (its `--moves` flag adds learnable moves, which the site reads: see the next answer), but the views and the stored model leave room for them: a member already has four move slots, and a learnset arriving in a later export narrows the move picker instead of reshaping the builder.
**Why:** the owner: build with those in mind.

## Interfaces and Integration

**Q: What does the site read?**
A: The JSON that `pkmn/tools/export_data.py` writes, exactly as [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md) defines it, which owns that format. Which items go out (Showdown's `data/items.ts` keys, held items of permafainted Pokémon counted, `tinymushroom` kept) is decided in [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md#decisions).

**Q: How does a file get in?**
A: Dropped onto the page or chosen with a file picker, read in the browser and validated against a schema of the JSON reference. A file that fails validation is refused with what was wrong. Each import opens a new tab named after the file (`MIRAMEEE-open-sheet.json` → `MIRAMEEE`), renamable. Nothing is uploaded.

**Q: Where do names, descriptions, base stats and the type chart come from?**
A: `@pkmn/dex`, Showdown's data as an npm package, Gen 9, bundled into the site. No API is called at runtime.
**Why:** the owner asked for a good source of base stats and sprites. Fights are Showdown "[Gen 9] Custom Game" (Wonder: `docs/domains/competition/reference/rules.md` → The League), and several Gen 1–5 Pokémon gained base stats in Gen 6+, so Showdown's Gen 9 data is what the fight runs; PokéAPI's cartridge data is not. It is also the source the export's IDs already follow.

**Q: Where do sprites come from?**
A: Showdown's sprite server, through `@pkmn/img`'s URLs: Pokémon (shiny and female variants, Gen 5 static and animated sets fit the Gen 1–5 roster) and item icons. They load from `play.pokemonshowdown.com`, so they are not stored in the site. `sprites/gen5/walrein.png` and `sprites/gen5ani-shiny/walrein.gif` were checked to load (2026-10-15).

**Q: Whose types drive the analysis: the export's or Showdown's?**
A: Showdown's, with its base stats. A card shows the export's `types` and flags a species whose export types differ from Showdown's.
**Why:** forced by where the fight runs: Showdown sets a species' types from its own data, whatever the save says. The mod's types are modern (Clefairy is `FAIRY` in Wonder's `types.txt`), so a mismatch should be rare. _(2026-10-15)_

**Q: What about an ID `@pkmn/dex` does not know?**
A: It is shown by its raw ID with a marker, and kept out of the analysis. `tinymushroom` is the one expected case and gets a hand-kept label, "Mini Seta (Tiny Mushroom)".

**Q: Can a team leave the site?**
A: Yes: a button copies it in Showdown's team format: species, nickname, gender, shiny, item, ability, nature, Level 50 and the picked moves, with no IVs or EVs.
**Why:** the owner. Level 50 is the league's format (Wonder: `rules.md` → Pokepastes).

## The Builder and the Team Page

**Q: How is a team built?**
A: In the PC, by pointing and clicking, with no drag and drop. The PC is the tab's main view: its Pokémon in a scrollable box grid, searchable by name and filterable by type, under a strip of six team slots. Clicking a Pokémon opens its summary (Info, with every possible ability and its description, and Stats); its button adds it to the first free slot or removes it. A Bag button opens a scrollable bag with Items, Berries and TMs pockets; clicking an entry shows the team's members, and clicking one gives it the item or teaches it the TM. The Team view shows each member's item, ability, four moves and Level 50 stats, with the analysis below; clicking a member's item slot opens the bag for that member. Each tab holds any number of named teams, which can be created, renamed, duplicated and deleted.
**Why:** the owner, in the design pass: a real Pokémon PC with a bag, point and click rather than drag, and many teams per tab. _(2026-10-16)_

**Q: Do item quantities limit a team?**
A: Yes. An item can be held by no more members than the tab's `quantity` of it; once used up, it shows as unavailable.
**Why:** the owner.

**Q: Which ability can a member use?**
A: Its current ability by default, switchable to any of its `abilities` (base or hidden), marked as not its current one. The team shows how many Mini Setas the build needs, one for each member whose picked ability is not its current one, against the tab's `tinymushroom` quantity.
**Why:** the owner: an NPC switches an ability for 1 Mini Seta, to any of the Pokémon's abilities, hidden included.

**Q: What goes in a member's four move slots?**
A: The tab's TMs first (any TM on any member, since compatibility is unknown), then any Gen 1–5 move. Picked moves feed offensive coverage. When the export carries the Pokémon's learnable moves (`--moves`), the one move picker lists only those instead, in three groups: Move Relearner, TMs, and "Not checked yet" (TMs the game has not rolled for the species, marked `?`), with no "All moves". The summary gains a Moves tab listing the same groups; the bag's TMs pocket keeps teaching TMs, greying out members that cannot learn one ("Can't learn") and marking unchecked ones; and a team member holding a move it cannot learn (picked before such an export was imported) shows that slot in the warning colour with a line naming the moves. An export without `moves` behaves as before. Designed in the Open Sheet Screens canvas, "Learnable moves" row. _(owner, 2026-10-16: learnable moves in the site, one picker for relearner and TMs, the bag's TM teaching kept)_
**Why:** the owner.

**Q: What does the team page show?**
A: Stats: each member's base stats and its Level 50 stat range (IVs 0–31, 1 EV in every stat, its nature), and the team's speed order. A defensive chart: for each of the 18 types, how many members are weak, resist or are immune, counting the abilities that change matchups (Levitate, Flash Fire, Water Absorb, Thick Fat and the like, a hand-kept list of Gen 3–5 abilities), with holes flagged. Offensive coverage: which types the picked moves hit super-effectively, a member's STAB types standing in when it has no moves, and which types nothing covers.
**Why:** the owner chose stats, defensive chart and offensive coverage. The Level 50 range is exact for the league's pokepastes: Level 50, real IVs, 1 EV in every stat (Wonder: `rules.md` → Pokepastes).

**Q: How does the team page compute its analysis?**
A: With Showdown's Gen 9 type chart from `@pkmn/dex`, over each member's Showdown types and its picked ability (its current one when none is picked); members with an unknown species are left out. The speed order sorts members by their IV 31 speed, then their IV 0 speed. The hand-kept ability list is Levitate (Ground), Flash Fire (Fire), Water Absorb and Storm Drain (Water), Volt Absorb, Motor Drive and Lightning Rod (Electric), Sap Sipper (Grass) as immunities; Thick Fat (Fire and Ice) and Heatproof (Fire) as halving; Dry Skin (immune to Water, ×1.25 from Fire); and Wonder Guard, which lets only super-effective hits through. A member is weak when it takes more than ×1, resists below ×1 and is immune at ×0; a type is a hole when more members are weak to it than resist or are immune to it. Coverage counts a member's damaging picked moves, leaving out status moves, fixed-damage moves (Seismic Toss, Sonic Boom…), one-hit KOs, moves whose damage ignores type matchups (Counter, Mirror Coat, Metal Burst, Bide, Final Gambit, Psywave, Super Fang, Endeavor) and Hidden Power, whose type depends on IVs the export does not hold; a member with no damaging move picked stands in with its STAB types. A type is covered when some member's attacking type hits it super-effectively on its own.
**Why:** build choices taken while building the team page, with the abilities limited to Gen 3–5 ones that change a type matchup; Filter and Solid Rock only trim super-effective damage and change no matchup. _(2026-10-16)_

## Surfaces, Reuse and Data

**Q: Where does the code live?**
A: `pkmn/site/`, a project of its own; its lasting docs go under `docs/pkmn/site/`. Open Sheet is a route of the site (`/open-sheet`), beside a home page that lists the tools.
**Why:** the owner.

**Q: What is it built with?**
A: npm; Vite 8, React 19, TypeScript 7, Tailwind 4 and shadcn/ui, each at its latest stable version on the day the site is scaffolded, pinned exactly; TanStack Router; zod 4 for the import schema; Dexie over IndexedDB for storage; `@pkmn/dex` and `@pkmn/img`. The gate is `npm run gate`: `tsc` and `vitest`. Latest as of 2026-10-15: vite 8.3.4, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, shadcn 4.21.5, @cloudflare/vite-plugin 1.64.0, wrangler 4.151.0, @pkmn/dex 0.10.11, @pkmn/img 0.3.4.
**Why:** the owner chose Vite, React, TypeScript, Tailwind and shadcn at their latest versions, to future-proof the site; the rest follows the owner's unlit and blink, confirmed by the owner.

**Q: How is the scaffold put together?**
A: Routes are declared in code (`src/router.tsx`), not with TanStack Router's file-based plugin. shadcn is initialised with its Nova preset on Radix, its palette replaced by the design's dark colours as the only theme, and the design's fonts (Chakra Petch, IBM Plex Sans, IBM Plex Mono) are bundled from Fontsource rather than loaded from Google Fonts. The Worker serves static assets only, with single-page-application fallback, and `wrangler.jsonc` attaches `pkmn.enbraile.vip` as a custom domain. Scaffolded on 2026-10-16 at vite 8.3.4, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, shadcn 4.21.5, @tanstack/react-router 1.170.44, vitest 5.0.5, @cloudflare/vite-plugin 1.64.0, wrangler 4.151.0.
**Why:** two routes need no generated route tree for `tsc` to check before a build; bundled fonts keep the site free of runtime calls beyond Showdown's sprites. _(2026-10-16)_

**Q: Do the vendored shadcn components follow the theme rule?**
A: Yes. The files in `pkmn/site/src/components/ui/` take their colours from `src/index.css`'s `:root` like any component; the overlay scrim behind dialogs and sheets is a `--scrim` variable set to the design's `rgba(0,0,0,0.6)`, used through a `bg-scrim` token.
**Why:** the owner delegated the question during an unattended run; the scaffold already replaced shadcn's palette with the design's, `pkmn/site/CLAUDE.md` grants no exemption, and the Open Sheet Screens design draws that scrim behind the phone summary and the bag. _(2026-10-16)_

**Q: What is stored, and where?**
A: Imports, open tabs and teams, in the reader's browser (IndexedDB), per browser and device. Nothing goes to a server.
**Why:** the owner.

**Q: How are imports and tabs stored, and checked?**
A: Dexie database `open-sheet`, with an `imports` table (file name, import time, the validated JSON) and a `tabs` table (name, position, its import) since version 1, and a `teams` table since version 2; each tab has its own import, and closing a tab deletes it with its teams. The zod schema in `src/open-sheet/schema.ts` mirrors [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md) and ignores keys it does not know, so a field added to the export does not mark old imports. Every stored import is checked against it when the tabs load; a failing one marks its tab and opens it as the import view with the reason, and a file dropped anywhere on that tab replaces its import instead of opening a new tab. A refusal is shown above whatever view is open and names the first failing field by its JSON path, set in mono after the file name: "MIRAMEEE-open-sheet.json has no pokemon list", "… has no pokemon[0].species".
**Why:** build choices made while implementing importing; replacing in place keeps a marked tab's name, and later its teams. _(2026-10-16)_

**Q: How does the PC read an export?**
A: Each Pokémon, item and TM is looked up in `@pkmn/dex`'s Gen 9 data by `src/open-sheet/dex.ts`. A Pokémon's possible abilities are the export's `abilities` (the randomizer's), not Showdown's for the species; a current ability missing from them is listed first. The type filter uses Showdown's types, and the export's for a species Showdown does not know. Items go to the Berries pocket when Showdown marks them as berries and to Items otherwise, unknown IDs and `tinymushroom` included; `tinymushroom` shows its label without the unknown marker. Sprites are the Gen 5 static set, shiny and female where they apply, with a "?" in place of an unknown species'. Level 50 ranges use the stat formula with 1 EV, which adds nothing at Level 50. A species with a fixed `maxHP` in Showdown's data shows that HP at any IV: Shedinja's is 1. The summary is docked beside the PC from 1024 px wide and is a bottom sheet below that; the bag is a dialog, a bottom sheet on a phone.
**Why:** build choices made while implementing the PC: the export carries no pocket and the randomizer rerolls abilities, so the export's list is what the Pokémon can switch to. _(2026-10-16)_

**Q: How are teams stored and built?**
A: Each team is a row of the `teams` table (its tab, name, six slots), and the PC writes the whole row on every change. A member holds the Pokémon's index in the export and its species, its item, its picked ability (none while it keeps its current one) and four move IDs; a member whose index no longer holds that species after its import is replaced is treated as an empty slot, holding no item, and is dropped on the next save. A tab always has at least one team: its first is made as "Team 1" when the tab opens with none, and deleting the last makes a new one; a new team takes the lowest free "Team n", and a duplicate is named "<name> copy". Deleting asks first. The PC and Team views are switched in the toolbar beside the team picker; the six-slot strip sits above the PC, and a slot opens its Pokémon's summary. Only items Showdown knows can be given (so not `tinymushroom`), and a member's held item can be taken back in the Team view. Teaching a TM fills the first empty move slot, or the fourth when all are full, and does nothing if the member knows it; picking a move a member already has in another slot moves it there. The move picker is a searchable dialog listing the tab's TMs, then every move Showdown gives generations 1–5 (`@pkmn/dex`'s Gen 9 data, Hidden Power once, without its typed copies or Struggle). The summary's button reads "Team full" and is disabled when the six slots are taken; on a phone, adding or removing closes the bottom sheet.
**Why:** build choices made while implementing team building, following the Open Sheet Screens design. _(2026-10-16)_

**Q: How is a team written for Showdown?**
A: `src/open-sheet/showdown.ts` writes each member in the layout of Showdown's export: `Nickname (Species) (M) @ Item`, with the nickname only when it differs from Showdown's species name, the export's gender whenever it is `M` or `F` (Showdown's own export leaves it out for a species of fixed gender; its importer accepts it), and the item only when one is held; then `Ability:` (the picked one, else the current one, left out when the export has none), `Level: 50`, `Shiny: Yes` when shiny, `<Nature> Nature` when the export has one, and one `- Move` line per filled move slot. Names are Showdown's, and an ID it does not know is written as is. Members are separated by a blank line; empty slots, members whose index no longer holds their species and species Showdown does not know are left out. The "Copy for Showdown" button sits in the Team view's header beside the Mini Seta count, is disabled when nothing would be copied, and reads "Copied", or "Copy failed" when the browser refuses the clipboard, for a moment after a click.
**Why:** build choices made while implementing the copy: Showdown's importer could not place a species it does not know, and the rest follows the format its own export writes. _(2026-10-16)_

**Q: What does it look like?**
A: As the [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1) design in Claude Design, signed off by the owner on 2026-10-16: the home page, importing into tabs, the PC with its summary and bag, and the Team view, on desktop and phone. One dark theme, charcoal with a slate-blue PC and orange for actions; no light theme. No helper text explaining the UI. English UI. Desktop-first: every view stays usable on a phone.
**Why:** the owner asked for the design pass first, an English UI (Showdown's names are English) and desktop-first, and in the design pass chose dark only and no explanatory labels. _(2026-10-16)_

## Dependencies and Ordering

**Q: What must exist first?**
A: The export and its JSON reference already exist. The design comes before any screen; the site's scaffold can be built alongside it. Importing comes before the PC, the PC before team building, the builder before the team page and the Showdown copy.

## Portability and Environment

**Q: Where does it run?**
A: As a Cloudflare Worker with static assets, built with `@cloudflare/vite-plugin`, at `pkmn.enbraile.vip`. Static only for now; the same Worker can take API routes when a backend comes, with no move to another product.
**Why:** the owner chose Cloudflare and the custom domain, and expects a Workers backend later.

**Q: How is it deployed?**
A: Cloudflare Workers Builds, connected to the GitHub repository: each push to `main` touching `pkmn/site/` builds and deploys, with preview URLs for branches.
**Why:** the owner.

## Secrets and Config

**Q: Are there secrets?**
A: None in the repository. Workers Builds is connected in the Cloudflare dashboard; the custom domain is set in `wrangler.jsonc`, with `enbraile.vip`'s zone on the owner's Cloudflare account, and `preview_urls` there gives each branch's Preview a public `workers.dev` URL.

## Idempotency and Rollback

**Q: How is a bad deploy undone?**
A: By rolling back to an earlier Worker version in Cloudflare, or reverting the commit, which redeploys.

**Q: What happens to stored data when its shape changes?**
A: Dexie's schema versions migrate the stored model. A stored import that no longer passes the current schema, because the export's JSON changed, is marked in its tab, with a prompt to import the file again; it is never silently dropped.
**Why:** the JSON has no format version ([Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md)), so the site checks shape, not version.

## Observability

**Q: What does it log?**
A: Nothing of its own. Cloudflare's built-in Workers analytics and logs cover the deploy; import errors are shown to the reader.

## References

- [Open Sheet](open-sheet.md), the brief
- [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md), [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md), [How to Run and Share the Open Sheet Export](../pkmn/tools/how-to/run-the-open-sheet-export.md)
- Wonder: `docs/domains/competition/reference/rules.md` (The League, Pokepastes); `packages/randomlocke/src/randomlocke/data/types.txt`, `showdown.txt`
- The game's ability items: `game/extracted/es-v4.14/scripts/268_Item_Effects.rb` (Ability Capsule, Ability Patch); `plugins/Random Pokemon & Moves + Randomizer EX (Abilities)/000_Config.rb:264` (`TINYMUSHROOM` never randomized)
- The owner's other sites for the stack: `~/workspace/unlit/apps/web/`, `~/workspace/blink/`
- `@pkmn/dex`, `@pkmn/img`: https://github.com/pkmn/ps
