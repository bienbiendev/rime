import type { VersionsStatus } from '$lib/core/prototype/shared/versions/constant.js';
import type { AutoSaves } from '$lib/core/prototype/shared/versions/types.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { Snippet } from 'svelte';
import { Field } from './components/fields/index.js';
import RichTextInline from '$lib/fields/rich-text/component/RichTextInline.svelte';
import RenderFields from './components/fields/RenderFields.svelte';
import Panel from './components/Root.svelte';
import Doc from './components/sections/document/Document.svelte';
import Button from './components/ui/button/button.svelte';
import Input from './components/ui/input/input.svelte';
import SpinLoader from './components/ui/spin-loader/SpinLoader.svelte';
import { API_PROXY } from './context/api-proxy.svelte.js';
import { COLLECTION_CTX } from './context/collection.svelte.js';
import { LIVE_KEY } from './context/live.svelte.js';
import { LOCALE_CTX } from './context/locale.svelte.js';
import { USER_CTX } from './context/user.svelte.js';

import { TITLE_CTX } from './context/title.js';
import Area from './pages/area/Area.svelte';
import ForgotPassword from './pages/auth/forgot-password/ForgotPassword.svelte';
import ResetPassword from './pages/auth/reset-password/ResetPassword.svelte';
import SignIn from './pages/auth/sign-in/SignIn.svelte';
import CollectionDoc from './pages/collection-document/CollectionDocument.svelte';
import Collection from './pages/collection/Collection.svelte';
import Dashboard from './pages/dashboard/Dashboard.svelte';
import Live from './pages/live/Live.svelte';
import type { Route } from './types.js';
import { populate } from './util/populate.js';
import { useCommands } from './context/commands.svelte.js';

export {
  // Components
  Area,
  Button,
  Collection,
  CollectionDoc,
  Dashboard,
  Doc,
  Field,
  ForgotPassword,
  Input,
  Live,
  Panel,
  RenderFields,
  ResetPassword,
  RichTextInline,
  SignIn,
  SpinLoader,
  // A block render's relations, resolved as the API answers them
  populate,
  // The commands a component offers while mounted: palette lines, keys
  useCommands
};

// Context keys, for a plugin/field that needs to read a context rime's own panel sets
export const CONTEXT = {
  COLLECTION: COLLECTION_CTX,
  LIVE: LIVE_KEY,
  API_PROXY,
  USER: USER_CTX,
  LOCALE: LOCALE_CTX,
  TITLE: TITLE_CTX
};

// Types used in generated routes
export type { DocumentFormContext } from './context/documentForm.svelte.js';
export type { Command } from './context/commands.svelte.js';
export type CollectionProps = {
  data: {
    docs: GenericDoc[];
    status: number;
    canCreate: boolean;
  };
  children: Snippet;
};
export type DocVersion = {
  id: string;
  updatedAt: Date;
  status: VersionsStatus;
  /** One user's typing, not a version yet. Only on a config that auto-saves. */
  isAutoSave?: boolean;
  updatedBy?: { id: string; name?: string; email?: string } | null;
};

type BaseDocData =
  | {
      aria: Partial<Route>[];
      doc: GenericDoc;
      status: 200;
      readOnly: boolean;
      /** The document's auto-saved rows. Absent on a config that does not auto-save. */
      autoSaves?: AutoSaves;
    }
  | {
      aria: Partial<Route>[];
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      doc: {};
      status: 401;
      readOnly: true;
    };

export type CollectionDocData = BaseDocData & {
  operation: 'create' | 'update';
  hasMailer?: boolean;
};
export type AreaDocData = BaseDocData & { operation: 'update' };
