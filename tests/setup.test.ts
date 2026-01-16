import test, { expect } from '@playwright/test';
import { execSync } from 'node:child_process';

execSync('rm -fr ./debug.md');
execSync('rm -fr ./logs');

test('First init should work', async ({ request }) => {
	const response = await request.post(`${process.env.PUBLIC_RIME_URL}/api/init`, {
		data: {
			email: 'admin@bienoubien.studio',
			name: 'Admin',
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
});
