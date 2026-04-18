import { RimeError } from '$lib/core/errors/index.js';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { type Plugin, definePlugin } from '../index.js';

export const mailer = definePlugin((smtpConfig: SMTPConfig) => {
  if (!smtpConfig) {
    throw new RimeError(RimeError.CONFIG_ERROR, 'SMTP configuration is required');
  }

  const { password, ...restAuth } = smtpConfig.auth;
  const options: SMTPTransport.Options = {
    secure: true,
    ...smtpConfig,
    auth: {
      ...restAuth,
      pass: password
    }
  };

  const mailer = nodemailer.createTransport(options);

  const sendMail = async (args: { to: string; subject: string; text: string; html?: string }) => {
    try {
      return await mailer.sendMail({ from: smtpConfig.from, ...args });
    } catch {
      throw new RimeError(RimeError.MAIL_ERROR, 'Error while sending mail');
    }
  };

  return {
    name: 'mailer',
    type: 'server',
    actions: {
      sendMail
    }
  } as const satisfies Plugin;
});

export type MailerActions = ReturnType<typeof mailer>['actions'];

export type SMTPConfig = {
  from: string | undefined;
  host: string | undefined;
  port: number | undefined;
  auth: {
    user: string | undefined;
    password: string | undefined;
  };
};
