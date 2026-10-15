# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn: scope the Open Sheet web app

Run `/scope` for part 2 of [Open Sheet](open-sheet.md): the web app that shows a player's export and helps the reader navigate it, reading the JSON the export's reference under `docs/pkmn/tools/` describes and looking its Showdown IDs up in a Showdown data source. The scope doc decides where the app lives, which Showdown data it reads and how, and what navigating an export means, and writes the app's tasks into this queue.

Verify manually: a scope doc for the web app exists in `docs/work-in-progress/` and is linked from [Open Sheet](open-sheet.md) and the [Work in Progress](index.md) index; its tasks are in this queue.
**Touches:** `docs/work-in-progress/`
**Needs the author:** part 2 is not designed yet; its `/scope` interview needs the owner.
