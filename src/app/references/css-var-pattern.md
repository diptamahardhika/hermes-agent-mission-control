# CSS Custom Properties in Inline Styles

## The Pattern

When `data/coq-finance.json` stores category colors as CSS variable strings (e.g., `"var(--color-success)"`), and those values are applied via React inline styles like `style={{ background: cat.color }}`, the CSS custom properties **must be defined in the `:root` block** of `src/app/globals.css`.

## Why `:root`, Not `@theme inline`

React inline `style` attributes resolve CSS custom properties via the browser's cascade. Custom properties defined inside `@theme inline` (Tailwind v4) are injected into `:root` at build time, but **the `@theme inline` block is processed separately** and may not participate in the same cascade scope as an explicit `:root` declaration. In practice, inline `style={{ background: 'var(--color-x)' }}` only reliably resolves when `--color-x` is declared in a literal `:root` selector.

**Pitfall (real):** `--color-purple` and `--color-pink` were placed inside `@theme inline` instead of `:root` in `src/app/globals.css`. This caused the Entertainment and Health category bars in the CoqFinancePanel to render invisible — the `var(--color-purple)` and `var(--color-pink)` references were silently ignored by the browser.

## Verification Loop

```bash
# 1. Check CSS vars are in :root
grep -n ":root" src/app/globals.css | head -1
grep -n "color-success\|color-warning\|color-info\|color-danger\|color-purple\|color-pink" src/app/globals.css

# 2. Cross-reference data file references
grep -rn "var(--color-" data/coq-finance.json

# 3. Every var(--color-X) in data/*.json must have a matching --color-X definition in :root in globals.css
# 4. After adding CSS vars, clear .next cache and restart:
rm -rf .next && launchctl bootout gui/501 ~/Library/LaunchAgents/ai.hermyhq.dashboard.plist
launchctl bootstrap gui/501 ~/Library/LaunchAgents/ai.hermyhq.dashboard.plist
```

## Fix Pattern

All color CSS custom properties go in `:root`:

```css
:root {
  --color-success: #5fd0a0;
  --color-warning: #f5c451;
  --color-info: #6ea8fe;
  --color-danger: #f28b82;
  --color-purple: #a855f7;
  --color-pink: #ec4899;
}
```

Not in `@theme inline`. Not in a separate block. All in `:root`.

## Stale Cache Trap

After adding CSS variables, `rm -rf .next` and restart the dev server. CSS custom properties defined at runtime are not picked up by the cached Next.js build.