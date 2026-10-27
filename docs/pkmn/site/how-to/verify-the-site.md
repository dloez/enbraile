# How to Verify the Site

Check a change to `pkmn/site/` end to end on the local stack: drive the real site in a browser through the Playwright MCP server, signed in as a test player or an admin, then read what landed in Postgres and in the MinIO bucket. This is a driver, not a test runner: nothing it does is saved as a test or runs in the gate. Why the site is checked this way is in [The pkmn Site → Decisions](../explanation/site.md#decisions); the `verify-site` skill (`.claude/skills/verify-site/SKILL.md`) points an agent here.

## Prerequisites

- The local stack running, migrated and seeded, and `npm run dev` serving the site, with `DEV_SIGN_IN=1` in `.env.local` ([How to Run and Deploy the Site](run-and-deploy-the-site.md), steps 2 to 4).
- Claude Code started from the repository root, so it loads the root `.mcp.json`, which pins `@playwright/mcp` and runs it headless and isolated, with `WAYLAND_DISPLAY` empty so Chromium on WSL never waits on a wedged Wayland compositor.
- The browser binary, downloaded once per machine into `~/.cache/ms-playwright/`, with the version `.mcp.json` pins:

  ```sh
  npx @playwright/mcp@0.0.83 install-browser chrome-for-testing
  ```

## Steps

### 1. Sign in

- **As an admin:** open `http://localhost:5173/admin` and sign in as `admin` with the password `admin-password`, typing into the Username and Password boxes and pressing "Sign in"; the page shows "Admin" and "Sign out".
- **As a test player:** open `http://localhost:5173/api/auth/dev/sign-in?username=<name>` with `red`, `blue` or `leaf`. It starts a session for that player and redirects to `/`. Red and Blue are allowed and land on the seeded Series 1, whose players they are; Leaf is not, and lands on the waiting page until an admin allows them at `/admin/players`. It refuses an admin or an unknown name with 404, and does not exist at all unless `DEV_SIGN_IN` is `1`.
- **Signed out:** every page but `/admin` shows the sign-in page. Discord sign-in works only with the `DISCORD_*` variables set and `localhost:5173` registered in the Discord application, so locally a player signs in with the test sign-in.

Each sign-in replaces the browser's session cookie, so one browser is one user at a time. The browser's profile lives in memory and starts empty whenever the MCP server restarts.

### 2. Drive the flow

Navigate to the page, read it with `browser_snapshot` (the accessibility tree, with a `ref` per element), and act on elements by passing that `ref` as the `target` of `browser_click`, `browser_type` or `browser_fill_form`. Wait for content with `browser_wait_for` before reading a page that loads data. Take `browser_take_screenshot` only when the question is visual, always with a `filename` under `.playwright-mcp/` (gitignored), and use `browser_resize` to 390×844 for the phone layout. `browser_console_messages` and `browser_network_requests` show errors and the API calls a page made.

### 3. Read the database

From `pkmn/site/`:

```sh
docker compose exec -T postgres psql -U postgres -d pkmn -c '<SQL>'
```

For example, the sessions and whose they are:

```sql
select u.username, u.admin, s.created_at from session s join "user" u on u.id = s.user_id order by s.created_at;
```

### 4. Read the bucket

```sh
docker compose exec -T minio sh -c 'mc alias set l http://localhost:9000 minioadmin minioadmin >/dev/null && mc ls --recursive l/pkmn-site'
```

`mc stat` and `mc cat` on a `l/pkmn-site/<key>` path show one object. A game's zip is under `games/<game id>/`, and the `game` table's `file_key` names the current one. A save zip is under `saves/<series id>/<player id>/`, and each `snapshot` row's `file_key` names the one it holds and its `rolled_key` the rolled zip it hands back, beside it as `<uuid>-rolled.zip`; the snapshots and whose they are:

```sh
docker compose exec -T postgres psql -U postgres -d pkmn -c 'select u.username, m.name, s.pokemon, s.fainted, s.file_key, s.rolled_key from snapshot s join save v on v.id = s.save_id join "user" u on u.id = v.user_id join milestone m on m.id = s.milestone_id'
``` `mc ls --incomplete --recursive l/pkmn-site` lists the multipart uploads still open, which a finished or abandoned upload leaves none of. MinIO drops open uploads when its container is killed, so read this before restarting it.

### 5. Reset

```sh
docker compose down -v
docker compose up -d --wait
npm run db:migrate
npm run seed
```

This wipes the database and the bucket and brings back the seeded state; `npm run dev` can keep running across it.

## Verification

- From a reset, after signing in as `admin` and as `blue`, step 3's query lists one session for each, `admin` with `admin` true.
- `http://localhost:5173/api/auth/dev/sign-in?username=admin` answers 404.
- Signed in as `leaf`, `/` shows "Waiting for an admin" and `/api/players` answers 403; after the admin presses Let in beside Leaf at `/admin/players`, a reload shows Series 1 without its Download, since Leaf is not one of its players.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `admin`, Let in beside Leaf at `/admin/players`, then Leaf ticked into Series 1's players and Save, sets Leaf's `needs_save` (step 3's `select u.username, sp.needs_save from series_player sp join "user" u on u.id = sp.user_id`), Red's and Blue's staying false. Signed in as `leaf`, `/` shows "Upload your save" and "Series 1 is under way"; Upload save takes the zip, preselects the save's milestone, and its done step keeps Download zip; Open PC opens Leaf's PC at that snapshot with the header, `needs_save` reads false, and `/` goes to Series 1. Signed in as `red`, `/` goes straight to Series 1.
- From a reset, signed in as `admin`, a new manual draft with Blue ticked into its players and filled in until Start enables (after Series 1 is finished) starts with Blue's `needs_save` true on it in step 3's query, and signed in as `blue`, `/` shows "Upload your save" for it.
- From a reset with a save zip in `pkmn/site/saves/`, Red's row on Series 1 opens on "At <milestone>" with the PC, Fainted and Journey tiles filled, two snapshot chips, and its Fainted tile opens Red's series page at Fallen, where one Pokémon reads "<milestone before> → <milestone>"; signed in as `blue`, Upload on Blue's row takes the same zip as a snapshot, and the query in step 4 lists one row for each.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, the header's name opens Red's profile with Series 2 above Series 1, its Career play time the sum of the two banners' and its Fallen their sum; Blue's profile, opened from Blue's name on a series page, has both banners with every box "—".
- From a reset with `MIRAMEEE-save.zip` as the first save zip in `pkmn/site/saves/`, signed in as `admin`, Red's open row on Series 1 ends in the Admin panel: setting Post-League's fainted count turns its Fainted tile to that count and its source to "Set by hand by admin", a new upload of the zip to Post-League keeps it, and Clear brings back the save's 12; picking a milestone under Progress moves Red's badge on the track there; moving Gym 8 to Gym 7 and deleting it leaves its zip and rolled zip in the bucket, since Series 2's Tournament still holds them. Signed in as `red`, the row has no Admin panel and each override route answers 403.
- Signed in as `admin`, inviting a Discord user ID at `/admin/players` lists them under Allowed as "Invited", and inviting it again says they are already a player; the invite can be ticked into Series 1, which is running, and Save keeps it, while unticking Red, who has a snapshot there, is refused; Delete beside the invite deletes it at one press. Delete beside Red asks "Confirm delete" and, pressed, takes Red off Series 1; step 3 finds no Red `user`, `save` or `snapshot` row, and step 4 nothing left under Red's `saves/` prefix, the game's zip still there. Step 3 shows the invite's `user` row allowed and a `discord` `account` row with that ID and no access token. A Discord sign-in itself is not driven locally.
- Signed in as `admin`, on Series 1's form, renaming Gym 1, moving Gym 2 below Gym 3, removing Gym 4 and adding a milestone saves, and the series page shows the new order with Red's snapshots still at Gym 8 and Post-League; removing Post-League says "Move or delete the snapshots at Post-League first".
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, `/teams` lists the Seed team under Yours at 3/6; on it, giving an item whose bag holds one to a member makes the next member's item editor read "None left" for it, a Mini Seta ability lowers the head's Mini Setas by one, "Add a Pokémon" fills a slot with a Pokémon not faded in the box, and a reload keeps all of it, which step 3's `select name, slots from team` shows; Copy for Showdown and Paste make a new team of the same members; New team on `/teams` opens an empty team on Post-League, and "Add to team" in Red's PC summary puts that Pokémon in it. Red's row on Series 1 and the Series 1 banner of Red's profile count the teams. Signed in as `blue`, Red's teams are under Other trainers and read-only, `PUT` and `DELETE /api/teams/<id>` answer 403, and New team says to upload a snapshot first and offers every snapshot to start from instead.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, on the Seed team, **+ Source** lists Red's Gym 8 and Series 2 Tournament snapshots; adding Gym 8 shows a second chip with its own Mini Setas and a remove button, which the Post-League chip, used by the members, lacks; "Add a Pokémon" on Gym 8's tab puts one of its Pokémon in a slot, not faded though its Post-League twin is in the team, and its chip's remove button goes; giving it an item the bag holds one of leaves that item at ×1 in a Post-League member's item editor, and a Mini Seta ability on it lowers only Gym 8's chip; a reload keeps it, and step 3's `select * from team_source` lists both snapshots in order. Paste of two sets of one Pokémon both holding that item makes a team on both sources, one member from each, each holding it. Taking the Gym 8 member out brings back its remove button, and removing it leaves one chip. A `PUT` of sources leaving out one a member uses answers 400. Signed in as `blue`, New team's "Or start from" menu makes a team on Red's Post-League snapshot, and "Add a Pokémon" puts one of Red's Pokémon in it.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, on the Seed team, Members 8 adds two empty places and turns 6 and 7 off once slot 8 is filled; with eight members, Analyse: Pick 6 drops two from the Speed order, "6 of 6 in" disables each Out, and taking one In out and putting an Out in changes the Speed order; a reload keeps the size, Pick 6 and the pick, and step 3's `select name, size, jsonb_array_length(slots) from team` reads 8 and 8. Copy for Showdown and Paste make a new team of eight; on it, taking out slot 8 turns 7 back on, and taking out slot 7 lets Members 6 cut it back to six, the Analyse switch gone. A `PUT` of nine slots, or of five, answers 400.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, on the Seed team, **+ Source** ends in "Any Pokémon"; picking it adds a dashed chip and an Any Pokémon tab to "Add a Pokémon", whose species grid puts a free member in a slot with the set typed beside it (252 Spe on a Jolly Garchomp reads 169 at Level 50); its card reads "Free" with **Set**, its item editor offers "Any item" and its abilities cost nothing, and a reload keeps it, which step 3's `select any_pokemon, slots from team` shows as a slot with `"free": true`. Copy for Showdown writes its EVs, nature and level; with a free member on the team neither the Any Pokémon chip nor the snapshot chip it shares the team with has a remove button, and a `PUT` of `{"anyPokemon": false}` answers 400. Paste of a set Red's PC holds and three it does not (Garchomp, Kyurem-Black, Mewtwo) makes a new team and keeps the dialog open over the current team, listing the three "As free members", until "Open the team" opens the new one; Paste of a species outside the pool (Pikachu) lists it "not in the team's pool", and on a team without Any Pokémon, Garchomp is "not in the team's sources". Signed in as `blue`, New team's "Or start from" menu's "Any Pokémon" makes a team with that one source, and a paste of six pool species makes a team of six free members.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, on the Seed team, the panel's Speed lists the members against the pool's benchmarks; Full analysis's header shows the Tera toggle and the chip "Gen 9 · species ≤ Gen 5 · moves ≤ Gen 5 · fully evolved · 357"; Tera on gives each Roles card a Tera type picker; in the Opponents view, Data 5 takes the Tera toggle away and makes the chip "Gen 5 · species ≤ Gen 5 · moves ≤ Gen 5 · fully evolved · 363", and a reload keeps it, which step 3's `select name, pool from team` shows. Signed in as `blue`, the Seed team's pool bar is disabled and a `PUT` of its pool answers 403; a team made from a Series 2 snapshot takes Series 2's `pool`, and one sent with a pool keeps that. Signed in as `admin`, a draft's Default pool saves with the form, which step 3's `select number, pool from series` shows.
- From a reset with a save zip in `pkmn/site/saves/`, signed in as `red`, on the Seed team with "Any Pokémon" added, a free Garchomp's move picker lists "Can learn" (Earth Power among them) over "Other moves"; picking Earth Power and then setting Moves up to 3 in the Opponents view makes the chip read "moves ≤ Gen 3", takes Earth Power out of the picker and turns Garchomp's Earth Power to the warning colour, its title "Earth Power is from Gen 4, past the pool's moves up to Gen 3"; step 3's `select pool->>'movesGen' from team` reads 3. Signed in as `admin`, a draft's Moves up to saves with the form.
- From a reset with a save zip in `pkmn/site/saves/`, with a second team of Red's and a team of Blue's on Red's Post-League snapshot, signed in as `red`, **Compare** on `/teams` turns the rows into picks and **Compare teams** on at two; picking Red's two teams and Blue's opens "Compare 3 teams" with the chip "Gen 9 · species ≤ Gen 5 · moves ≤ Gen 5 · fully evolved · 357", a column per team headed by its owner, and the Seed team's Members cell "3 empty of 6"; in Head to head, the attacker's moves fill Move, the range and verdict change with the move, and **⇄ Swap sides** swaps the two. At 390×844 the teams are numbered above the scoreboard and "Back to Teams" closes it. The old Team Analysis address shows the not-found page, and its old drafts key, set again in `localStorage`, is gone after a reload.
- From a reset with `MIRAMEEE-save.zip` as the first save zip in `pkmn/site/saves/`, step 3's `select m.name, s.data ? 'party', s.data->'pokemon'->0->'details' ? 'place', s.world is not null, s.data->'details'->'position' from snapshot s join milestone m on m.id = s.milestone_id` reads no party, no place, a `world` and map 136 at (39, 35) on every snapshot, and the snapshot's first Pokémon differs from one reset to the next. Red's PC's Bag shows "11" Mini Setas and ₽1,168,806 beside its title and no Mini Seta row, its items and the selected TM drawn with the game's sprites, and `/admin/games` reads "Item icons 893" when the game is installed in `pkmn/games/anil/game/`. Signed in as `red`, Red's PC at Post-League reads "79 Pokémon" with **Fainted · 12** unpressed; pressing it shows 91, the fainted last, greyed with a cross, and a fainted one's summary has the "Fainted" chip and no "Add to team", which a living one's keeps. On the Seed team, LAVATIVA's nature editor marks Bold "In game", Hasty "Mint in bag ×4" and the rest "Mint $30,000"; picking Brave drops the chip's money from $1,168,806 to $1,138,806 and marks the card with a mint and "$", picking Hasty on ALEGRIA leaves the money as it is and marks a mint alone, and a reload keeps both, which step 3's `select slots from team` shows as `"nature": "brave"` and `"hasty"`. Signed in as `admin`, saving 12 Mini Setas and 1000000 money in the game's "Team builder costs" sets `ability_setas` and `mint_price`; back as `red`, the chip reads $168,806, every ability change reads "12 Mini Setas" and is disabled with 11 left, and every nature but the bag's mints is disabled.
- From a reset with a save zip in `pkmn/site/saves/` and the game installed in `pkmn/games/anil/game/`, with `npm run dev` started with `CRON_SECRET` set, an object put under `games/<game id>/` and one under `saves/<series id>/<player id>/` with no row naming them (step 4's command with `echo x | mc pipe l/pkmn-site/<key>` in place of `mc ls`) stay through a `GET /api/cron/sweep-files` with `Authorization: Bearer <CRON_SECRET>`, since they are under a day old; `sweepFiles()` from `api/_lib/sweep.ts`, called from a throwaway `tsx` script that first moves `Date.now` two days ahead, deletes exactly those two, while the game's zip, its icon sheet and Red's zip and rolled zip stay. The route answers 401 without the header or with another secret.
- With `DEV_SIGN_IN` unset and `npm run dev` restarted, `http://localhost:5173/api/auth/dev/sign-in?username=red` answers 404.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Browser "chrome-for-testing" is not installed` | Run the install command in Prerequisites; a new `@playwright/mcp` pin needs its own browser build. |
| Every browser call hangs, screenshots above all | `.mcp.json`'s `WAYLAND_DISPLAY` was dropped; restore it and reconnect with `/mcp`. `wsl --shutdown` from Windows repairs a wedged compositor. |
| `browser_type` or `browser_click` says the input is invalid | They take the element as `target`, the `ref` from the latest snapshot; refs change whenever the page re-renders. |
| A snapshot taken right after navigating is empty | The page had not rendered yet; `browser_wait_for` its heading first. |
| Going offline (Chrome DevTools Protocol's `Network.emulateNetworkConditions`) does not break an upload's part already on its way | Offline only fails requests that start while it lasts. To cut parts mid-way, slow the upload with the same call's `uploadThroughput` and run `docker compose restart -t 0 minio` while it runs; `docker compose stop -t 0 minio` leaves a port that accepts no connection, as a dropped network does. |
| `browser_file_upload` refuses a file "outside allowed roots" (a save zip in another checkout's `pkmn/site/saves/`) | Serve the folder over HTTP (`python3 -m http.server <port> --bind 127.0.0.1` in it), then in `browser_run_code_unsafe` fetch the file and pass it to `setInputFiles` as `{ name, mimeType, buffer }` on the dialog's `input[aria-label="Save zip or export"]`; the code runs in Playwright's process, which has `fetch` but no `import`. |
| A `page.route` stub keeps answering after `page.unroute` | `unroute` only removes a route given the same matcher object; `page.unrouteAll()` removes every one. |
| Port 5432, 9000 or 5173 is taken | Run a second stack as [How to Run and Deploy the Site](run-and-deploy-the-site.md) step 2 says, and start Vite with `npm run dev -- --port <port>`, with `BETTER_AUTH_URL` and the URLs above on that port. |
