import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      /* The codebase already marks a deliberately unused binding with a
         leading underscore, and drops a field by destructuring it beside a
         rest spread ({ _score, ...rest }). Say so here, so the rule reports
         only what is actually dead. */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "prefer-const": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      /* An error, not a warning: a violation is a runtime crash waiting on the
         right props, and a warning is how PalmAnnotation carried one. */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

