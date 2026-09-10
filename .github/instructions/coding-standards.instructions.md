---
description: 'Repository-wide TypeScript, documentation, and comment standards'
applyTo: '**/*.{ts,astro}'
---

# Coding Standards

## Comments and documentation

- Comment intent, constraints, and non-obvious decisions: explain **why** the code exists or why an approach was chosen.
- Do not add comments that merely paraphrase the code below them. Prefer clear names and types for explanations of **what** the code does.
- Keep comments current. Update or remove a comment in the same change as the code it describes; outdated comments are bugs.
- Use TSDoc/JSDoc for exported functions in `db/` and `src/lib/`. Each function comment must describe its purpose, every parameter (including an injectable `db` argument), and its return value.
- Add a comment only when it improves understanding of intent, an invariant, a trade-off, or a non-obvious interaction. Do not comment routine syntax.

Example:

```ts
/**
 * Returns games in title order so generated static pages remain deterministic.
 *
 * @param db Drizzle database client, injected to use the same helper in pages and tests.
 * @returns Games mapped to the application-facing type.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
  // …
}
```

## Astro component contracts

- Every reusable `.astro` component must declare a `Props` interface in its frontmatter.
- Document the `Props` interface with a brief TSDoc comment when the component has non-obvious usage, optional behavior, or inherited HTML attributes.
- Use property names and types that make the component contract self-explanatory. Document individual properties when their meaning or allowed values are not obvious.
- Pages and layouts should follow the same convention when they accept props.

```astro
---
/** Content and accessibility contract for the game card. */
interface Props {
  /** Game data rendered by the card. */
  game: Game;
}
---
```

## TypeScript formatting and types

- Use two spaces for indentation, single quotes for strings, semicolons, trailing commas in multiline lists, and one logical statement per line.
- Use `import type` for type-only imports and prefer explicit types at public module boundaries.
- Every function parameter and return type must be explicit in `db/` and `src/lib/`; avoid implicit `any`.
- Prefer narrow, reusable types and type guards over casts. Do not use `any` to bypass a type error.
- Keep formatting consistent with the surrounding file; ESLint is the authority for automatically enforceable TypeScript rules.

The ESLint configuration enforces explicit types at exported TypeScript module boundaries. TSDoc completeness and formatting details remain review-level requirements because they are not fully enforceable without obscuring the intent of comments.
