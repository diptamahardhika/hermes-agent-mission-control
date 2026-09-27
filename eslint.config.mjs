import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["**/*.mdx", "**/*.md", "next.config.*", ".next/**", "dist/**", ".worktrees/**", ".worktree-salvage/**"]),
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
]);
