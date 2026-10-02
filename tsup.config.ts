import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/behaviors/*.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  splitting: false,
  outExtension: () => ({ js: '.mjs' }),
  // 类型面随包发布（.mjs 旁的 .d.mts）：TS / AI 代理 / llms-full 生成的唯一类型真相
  dts: { resolve: false },
});
