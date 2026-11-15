# How to Run and Deploy the Site

Run `zombies/site/` locally, publish a map to it, and get it to `zombies.enbraile.vip`. Why it is built this way is in [The Zombies Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- Docker with Compose, for the local Postgres.
- For production: access to the owner's Vercel team `dloez`, its Neon integration, the Cloudflare `enbraile.vip` zone and the owner's 1Password.

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

A real map's `bundle.json` is built first from the files the ee-coach skill prepared in its dir ([Research and dossier building → Compile and publish](../../../../.claude/skills/ee-coach/references/research.md#4-compile-and-publish)):

```sh
npm run compile -- ../maps/<game>/<map>/
```

It prints the counts of steps, ladders, rungs, Alts and knowledge entries, or every error by file and line or step and rung, never the text. The test map has no prepare files; its `bundle.json` is written by hand. Then:

```sh
npm run publish -- test-map
```

The path is the map's dir, holding its `bundle.json`, relative to where the command is run; from `zombies/site/` a real map's is `../maps/<game>/<map>/`. It prints the version stored, or `unchanged` when the bundle equals the latest one, and every schema error when it is rejected.

### 7. Run the gate

```sh
npm run gate
```

### 8. Set up production (once)

This was done on 2026-11-15, except the DNS record and the admin token, which wait on the owner.

The Vercel project is `enbraile-zombies` (ID `prj_VYZlP7Ln4TfrWJAJzdqzafTbvzwD`), root directory `zombies/site`, framework Vite, Node 26, with the function in `fra1` from `vercel.json` and Deployment Protection on every deployment but the custom domain. Its database is the Neon project `zombies` (ID `silent-morning-44744308`, Frankfurt, `aws-eu-central-1`), made from the Vercel Marketplace as `npx vercel integration add neon --name zombies --meta region=fra1 --no-connect --no-env-pull`, since the Neon organization is managed by Vercel and refuses `neonctl projects create`; `--no-connect` keeps the integration from writing variables of its own. It holds the branches `main` (production) and `dev` (previews), each with the database `neondb`.

Set the project's environment variables, piping each secret in so it never reaches a command line:

| Variable | Production | Preview |
|----------|------------|---------|
| `DATABASE_URL` | `main`'s pooled connection string, with `sslmode=verify-full` | `dev`'s, the same way |
| `ROOT_URL` | `https://enbraile.vip` | the same |
| `ZOMBIES_ADMIN_TOKEN` | the 1Password item's value | unset |

```sh
v=$(npx neonctl connection-string main --project-id silent-morning-44744308 --pooled | sed 's/sslmode=require/sslmode=verify-full/' | tr -d '\n')
printf %s "$v" | npx vercel env add DATABASE_URL --environment production --sensitive
unset v
```

and the same with `dev` for `--environment preview`. The value goes through a variable rather than a straight pipe because `vercel env add` reads its stdin before a piped `npx neonctl` has written anything. `DEV_USER_ID` stays unset in Vercel, so every deployment asks the root site who is signed in; `ZOMBIES_URL` belongs to the shell running `publish`, not to the project.

Make the admin token in 1Password and hand it to Vercel without printing it:

```sh
op item create --category password --title "zombies admin token" --generate-password=48,letters,digits
v=$(op read "op://Private/zombies admin token/password")
printf %s "$v" | npx vercel env add ZOMBIES_ADMIN_TOKEN --environment production --sensitive
unset v
```

With the item in another vault, put that vault's name in place of `Private` here and in step 9.

`zombies.enbraile.vip` is on the project's domains (`npx vercel domains add zombies.enbraile.vip enbraile-zombies`). In Cloudflare's `enbraile.vip` zone, add a `CNAME` for `zombies` to the target Vercel names for it (`npx vercel api /v6/domains/zombies.enbraile.vip/config`, `recommendedCNAME`, `0cedcc0080c9a767.vercel-dns-017.com` on 2026-11-15), with the proxy off: a proxied record would be blocked during LaLiga matches ([The Zombies Site → Hosting](../explanation/site.md#hosting)). The [root site](../../../home/site/explanation/site.md) lists `https://zombies.enbraile.vip` in `trustedOrigins` (`home/site/api/_lib/auth.ts`), so its sign-in returns to the site.

### 9. Deploy

Push to `main`. The `zombies-site.yml` workflow deploys every push to `main` that touches `zombies/site/` to production, and another branch's push gets a preview, whose URL ends the workflow's run ([How to Deploy the Vercel Projects](../../../general/how-to/deploy-vercel-projects.md)). Vercel's build runs `npm run build && npm run db:migrate` (`buildCommand` in `vercel.json`) against that environment's `DATABASE_URL`, so a deploy migrates its own branch before it goes live, and a failed build migrates nothing.

Then publish the maps to production, with the token read from 1Password into the shell:

```sh
ZOMBIES_ADMIN_TOKEN="$(op read 'op://Private/zombies admin token/password')" ZOMBIES_URL=https://zombies.enbraile.vip npm run publish -- test-map
```

### Inspect deployments and the database from the shell

From `zombies/site/`, after `npx vercel link --project enbraile-zombies` once (`.vercel/` is gitignored), the commands of [pkmn's table](../../../pkmn/site/how-to/run-and-deploy-the-site.md#inspect-deployments-and-the-database-from-the-shell) work with `enbraile-zombies` and `--project-id silent-morning-44744308` in place of pkmn's. `select count(*) from drizzle.__drizzle_migrations` on a branch shows how many migrations it has applied. A connection string carries its password: keep it out of commits and logs.

### 10. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore. A map's bundle is reverted by publishing the older bundle again.

## Verification

The maps page shows Harrow Station with a Test map tag and "No runs yet". Publishing it again prints `version 1, unchanged`. In production, `curl -s -o /dev/null -w '%{http_code}' https://zombies.enbraile.vip/api/maps` answers `401` signed out, and a signed-in member sees the same page at `https://zombies.enbraile.vip`.
