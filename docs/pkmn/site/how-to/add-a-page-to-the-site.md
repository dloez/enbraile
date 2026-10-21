# How to Add a Page to the Site

Add a tool or page to `pkmn/site/` that looks and behaves like the rest of the site. The look is described in the [Site Design System](../reference/design-system.md); read it first.

## Prerequisites

- The site runs locally ([How to Run and Deploy the Site](run-and-deploy-the-site.md)).
- You know what the page shows and its title, in English.

## Steps

### 1. Add the route

In `src/router.tsx`, create the route under `rootRoute` with a `staticData.title` (the header shows it after `pkmn /`) and add it to `routeTree`:

```tsx
const myToolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/my-tool",
  staticData: { title: "My Tool" },
  component: MyToolPage,
});
```

### 2. List it on the home page

Add `{ name: "My Tool", to: "/my-tool" }` to `src/tools.ts`. The home page renders it as a link card; a page that is not a tool skips this step.

### 3. Write the page

Put the page component in `src/pages/my-tool.tsx` and the tool's own code in `src/my-tool/` (`components/` for its UI). The page returns its own `<main>`:

```tsx
export function MyToolPage() {
  return (
    <main className="mx-auto flex w-full max-w-344 flex-1 flex-col gap-4.5 px-4 pt-5 pb-10 sm:px-6">
      …
    </main>
  );
}
```

Pick the width and gutters from [Layout Shell](../reference/design-system.md#layout-shell): a column page like Team Analysis's above, or a full-width tool view like Open Sheet's.

### 4. Build the UI from what exists

In this order:

1. A shared component from [Components → Shared](../reference/design-system.md#shared): `Panel` for titled cards, `Segmented` for view switches, `Toggle`, `fieldClass`/`buttonClass`/`primaryClass`, the type marks, `Dialog` and `Sheet`.
2. A documented [pattern](../reference/design-system.md#patterns), copied from the component that shows it.
3. A shadcn component, added with `npx shadcn@<pinned version> add <component>` into `src/components/ui/` and brought onto the theme's tokens.
4. Only then something new.

Colours come from the [tokens](../reference/design-system.md#colour-tokens) only: orange (`primary`) for the one main action and for selection, `chart-2` for the good side of a comparison, `destructive` for errors and the bad side. Use the heading font for titles and mono for numbers. Write no helper text explaining the UI.

### 5. Update the design system in the same change

If the page added or changed a token, a shared component, the shell or a pattern another page could reuse, edit [Site Design System](../reference/design-system.md) in the same commit: the new token's value and role, the component's path and use, the pattern's classes. A new colour goes into `src/index.css`'s `:root` and `@theme inline`, never into a component.

### 6. Update the docs that mention tools

Add the page to [The pkmn Site](../explanation/site.md)'s opening list and the Site row of the [pkmn index](../../index.md), with its own explanation doc under `docs/pkmn/site/explanation/` if it has design decisions.

## Verification

1. `npm run gate` passes in `pkmn/site/`.
2. `npm run dev`: the home page shows the new card, the header shows the page title, and the page works at desktop width and at a phone width (about 375px) with no horizontal page scroll.
3. `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/pages/my-tool.tsx src/my-tool -r` finds no raw colours.
