# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.
