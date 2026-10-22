# How to Run and Deploy the Site

Run `pkmn/site/` locally, check it, and get a change to `pkmn.enbraile.vip`. Why it is built and hosted this way is in [The pkmn Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- Docker with Compose, for the local Postgres and MinIO.
- For deploying, migrating production and rolling back: access to the owner's Vercel project and its Neon database.

## Steps

### 1. Install

From `pkmn/site/`:

```sh
npm install
```

npm runs only the install scripts listed under `allowScripts` in `package.json`.

### 2. Start the local stack

From `pkmn/site/`:

```sh
docker compose up -d --wait
```

`compose.yaml` runs Postgres (database `pkmn`, user and password `postgres`) on port 5432 and MinIO (user and password `minioadmin`) on 9000, with its console on 9001; a one-shot `bucket` service makes the `pkmn-site` bucket and exits. `--wait` returns once both are healthy. To run a second checkout beside it, set `COMPOSE_PROJECT_NAME`, `POSTGRES_PORT`, `MINIO_PORT` and `MINIO_CONSOLE_PORT` in the shell for every `docker compose` command, and match `DATABASE_URL` in step 3.

`docker compose down -v` stops it and deletes its data; step 3's commands then bring back a known state.

### 3. Set up the database

Copy `.env.example` to `.env.local` (untracked). Its values fit the local stack; fill in `BETTER_AUTH_SECRET`:

- `DATABASE_URL`: the Postgres connection string; the example's points at the local stack, or use the Neon `dev` branch's.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters, e.g. from `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: `http://localhost:5173`, the Vite dev URL.
- `API_PORT`: the port the API listens on behind Vite, 8787.
- `DEV_SIGN_IN`: `1` turns on the dev-only test sign-in ([How to Verify the Site](verify-the-site.md)). Never set it anywhere but a local `.env.local`.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: the file store; the example's point at the local MinIO and its `pkmn-site` bucket. With a second stack's `MINIO_PORT`, match the port in `S3_ENDPOINT`.

Then apply the migrations and seed the known state:

```sh
npm run db:migrate
npm run seed
```

`seed` makes the admin `admin` with the password `admin-password`, the test players Red, Blue and Leaf, and the game "Pokémon Añil + Randomlocke" with a small stand-in zip put in the bucket, skipping any already there, and refuses a `DATABASE_URL` or `S3_ENDPOINT` whose host is not `localhost` or `127.0.0.1`. To make a real admin instead, `npm run admin:create <name>` asks for the password twice; it refuses a name already taken and a password under 8 characters. Every script reads `.env.local`; a variable already set in the shell wins over it.

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate`, check the migrations with `npx drizzle-kit check`, and commit the new files in `drizzle/`. A migration only goes forward: to undo a change, generate another.

### 4. Run it locally

```sh
npm run dev
```

Vite starts the API itself (`scripts/dev-api.ts` under `tsx watch`, on `API_PORT`, restarting on changes), proxies `/api` to it, prints the local URL, and stops the API when it stops. Open Sheet is at `/open-sheet`, admins sign in at `/admin`, and the games are at `/admin/games`. Imports and teams are stored in that browser's IndexedDB for the dev origin.

### 5. Run the gate

```sh
npm run gate
```

It runs `tsc -b`, and must pass before a change is done; the site has no tests, so check a change by running it (step 4), driving it in a browser as [How to Verify the Site](verify-the-site.md) says.

### 6. Set up production (once)

In the Vercel dashboard, add Neon from the Vercel Marketplace (free tier) to the project, and in Neon keep a production branch and a `dev` branch.

In Backblaze B2, make a private bucket and an application key limited to it, with read and write access. Give the bucket a CORS rule so browsers can upload to it and download from it straight: allowed origins `https://pkmn.enbraile.vip` and `https://*.vercel.app` for previews, operations `s3_put`, `s3_get` and `s3_head`, headers `*`, exposed header `ETag`. The bucket's S3 endpoint is shown on its page (`https://s3.<region>.backblazeb2.com`), and the region is the part after `s3.`.

Set the project's environment variables:

| Variable | Production | Preview |
|----------|------------|---------|
| `DATABASE_URL` | the production branch's pooled connection string | the `dev` branch's |
| `BETTER_AUTH_SECRET` | a random secret | another random secret |
| `BETTER_AUTH_URL` | `https://pkmn.enbraile.vip` | unset |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | the B2 bucket's endpoint, region and name | the same |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the application key's ID and key | the same |

`API_PORT` and `DEV_SIGN_IN` stay unset in Vercel: without `DEV_SIGN_IN` the test sign-in does not exist. Then migrate each branch and make the admins, running step 3's `db:migrate` and `admin:create` with that branch's `DATABASE_URL` set in the shell.

### 7. Deploy

Migrate production first when the change carries a new migration: run `npm run db:migrate` with the production branch's `DATABASE_URL` set in the shell. Then push to `main`. Vercel builds and deploys every push that touches `pkmn/site/` to production, and a branch push gets a public preview URL, shown on the commit's GitHub status and in the Vercel dashboard. There is no manual deploy command.

### 8. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore.

## Verification

- `https://pkmn.enbraile.vip` serves the home page, and `/open-sheet` the tool.
- `/admin` signs an admin in with the password `admin:create` set, refuses a wrong one with "Wrong username or password", and signs out.
- `curl -s -o /dev/null -w '%{http_code}' 'https://pkmn.enbraile.vip/api/auth/dev/sign-in?username=x'` prints `404`.
- At `/admin/games`, an admin creates a game, uploads its zip, sees its size and date after a reload, and downloads a file of the same size; `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/games` prints `401`.
- `curl -sI https://pkmn.enbraile.vip` shows `server: Vercel`.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
