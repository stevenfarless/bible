// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:8080',
		headless: true,
		viewport: { width: 1280, height: 720 },
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	// Scope to smoke tests only — prevents Playwright from scanning
	// tests/unit/*.test.js which import vitest and crash the Playwright runner.
	testMatch: ['**/tests/smoke.spec.js'],
	reporter: [['html', { open: 'never' }], ['list']],
	// Give the local server time to boot before tests run
	webServer: process.env.CI
		? undefined // CI starts the server in a separate step
		: {
				command: 'python3 -m http.server 8080',
				port: 8080,
				reuseExistingServer: true,
			},
});
