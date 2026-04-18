import type { APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.PUBLIC_RIME_URL;
export const API_BASE_URL = `${BASE_URL}/api`;

export const signIn = (email: string, password: string) => {
  return async (request: APIRequestContext) => {
    const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email,
        password
      }
    });
    const setCookie = response.headers()['set-cookie'];
    const [name, cookie] = setCookie.split('=');
    return {
      cookie: `${name}=${cookie}`
    };
  };
};
