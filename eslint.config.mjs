import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  globalIgnores(["**/*.mdx", "**/*.md", "next.config.*", ".next/**", "dist/**"]),
  ...nextVitals,
  {
    files: ["src/app/page.tsx"],
    rules: {
      // File size cap — keep page.tsx under 2000 lines
      "max-lines": ["error", { max: 2000, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]);
