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
	testDir: './tests',
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
