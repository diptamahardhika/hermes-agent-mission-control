import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  globalIgnores(["**/*.mdx", "**/*.md", "next.config.*", ".next/**", "dist/**"]),
  nextVitals({
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "import/no-anonymous-default-export": "off",
      // Tier 0: prevent page.tsx from growing unbounded again
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }),
  {
    files: ["src/app/page.tsx"],
    rules: {
      // File size cap — keep page.tsx under 2000 lines
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]);
