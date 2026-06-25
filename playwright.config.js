// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:8080',
		headless: true,
		viewport: { width: 1280, height: 720 },
		serviceWorkers: 'block',
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				permissions: ['clipboard-read', 'clipboard-write'],
			},
		},
	],
	// Scope to browser smoke coverage — prevents Playwright from scanning
	// tests/unit/*.test.js which import vitest and crash the Playwright runner.
	testMatch: [
		'**/tests/smoke.spec.js',
		'**/tests/about-release.spec.js',
	],
	grepInvert: /about: GitHub release checks wait for browser idle time after settings opens|about: marked loads only after delayed release metadata/,
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
