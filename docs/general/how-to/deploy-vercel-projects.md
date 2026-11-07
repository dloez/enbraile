# How to Deploy the Vercel Projects

The three Vercel projects, `enbraile-dj` (`dj/panel/`), `enbraile-pkmn` (`pkmn/site/`) and `enbraile-home` (`home/site/`), are deployed by GitHub Actions, not by Vercel's Git integration ([Repository Layout → Decisions](../explanation/repository-layout.md#decisions)). Each has a workflow, `.github/workflows/dj-panel.yml`, `pkmn-site.yml` and `home-site.yml`, that runs only on a push touching its project's folder or the workflow itself. A push to `main` deploys to production; a push to any other branch makes a preview. Either way the job runs `vercel deploy` from the repository root, with the project's ID in `VERCEL_PROJECT_ID`. Vercel uploads the checkout and builds it in its own cloud with the project's root directory, build command and environment variables, as the Git integration did, so pkmn's migrations and preview seeding run unchanged. Each project's `vercel.json` sets `"git": { "deploymentEnabled": false }`, so Vercel no longer builds pushes itself.

## Prerequisites

- The Vercel CLI signed in to the `dloez` team (`npx vercel whoami`).
- Admin access to the GitHub repository.

## Steps

### 1. Make a token

In Vercel, Account Settings → Tokens, create a token scoped to the `dloez` team, named `enbraile-github-actions`, and copy it.

### 2. Store it in GitHub

```sh
gh secret set VERCEL_TOKEN
```

Paste the token when asked. It is the only secret: the team and project IDs in the workflows are not secret.

### 3. Deploy

Push. A workflow can also be run by hand from the Actions tab (`workflow_dispatch`), which deploys the branch it is run on.

## Verification

The push's run under Actions ends with the deployment's URL, and the deployment shows in the Vercel dashboard. A push touching none of the three folders starts no Vercel deployment.
