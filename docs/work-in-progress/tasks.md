# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/open-sheet: scope the export script

Scope part 1 of [Open Sheet](open-sheet.md), the `uv run` script that reads a save and writes the shared Pokémon and items to JSON, with the owner through `/scope`. Read the brief and the [Origin Conversation](open-sheet-origin-conversation.md) first.

Verify manually: a scope doc for the export script is saved in `docs/work-in-progress/` and its tasks are queued below this entry.
**Touches:** `docs/work-in-progress/`
**Needs the author:**
- Start `/scope` for the export script in a fresh session.
