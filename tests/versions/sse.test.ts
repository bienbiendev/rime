import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * `GET /api/sse?keys=…` with Node's own fetch: Playwright's request context waits for the whole
 * body, and a stream never ends. The response is answered as soon as the headers are in.
 */
const openStream = async (keys: string, cookie?: string) => {
  const controller = new AbortController();
  const response = await fetch(`${API_BASE_URL}/sse?keys=${encodeURIComponent(keys)}`, {
    headers: cookie ? { cookie } : {},
    signal: controller.signal
  });
  return { response, close: () => controller.abort() };
};

/** Reads the stream until `needle` shows up, or `timeoutMs` passes. */
const readUntil = async (response: Response, needle: string, timeoutMs = 5000) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let received = '';
  while (Date.now() < deadline) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), deadline - Date.now())
      )
    ]);
    if (chunk.done) break;
    received += decoder.decode(chunk.value, { stream: true });
    if (received.includes(needle)) return received;
  }
  throw new Error(`"${needle}" never arrived; received:\n${received}`);
};

const staffUser = async (request: APIRequestContext) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD }
  });
  const { user } = await response.json();
  return user as { id: string };
};

test('A connection without keys is a 400', async () => {
  const { response, close } = await openStream('');
  expect(response.status).toBe(400);
  close();
});

test('A key the config opens is open to anyone', async () => {
  const { response, close } = await openStream('public:news');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  close();
});

test('A key the config does not open is a 403', async () => {
  const { response, close } = await openStream('private:news');
  expect(response.status).toBe(403);
  close();
});

test('One refused key refuses the whole connection', async () => {
  const { response, close } = await openStream('public:news,private:news');
  expect(response.status).toBe(403);
  close();
});

test('A panel key needs staff', async ({ request }) => {
  const anonymous = await openStream('rime:news:1');
  expect(anonymous.response.status).toBe(403);
  anonymous.close();

  const { cookie } = await signInSuperAdmin(request);
  const staff = await openStream('rime:news:1', cookie);
  expect(staff.response.status).toBe(200);
  staff.close();
});

test('A per-user key is open to that user only', async ({ request }) => {
  const { id } = await staffUser(request);
  const { cookie } = await signInSuperAdmin(request);

  const own = await openStream(`user:${id}`, cookie);
  expect(own.response.status).toBe(200);
  own.close();

  const other = await openStream('user:somebody-else', cookie);
  expect(other.response.status).toBe(403);
  other.close();
});

test('Taking the edit lock reaches whoever listens to the document', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: { attributes: { title: 'SSE probe', slug: 'sse-probe' } }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const { response, close } = await openStream(`rime:news:${doc.id}`, headers.cookie);
  expect(response.status).toBe(200);
  // The comment frame the server writes first, so the claim below lands on an open stream.
  await readUntil(response, ': open');

  const lock = await request.post(
    `${API_BASE_URL}/news/${doc.id}/lock?versionId=${doc.versionId}`,
    {
      headers
    }
  );
  expect(lock.status()).toBe(200);

  const received = await readUntil(response, '"event":"rime:lock"');
  expect(received).toContain('data: {"event":"rime:lock","payload":{}}');
  close();
});
