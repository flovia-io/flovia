# Coding Practices & Conventions

## TypeScript

- **Strict mode**: Use strict TypeScript configuration. Avoid `as any` casts — use proper type narrowing or generic constraints instead.
- **Type imports**: Use `import type { ... }` for type-only imports to ensure they're erased at runtime.
- **Exhaustive checks**: Use `never` type for exhaustive switch/case handling.
- **Null safety**: Prefer optional chaining (`?.`) and nullish coalescing (`??`) over manual null checks.

## File Organization (KISS)

- **One concern per file**: Each file should do one thing well. If a file exceeds ~300 lines, consider splitting it.
- **Group related code**: Keep types, helpers, and implementation together when they serve the same feature.
- **Barrel exports**: Use `index.ts` files sparingly — only one per directory. Avoid multiple competing barrel files.
- **No backward-compat shims**: When moving code, update all importers and delete the old file. Don't leave re-export shims.

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Files (components) | PascalCase.tsx | `ChatPanel.tsx` |
| Files (hooks) | camelCase.ts | `useTabManager.ts` |
| Files (types) | kebab-case.types.ts | `ai.types.ts` |
| Files (routes) | kebab-case.routes.ts | `fs.routes.ts` |
| Interfaces | PascalCase, no `I` prefix | `ConnectorMetadata` |
| Type aliases | PascalCase | `StepKind` |
| Constants | UPPER_SNAKE_CASE | `SIDEBAR_MIN` |
| Functions | camelCase | `buildSystemContext` |

## Error Handling

- **Never swallow errors silently**: At minimum, log the error. `catch { /* ignore */ }` makes debugging impossible.
- **Use proper HTTP status codes**: Don't return 200 with `{ success: false }`. Use 400/404/500 as appropriate.
- **Consistent error shape**: All errors should follow `{ success: false, error: string }`.

## Security

- **Validate file paths**: Always verify paths resolve within the workspace directory before read/write/delete.
- **Sanitize shell inputs**: Never interpolate user input into `execSync()` commands without escaping.
- **No secrets in code**: Use environment variables for API keys, tokens, and URLs.

## React (Frontend)

- **Components under 300 lines**: Split large components into focused sub-components.
- **Extract reusable patterns**: If the same code appears 3+ times, extract it to a shared utility or component.
- **Consistent hook patterns**: Return `[state, actions]` or a single object — not a mix of both.
- **Error boundaries**: Wrap async-heavy components in error boundaries.
- **Memoize expensive computations**: Use `useMemo` for sorts, filters, and derived state.

## Backend

- **No debug console.log in production code**: Use a proper logger or the `debug` npm package.
- **Hexagonal architecture**: Keep domain logic in `core/`, adapters in `main/` and `server/`.
- **Don't duplicate code across adapters**: Share business logic in `core/`.
- **Extract magic numbers**: All numeric constants should be named and configurable.
