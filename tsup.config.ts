import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/behaviors/*.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  splitting: false,
  outExtension: () => ({ js: '.mjs' }),
});
