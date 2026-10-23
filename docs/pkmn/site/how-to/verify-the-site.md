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
- **As a test player:** open `http://localhost:5173/api/auth/dev/sign-in?username=<name>` with `red`, `blue` or `leaf`. It starts a session for that player and redirects to `/`. Red and Blue are allowed and land on the home; Leaf is not, and lands on the waiting page until an admin allows them at `/admin/players`. It refuses an admin or an unknown name with 404, and does not exist at all unless `DEV_SIGN_IN` is `1`.
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

`mc stat` and `mc cat` on a `l/pkmn-site/<key>` path show one object. A game's zip is under `games/<game id>/`, and the `game` table's `file_key` names the current one. `mc ls --incomplete --recursive l/pkmn-site` lists the multipart uploads still open, which a finished or abandoned upload leaves none of. MinIO drops open uploads when its container is killed, so read this before restarting it.

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
- Signed in as `leaf`, `/` shows "Waiting for an admin" and `/api/players` answers 403; after the admin presses Allow beside Leaf at `/admin/players`, a reload shows the home.
- With `DEV_SIGN_IN` unset and `npm run dev` restarted, `http://localhost:5173/api/auth/dev/sign-in?username=red` answers 404.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Browser "chrome-for-testing" is not installed` | Run the install command in Prerequisites; a new `@playwright/mcp` pin needs its own browser build. |
| Every browser call hangs, screenshots above all | `.mcp.json`'s `WAYLAND_DISPLAY` was dropped; restore it and reconnect with `/mcp`. `wsl --shutdown` from Windows repairs a wedged compositor. |
| `browser_type` or `browser_click` says the input is invalid | They take the element as `target`, the `ref` from the latest snapshot; refs change whenever the page re-renders. |
| A snapshot taken right after navigating is empty | The page had not rendered yet; `browser_wait_for` its heading first. |
| Going offline (Chrome DevTools Protocol's `Network.emulateNetworkConditions`) does not break an upload's part already on its way | Offline only fails requests that start while it lasts. To cut parts mid-way, slow the upload with the same call's `uploadThroughput` and run `docker compose restart -t 0 minio` while it runs; `docker compose stop -t 0 minio` leaves a port that accepts no connection, as a dropped network does. |
| A `page.route` stub keeps answering after `page.unroute` | `unroute` only removes a route given the same matcher object; `page.unrouteAll()` removes every one. |
| Port 5432, 9000 or 5173 is taken | Run a second stack as [How to Run and Deploy the Site](run-and-deploy-the-site.md) step 2 says, and start Vite with `npm run dev -- --port <port>`, with `BETTER_AUTH_URL` and the URLs above on that port. |
