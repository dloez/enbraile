# How to Run and Deploy the Site

Run `pkmn/site/` locally, check it, and get a change to `pkmn.enbraile.vip`. Why it is built and hosted this way is in [The pkmn Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- A Postgres database for the API: any local Postgres, or a Neon branch.
- For deploying, migrating production and rolling back: access to the owner's Vercel project and its Neon database.

## Steps

### 1. Install

From `pkmn/site/`:

```sh
npm install
```

npm runs only the install scripts listed under `allowScripts` in `package.json`.

### 2. Set up the database

Copy `.env.example` to `.env.local` (untracked) and fill in each variable:

- `DATABASE_URL`: the Postgres connection string, e.g. `postgres://postgres:<password>@localhost:5432/postgres`, or the Neon `dev` branch's.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters, e.g. from `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: `http://localhost:5173`, the Vite dev URL.

Then apply the migrations and make yourself an admin:

```sh
npm run db:migrate
npm run admin:create <name>
```

`admin:create` asks for the password twice; it refuses a name already taken and a password under 8 characters. Every script reads `.env.local`; a variable already set in the shell wins over it.

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate`, check the migrations with `npx drizzle-kit check`, and commit the new files in `drizzle/`. A migration only goes forward: to undo a change, generate another.

### 3. Run it locally

In two terminals:

```sh
npm run dev:api
npm run dev
```

`dev:api` serves the API on port 8787 and restarts on changes; Vite prints the local URL and proxies `/api` to it. Open Sheet is at `/open-sheet`, and admins sign in at `/admin`. Imports and teams are stored in that browser's IndexedDB for the dev origin.

### 4. Run the gate

```sh
npm run gate
```

It runs `tsc -b`, and must pass before a change is done; the site has no tests, so check a change by running it (step 3).

### 5. Set up production (once)

In the Vercel dashboard, add Neon from the Vercel Marketplace (free tier) to the project, and in Neon keep a production branch and a `dev` branch. Set the project's environment variables:

| Variable | Production | Preview |
|----------|------------|---------|
| `DATABASE_URL` | the production branch's pooled connection string | the `dev` branch's |
| `BETTER_AUTH_SECRET` | a random secret | another random secret |
| `BETTER_AUTH_URL` | `https://pkmn.enbraile.vip` | unset |

Then migrate each branch and make the admins, running step 2's commands with that branch's `DATABASE_URL` set in the shell.

### 6. Deploy

Migrate production first when the change carries a new migration: run `npm run db:migrate` with the production branch's `DATABASE_URL` set in the shell. Then push to `main`. Vercel builds and deploys every push that touches `pkmn/site/` to production, and a branch push gets a public preview URL, shown on the commit's GitHub status and in the Vercel dashboard. There is no manual deploy command.

### 7. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore.

## Verification

- `https://pkmn.enbraile.vip` serves the home page, and `/open-sheet` the tool.
- `/admin` signs an admin in with the password `admin:create` set, refuses a wrong one with "Wrong username or password", and signs out.
- `curl -sI https://pkmn.enbraile.vip` shows `server: Vercel`.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
