import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages 部署時的 base path（改成你的 repo 名稱）
  base: '/trans-puzzle/',
  server: {
    open: true,
    host: true, // 允許網路端（手機）透過本機 IP 連線
    // 如需固定 port，可取消註解：
    // port: 5173,
  }
})
