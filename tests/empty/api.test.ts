import test, { expect } from '@playwright/test';
import { API_BASE_URL } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

/****************************************************
/* Init
/****************************************************/

test('Second init should return 404', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/init`, {
    data: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(404);
});

/****************************************************
/* Login
/****************************************************/

test('Login should be successfull', async ({ page, request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: ADMIN_EMAIL,
      password: PASSWORD
    }
  });

  const cookie = response.headers()['set-cookie'];
  const json = await response.json();
  expect(cookie).toBeDefined();
  expect(json.user).toBeDefined();
  expect(json.user.id).toBeDefined();
});
