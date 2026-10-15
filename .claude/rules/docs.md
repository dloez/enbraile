---
paths:
  - "docs/**/*.md"
  - "**/CLAUDE.md"
  - ".claude/rules/*.md"
---

# Docs

Before writing or editing docs, read `docs/general/how-to/write-documentation.md`: where each kind of doc goes, the templates, how decisions and open questions are recorded, and the single-source-per-fact rule.

- Keep `docs/index.md` and the category's `docs/<category>/index.md` in sync when adding, moving, or deleting a doc. A new category gets a row in `docs/index.md`; a new project gets a row in its category's index.
- Docs live only under the root `docs/`, never inside a category's or project's code folder.
- `docs/work-in-progress/` is non-authoritative; `docs/personal/` is the owner's gitignored notes — never stage, commit, or move it unless asked.
