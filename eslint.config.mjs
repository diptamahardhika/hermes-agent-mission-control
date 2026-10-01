import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    "**/*.mdx",
    "**/*.md",
    "next.config.*",
    ".next/**",
    "dist/**",
    ".worktrees/**",
    ".worktree-salvage/**",
    // Local-only agent tooling, gitignored at .gitignore:90 and :108. These
    // files are NOT in the repository (`git ls-files` returns nothing under
    // either path), so a CI checkout never contains them and they can never
    // fail the gate. The three .cjs hooks are CommonJS, which is the correct
    // shape for the loaders Claude Code and Cursor run; the rest is JSON and
    // markdown. Linting them adds nothing but local noise.
    ".claude/**",
    ".cursor/**",
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    // File size cap (Plan 2A). Scoped by size, not by hand-picked paths: the
    // original glob named page.tsx + dashboard/**, but the file that actually
    // blew the cap was articles/page.tsx (2401 lines) — outside the glob, so
    // never flagged. Keep page.tsx and the dashboard/ panels explicitly listed
    // for the rule relaxations below; max-lines itself applies repo-wide.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 2000 }],
    },
  },
  {
    files: ["src/app/page.tsx", "src/app/dashboard/**/*.tsx"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Tracked, but standalone CommonJS tooling outside the Next.js build.
    // Converting to ESM would mean rewriting module plumbing in a 325-line
    // script (14KB) that runs fine today, with no runtime benefit. Scoped to
    // this one directory — the rule stays on for every other .js file in the
    // repo.
    files: ["scanner/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Tracked one-off database seed scripts. These load heterogeneous rows
    // from JSON fixtures, so the row shapes genuinely are not statically known
    // and `any` is accurate rather than lazy. Not part of the app runtime and
    // never imported by src/.
    files: ["prisma/seed*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Narrower than the block above: only seed-all.ts calls require(), once,
    // for child_process inside execSqlite() — lazily, so sqlite3 stays
    // optional when the binary is absent. seed.ts and prisma/seed-datastore.ts
    // contain no require() at all, so the rule stays enforced on them.
    files: ["prisma/seed-all.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
