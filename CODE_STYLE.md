# Code Style Guide

## General Principles

1. **KISS** — Keep It Simple, Stupid. The simplest solution that works is the best solution.
2. **DRY** — Don't Repeat Yourself. If code appears 3+ times, extract it.
3. **Single Responsibility** — Each file, function, and component should do one thing well.
4. **Explicit over Implicit** — Named constants over magic numbers. Typed returns over `any`.

## TypeScript Style

### Do
```typescript
// Named constants
const MAX_HISTORY_SIZE = 2000;

// Proper type narrowing
if (result.error) {
  return { success: false, error: result.error };
}

// Type-only imports
import type { ConnectorMetadata } from './connector';

// Explicit return types on public functions
export function getState(id: string): ConnectorState { ... }
```

### Don't
```typescript
// Magic numbers
this.history = this.history.slice(-2000);

// Unsafe casts
const storage = this.storage as any;

// Swallowed errors
catch { /* ignore */ }

// Debug logging in production
console.log('[functionName] debug:', data);
```

## File Size Guidelines

| Type | Max Lines | Action if exceeded |
|------|-----------|-------------------|
| Component (.tsx) | 300 | Split into sub-components |
| Hook | 200 | Extract helpers or split by concern |
| Route file | 150 | Group related endpoints into separate files |
| Utility | 100 | Split by domain |
| Type definitions | No limit | Group related types in one file |

## Import Order

1. External libraries (`react`, `express`, `@mui/*`)
2. Internal packages (`@flovia/core/*`, `@flovia/connectors/*`)
3. Local modules (`../context/*`, `../hooks/*`)
4. Types (type-only imports last)

## Error Handling Patterns

### Backend Routes
```typescript
// Correct: Use fail() with proper status
router.post('/resource', (req, res) => {
  try {
    const result = doSomething(req.body);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
});
```

### Frontend Hooks
```typescript
// Correct: Report errors to user
try {
  await backend.someOperation();
} catch (err) {
  console.error('[hookName] Operation failed:', err);
  setError((err as Error).message);
}
```

## Git Commit Messages

- Use imperative mood: "Add feature", not "Added feature"
- First line: max 72 characters
- Prefix with area: `core:`, `server:`, `renderer:`, `connectors:`
- Examples:
  - `core: split chat.ts into prompt-builders and parsers`
  - `server: add path traversal protection to fs routes`
  - `renderer: extract tab factory from useTabManager`

## React Component Patterns

### Component Structure
```typescript
// 1. Imports
// 2. Types/interfaces (if component-specific)
// 3. Constants
// 4. Component function
// 5. Export

const MY_CONSTANT = 42;

interface Props { ... }

export default function MyComponent({ prop1, prop2 }: Props) {
  // State
  const [value, setValue] = useState('');

  // Derived state
  const computed = useMemo(() => ..., [deps]);

  // Callbacks
  const handleClick = useCallback(() => ..., [deps]);

  // Effects
  useEffect(() => ..., [deps]);

  // Render
  return <div>...</div>;
}
```
