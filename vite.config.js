// 部署到 GitHub Pages 时站点挂在 https://<user>.github.io/<repo>/ 这种子路径下，
// 资源必须用相对路径，否则 /assets/xxx.js 会打到域名根目录上 404。
// base: './' 对根路径部署同样成立，本地 dev / preview 不受影响。
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
