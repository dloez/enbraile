# How to Write Documentation

## Documentation System

This project uses the [Diataxis](https://diataxis.fr/) framework with three document types. Tutorials are skipped.

### Explanation (understanding-oriented)

**Purpose**: Why does X work this way? Design decisions, trade-offs, history.

**Location**: `explanation/` folders.

**Characteristics**:
- Discursive, explains the reasoning behind decisions
- Provides context that code alone doesn't reveal
- Ends with a `## Decisions` section (see below)

### How-to (problem-oriented)

**Purpose**: Step-by-step recipe to accomplish a specific goal.

**Location**: `how-to/` folders.

**Characteristics**:
- Numbered steps with clear prerequisites
- Goal-oriented and practical

### Reference (information-oriented)

**Purpose**: Quick-lookup facts. Austere and to the point.

**Location**: `reference/` folders.

**Characteristics**:
- Designed to be consulted, not read end-to-end
- Tables, lists, structured formats

## Where Does My New Doc Go?

| I want to document... | It goes in... |
|----------------------|---------------|
| Something every category shares (conventions, tooling, setup) | `docs/general/` |
| Something every project in a category shares (domain rules, facts) | `docs/<category>/domains/<domain>/` |
| How a project is designed or works | `docs/<category>/<project>/` |
| A rule every agent session needs | `CLAUDE.md` (brief; rationale in `docs/`) |
| A rule only work in one category or project needs | That folder's `CLAUDE.md` (brief; rationale in `docs/`) |
| A rule that only applies to some paths | `.claude/rules/<topic>.md` with `paths:` frontmatter |
| A milestone, scope (discovery) doc, plan, task, or open question | `docs/work-in-progress/` |

Docs never live inside a code folder. A fact belongs to the lowest level every reader of it shares ([Repository Layout](../explanation/repository-layout.md)).

## Recording Decisions

- A decision lives in the `## Decisions` section of the explanation doc that owns the topic, not in a separate log.
- Each entry: **Decided** (what), **Why** (only if the reason is actually known — don't invent one), and the date it was settled.
- An open item is never written as a decision, and never resolved silently in code. It goes in [Open Questions](../../work-in-progress/open-questions.md), naming its owner doc, and the owner doc links to it from its `## Open` section.
- **Forced by evidence, not asked:** when a measurement or a verified fact leaves only one workable option, the agent records it as a dated decision in the owner doc, citing the evidence, and carries on; it never becomes an open question or a `**Needs the author:**` entry. This holds even when it widens a settled decision. The report names it so the owner can overturn it. Ask only when two or more options are really viable and choosing between them changes what the product is.
- **Closing an open question:** ask the user, record the decision (dated) in the owner doc's `## Decisions`, remove the entry from `open-questions.md`, and fix every link that pointed at its anchor (`grep -rn '#<anchor>' docs/`).
- When a decision changes, rewrite the entry to say what is true now and note the date; git holds the history.

## Single Source per Fact

Each fact has one owning doc; everything else links to it. When you notice the same fact or rule written in two places, keep it in the owner and replace the copy with a link. `CLAUDE.md` holds only the rules an agent needs on every task, stated briefly; the rationale lives in `docs/`.

## Standards Per Domain Folder

Each domain folder (`docs/<category>/domains/<domain>/`):

- **MUST** have `index.md` — overview, key facts, links to sub-docs
- **MUST** have `reference/dictionary.md` — domain terminology
- **MAY** have `explanation/` and `how-to/` docs

## Templates

### Domain index.md

```markdown
# {Domain Name}

{One-paragraph overview.}

## Key Facts

{The most important things to know.}

## Reference

- [Dictionary](reference/dictionary.md)

## Explanation

- [Topic](explanation/topic.md)
```

### reference/dictionary.md

```markdown
# {Domain} Dictionary

| Term | Definition | Also Known As |
|------|-----------|---------------|
| Term 1 | What it means in this domain | Alternative name |
```

### explanation/*.md

```markdown
# {Topic}

{Context and motivation — why does this exist?}

## {Section}

{Detailed explanation.}

## Decisions

- **{Decision}** — {Why, if known}. _(settled YYYY-MM-DD)_

## Open

- See [Open Questions](../../work-in-progress/open-questions.md#{anchor}).
```

### how-to/*.md

```markdown
# How to {Goal}

## Prerequisites

- {What you need before starting}

## Steps

### 1. {First step}

{Instructions with code examples.}

## Verification

{How to verify it worked.}
```

## Work-in-Progress Lifecycle

See [Work in Progress](../../work-in-progress/index.md#lifecycle).
