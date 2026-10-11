import { RimeError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mailer, type SMTPConfig } from './index.server.js';

const transport = vi.hoisted(() => ({ sendMail: vi.fn() }));
const createTransport = vi.hoisted(() => vi.fn(() => transport));

vi.mock('nodemailer', () => ({ default: { createTransport } }));

const smtp = (extra: Partial<SMTPConfig>): SMTPConfig => ({
  from: 'site@x.io',
  host: 'smtp.x.io',
  port: 587,
  auth: { user: 'site', password: 'secret' },
  ...extra
});

/** The `secure` option the transport is built with. */
const secureFor = (extra: Partial<SMTPConfig>) => {
  mailer(smtp(extra));
  return (createTransport.mock.lastCall as any)[0].secure;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mailer', () => {
  it('starts without TLS on port 587, with it on port 465, and the config can say otherwise', () => {
    expect(secureFor({ port: 587 })).toBe(false);
    expect(secureFor({ port: 465 })).toBe(true);
    expect(secureFor({ port: 2525, secure: true })).toBe(true);
    expect(secureFor({ port: 465, secure: false })).toBe(false);
  });

  it('answers a failed mail with a generic message, and logs the transport error', async () => {
    const failure = new Error('535 Authentication failed');
    transport.sendMail.mockRejectedValue(failure);
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const sent = mailer(smtp({})).actions.sendMail({ to: 'ann@x.io', subject: 'Hi', text: 'Hi' });

    await expect(sent).rejects.toBeInstanceOf(RimeError);
    await expect(sent).rejects.toMatchObject({
      code: RimeError.MAIL_ERROR,
      message: `${RimeError.MAIL_ERROR} — Error while sending mail`,
      cause: failure
    });
    expect(error).toHaveBeenCalledWith(failure);
  });
});
