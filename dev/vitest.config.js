// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        // Prevent Vite from processing @playwright/test if it ends up in
        // the same node_modules — avoids the Vitest/Playwright expect collision.
        server: {
            deps: {
                external: [/@playwright/],
            },
        },
    },
});
