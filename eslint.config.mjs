import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": "warn",
      "no-useless-escape": "warn",
      "no-useless-assignment": "warn",
      "no-undef": "warn"
    }
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["public/**/*.js"], languageOptions: { sourceType: "module", globals: globals.browser } },
]);
