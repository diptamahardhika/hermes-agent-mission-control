import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["**/*.mdx", "**/*.md", "next.config.*", ".next/**", "dist/**"]),
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/app/page.tsx", "src/app/dashboard/**/*.tsx"],
    rules: {
      // File size cap — keep page.tsx under 2000 lines (Plan 2A)
      "max-lines": ["error", { max: 2000 }],
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
