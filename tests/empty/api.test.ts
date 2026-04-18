import test, { expect } from '@playwright/test';
import { API_BASE_URL } from '../util.js';

/****************************************************
/* Init
/****************************************************/

test('Second init should return 404', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/init`, {
    data: {
      email: 'admin@bienoubien.studio',
      name: 'Admin',
      password: 'a&1Aa&1A'
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
      email: 'admin@bienoubien.studio',
      password: 'a&1Aa&1A'
    }
  });

  const cookie = response.headers()['set-cookie'];
  const json = await response.json();
  expect(cookie).toBeDefined();
  expect(json.user).toBeDefined();
  expect(json.user.id).toBeDefined();
});
