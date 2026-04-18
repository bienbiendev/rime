import { forgotPasswordLoad as forgotPassword } from './forgot-password/load.server.js';
import { resetPasswordLoad as resetPassword } from './reset-password/load.server.js';
import { signInLoad } from './sign-in/load.server.js';
import { signInActions as signIn } from './sign-in/actions.server.js';

export const authActions = {
  signIn
};

export const authLoads = {
  resetPassword,
  forgotPassword,
  signIn: signInLoad
};
