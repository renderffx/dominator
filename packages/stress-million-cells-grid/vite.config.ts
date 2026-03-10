import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@dominator/core': path.resolve(__dirname, '../core/src/index.ts'),
        },
    },
    server: {
        port: 5175,
    },
    optimizeDeps: {
        include: ['@dominator/core'],
    },
});
