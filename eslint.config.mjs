import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["**/*.mdx", "**/*.md", "next.config.*", ".next/**", "dist/**"]),
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/app/page.tsx"],
    rules: {
      // File size cap — keep page.tsx under 2500 lines
      "max-lines": ["error", { max: 2500 }],
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
