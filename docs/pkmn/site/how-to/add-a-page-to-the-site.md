# How to Add a Page to the Site

Add a tool or page to `pkmn/site/` that looks and behaves like the rest of the site. The look is described in the [Site Design System](../reference/design-system.md); read it first.

## Prerequisites

- The site runs locally ([How to Run and Deploy the Site](run-and-deploy-the-site.md)).
- You know what the page shows and its title, in English.

## Steps

### 1. Add the route

In `src/router.tsx`, create the route under `rootRoute` and add it to `routeTree`:

```tsx
const myToolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/my-tool",
  component: MyToolPage,
});
```

The header's tabs are the site's sections, listed in `TABS` in `src/components/site-header.tsx` with a label, a path and a [pixel icon](../reference/design-system.md#imagery-and-icons); a page joins them only when it is a section of its own.

### 2. Write the page

Put the page component in `src/pages/my-tool.tsx` and the tool's own code in `src/my-tool/` (`components/` for its UI). The page returns its own `<main>`, on the page column for its kind from `src/components/page.ts` ([Layout Shell](../reference/design-system.md#layout-shell)), `toolPage` for a tool:

```tsx
export function MyToolPage() {
  return (
    <main className={cn(toolPage, "gap-4.5 pt-5 pb-10")}>
      …
    </main>
  );
}
```

The column carries the width and the gutter; nothing inside the page adds its own. A component another tool also needs goes in `src/components/`, never imported from the other tool's folder.

### 3. Build the UI from what exists

In this order:

1. A shared component from [Components → Shared](../reference/design-system.md#shared): `Panel` for titled cards, `Segmented` for view switches, `Toggle`, `Button` or `buttonClass`/`iconButtonClass`/`quietIconClass` for buttons, `liftCardClass` for a card that is a link as a whole, `PlayerBadge`, `PixelIcon`, `fieldClass`, the type marks, the analysis panels, `Dialog` and `Sheet`.
2. A documented [pattern](../reference/design-system.md#patterns), copied from the component that shows it.
3. A shadcn component, added with `npx shadcn@<pinned version> add <component>` into `src/components/ui/` and brought onto the theme's tokens.
4. Only then something new.

Colours come from the [tokens](../reference/design-system.md#colour-tokens) only: red for where you are, cyan (`primary`) for what you can act on and for selection, yellow for you and winners, `chart-2` for the good side of a comparison, `destructive` for errors and the bad side. Use the pixel face (`font-heading`) for headings, labels, tabs and buttons and `tabular-nums` for numbers in running text, text sizes and radii from Tailwind's scale only ([Typography](../reference/design-system.md#typography), [Radius, Spacing, Borders, Shadow](../reference/design-system.md#radius-spacing-borders-shadow)). Write no helper text explaining the UI.

### 4. Update the design system in the same change

If the page added or changed a token, a shared component, the shell or a pattern another page could reuse, edit [Site Design System](../reference/design-system.md) in the same commit: the new token's value and role, the component's path and use, the pattern's classes. A new colour goes into `src/index.css`'s `:root` and `@theme inline`, never into a component.

### 5. Update the docs that list the pages

Add the page to [The pkmn Site](../explanation/site.md)'s opening list and the Site row of the [pkmn index](../../index.md), with its own explanation doc under `docs/pkmn/site/explanation/` if it has design decisions.

## Verification

1. `npm run gate` passes in `pkmn/site/`.
2. `npm run dev`: the page opens at its route, its tab is open in the header if it has one, and the page works at desktop width and at a phone width (about 375px) with no horizontal page scroll.
3. `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/pages/my-tool.tsx src/my-tool -r` finds no raw colours.
