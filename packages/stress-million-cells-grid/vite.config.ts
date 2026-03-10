import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { dominatorPlugin } from '../core/src/compiler/vite-plugin.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@dominator/core': path.resolve(__dirname, '../core/src/index.ts'),
        },
    },
    plugins: [dominatorPlugin()],
    server: {
        port: 5175,
    },
});
