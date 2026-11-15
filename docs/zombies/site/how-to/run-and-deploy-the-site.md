# How to Run and Deploy the Site

Run `zombies/site/` locally and publish a map to it. Why it is built this way is in [The Zombies Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- Docker with Compose, for the local Postgres.

## Steps

### 1. Install

From `zombies/site/`:

```sh
npm install
```

`allowScripts` in `package.json` records the esbuild versions whose install scripts are approved, as in pkmn.

### 2. Start Postgres

```sh
docker compose -p zombies-site up -d --wait
```

It listens on port 5433, so it runs beside pkmn's on 5432; set `POSTGRES_PORT` to move it.

### 3. Configure

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Locally |
|----------|---------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5433/zombies` |
| `ROOT_URL` | `https://enbraile.vip`, read only when `DEV_USER_ID` is empty |
| `ZOMBIES_ADMIN_TOKEN` | Any long random string, e.g. `openssl rand -hex 24` |
| `ZOMBIES_URL` | Where `publish` sends bundles: `http://localhost:8789` |
| `DEV_USER_ID` | Any ID, to be signed in without the root site |

### 4. Migrate

```sh
npm run db:migrate
```

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate -- --name <what>` and commit it.

### 5. Run it

In two terminals:

```sh
npm run dev:api
npm run dev
```

The page is at `http://localhost:5175`, the API at `http://localhost:8789`.

### 6. Publish a map

```sh
npm run publish -- test-map
```

The path is the map's dir, holding its `bundle.json`, relative to where the command is run; from `zombies/site/` a real map's is `../maps/<game>/<map>/`. It prints the version stored, or `unchanged` when the bundle equals the latest one, and every schema error when it is rejected.

### 7. Run the gate

```sh
npm run gate
```

## Verification

The maps page shows Harrow Station with a Test map tag and "No runs yet". Publishing it again prints `version 1, unchanged`.
