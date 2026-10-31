import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off"
    }
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "examples/**",
      "src/App.tsx",
      "src/main.tsx",
      "src/router.tsx",
      "src/api/**",
      "src/components/actions/**",
      "src/components/common/**",
      "src/components/dashboard/**",
      "src/components/duplicates/**",
      "src/components/files/**",
      "src/components/groups/**",
      "src/components/history/**",
      "src/components/layout/**",
      "src/components/recommendations/**",
      "src/components/settings/**",
      "src/components/workspace/**",
      "src/styles/**"
    ]
  }
];

export default eslintConfig;
