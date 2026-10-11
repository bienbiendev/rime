import { RimeError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { type Plugin, definePlugin } from '../index.js';

export const mailer = definePlugin((smtpConfig: SMTPConfig) => {
  const { password, ...restAuth } = smtpConfig.auth;
  const options: SMTPTransport.Options = {
    ...smtpConfig,
    secure: smtpConfig.secure ?? smtpConfig.port === 465,
    auth: {
      ...restAuth,
      pass: password
    }
  };

  const mailer = nodemailer.createTransport(options);

  /**
   * Sends one mail from `$smtp.from`. A failure answers a generic MAIL_ERROR, whose `cause` is the
   * transport's error, and logs that error on the server.
   */
  const sendMail = async (args: { to: string; subject: string; text: string; html?: string }) => {
    try {
      return await mailer.sendMail({ from: smtpConfig.from, ...args });
    } catch (error) {
      logger.error(error);
      throw new RimeError(RimeError.MAIL_ERROR, 'Error while sending mail', { cause: error });
    }
  };

  return {
    name: 'mailer',
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
  /**
   * TLS from the first byte. Defaults to `true` on port 465 only: on 587 and 25 the connection
   * starts in plain text and upgrades with STARTTLS.
   */
  secure?: boolean;
  auth: {
    user: string | undefined;
    password: string | undefined;
  };
};
