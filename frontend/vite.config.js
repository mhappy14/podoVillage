import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'chart.js',
      'react-chartjs-2',
      'chartjs-adapter-date-fns',
      'chartjs-plugin-zoom',
      'react-helmet-async',
    ],
  },
  server: {
    proxy: {
      // 클라이언트에서 /invest 로 시작하는 요청을
      // http://localhost:8000/invest 로 포워딩
      '/invest/': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // 필요하다면 pathRewrite 로 프리픽스 제거 가능
        // rewrite: (path) => path.replace(/^\/invest/, '/invest'),
      },
      // FRED API CORS 우회 — Inv_indicator.jsx 에서 사용
      '/fredapi': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/fredapi/, ''),
      },
    },
  },
})