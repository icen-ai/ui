import { readdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

/* entry 用对象形态：react/vue 入口与 src/index.ts 同名（index），数组形态会撞名被
   tsup 降级成 react/index.mjs 子目录；对象形态显式给定产物名 = 任务要求的 dist 面。 */
const behaviors = Object.fromEntries(
  readdirSync('src/behaviors')
    .filter((f) => f.endsWith('.ts'))
    .map((f) => {
      const name = f.replace(/\.ts$/, '');
      return [`behaviors/${name}`, `src/behaviors/${name}.ts`];
    }),
);

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.tsx',
    vue: 'src/vue/index.ts',
    ...behaviors,
  },
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  splitting: false,
  outExtension: () => ({ js: '.mjs' }),
  // react/vue 只做 peer：封装层入口不打进包（消费方提供框架副本）
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/*', 'vue'],
  // 类型面随包发布（.mjs 旁的 .d.mts）：TS / AI 代理 / llms-full 生成的唯一类型真相
  dts: { resolve: false },
});
