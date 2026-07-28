import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  outDir: 'dist',
  vite: {
    server: {
      // 设计资产直接引自仓库内 ui/src（站点 root 之外），dev 模式需要放行
      fs: { allow: ['..'] },
    },
  },
});
