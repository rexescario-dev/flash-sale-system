# Local Tailwind bridge (#122)

npm registry was unreachable during implementation, so `apps/web` temporarily depends on:

- `tailwindcss` → `file:vendor/tailwindcss` (static utility CSS, **no global preflight**)
- `@tailwindcss/vite` → `file:vendor/tailwindcss-vite` (no-op Vite plugin)

**Follow-up:** Replace with official Tailwind v4 packages and validate real preflight in **#133**. Catalog code-review polish (retry gate, CSS specificity) is **#134**.

When registry access works:

```bash
pnpm --filter web remove tailwindcss @tailwindcss/vite
pnpm --filter web add -D tailwindcss @tailwindcss/vite
```

Then verify detail-page preflight / regression, and delete this vendor bridge.
