import { defineConfig } from 'vite';

// 相對路徑：GitHub Pages 放在 /<repo>/ 底下也能載入
export default defineConfig({ base: './' });
