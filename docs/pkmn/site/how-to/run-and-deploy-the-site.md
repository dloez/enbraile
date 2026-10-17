# How to Run and Deploy the Site

Run `pkmn/site/` locally, check it, and get a change to `pkmn.enbraile.vip`. Why it is built and hosted this way is in [The pkmn Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- For a manual deploy only: a Wrangler login to the owner's Cloudflare account (`npx wrangler login`).

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

It runs `tsc -b` and `vitest run`, and must pass before a change is done.

### 4. Deploy

Push to `main`. Workers Builds builds and deploys every push that touches `pkmn/site/`; a branch push gets a preview `workers.dev` URL. To deploy by hand instead:

```sh
npm run deploy
```

which builds and runs `wrangler deploy`.

### 5. Roll back

Roll back to an earlier version of the `pkmn-site` Worker in the Cloudflare dashboard, or revert the commit and push, which redeploys.

## Verification

- `https://pkmn.enbraile.vip` serves the home page, and `/open-sheet` the tool.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
