import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  // Add recommended rules for TypeScript
  ...tseslint.configs.recommended,
  // Add recommended rules for Astro
  ...eslintPluginAstro.configs.recommended,
  {
    // Ignore build outputs and node modules
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
];