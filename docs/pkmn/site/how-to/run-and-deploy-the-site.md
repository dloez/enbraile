# How to Run and Deploy the Site

Run `pkmn/site/` locally, check it, and get a change to `pkmn.enbraile.vip`. Why it is built and hosted this way is in [The pkmn Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- For rolling back: access to the owner's Vercel project.

## Steps

### 1. Install

From `pkmn/site/`:

```sh
npm install
```

npm runs only the install scripts listed under `allowScripts` in `package.json`.

### 2. Run it locally

```sh
npm run dev
```

Vite prints the local URL; Open Sheet is at `/open-sheet`. Imports and teams are stored in that browser's IndexedDB for the dev origin.

### 3. Run the gate

```sh
npm run gate
```

It runs `tsc -b`, and must pass before a change is done; the site has no tests, so check a change by running it (step 2).

### 4. Deploy

Push to `main`. Vercel builds and deploys every push that touches `pkmn/site/` to production, and a branch push gets a public preview URL, shown on the commit's GitHub status and in the Vercel dashboard. There is no manual deploy command.

### 5. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys.

## Verification

- `https://pkmn.enbraile.vip` serves the home page, and `/open-sheet` the tool.
- `curl -sI https://pkmn.enbraile.vip` shows `server: Vercel`.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
