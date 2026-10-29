---
name: verify-site
description: Check a change to the pkmn site (`pkmn/site/`) end to end on the local stack — Postgres and MinIO in Docker, `npm run dev`, the Playwright MCP browser signed in as a test player or an admin, then the database and the bucket read back. TRIGGER after any change to the site's pages, API, auth or schema, when a queue entry says to drive its flow through `verify-site`, or when asked to check the site in a browser. SKIP for docs-only changes and for production checks, which are done by hand.
---

# Verify the site

Follow [How to Verify the Site](../../../docs/pkmn/site/how-to/verify-the-site.md): it holds the sign-ins, the database and bucket reads, the reset and the troubleshooting. Starting the stack is [How to Run and Deploy the Site](../../../docs/pkmn/site/how-to/run-and-deploy-the-site.md), steps 2 to 4.

- **Browser or routes:** a change to pages or components is driven in the browser; a change to the API, the schema or shared logic alone is checked on the same stack without the browser, calling its routes with `curl` as the test players (the test sign-in's cookie) and an admin, then reading the database and the bucket back (owner, 2026-10-29).
- **Start from a known state:** reset as the how-to's step 5 says before a check whose outcome depends on what is stored.
- **Long processes:** run `npm run dev` in the background and wait for its `API on` line; stop it and `docker compose down -v` when done unless the user keeps the stack.
- **Shared machine:** when another checkout or session may use Docker, give every `docker compose` command your own `COMPOSE_PROJECT_NAME` and ports, as the run how-to's step 2 says.
- **Report what was seen:** the pages driven, the screenshots' paths under `.playwright-mcp/`, and the rows and objects read back. Nothing here becomes a test file or a gate step.
