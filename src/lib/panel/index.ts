import type { VersionsStatus } from '$lib/core/constant.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { Snippet } from 'svelte';
import { Field } from './components/fields/index.js';
import Panel from './components/Root.svelte';
import Doc from './components/sections/document/Document.svelte';
import Button from './components/ui/button/button.svelte';
import Input from './components/ui/input/input.svelte';
import SpinLoader from './components/ui/spin-loader/SpinLoader.svelte';
import Area from './pages/area/Area.svelte';
import AreaVersionsDoc from './pages/area/AreaVersionsDoc.svelte';
import ForgotPassword from './pages/auth/forgot-password/ForgotPassword.svelte';
import ResetPassword from './pages/auth/reset-password/ResetPassword.svelte';
import SignIn from './pages/auth/sign-in/SignIn.svelte';
import CollectionDoc from './pages/collection-document/CollectionDocument.svelte';
import CollectionDocVersions from './pages/collection-document/CollectionDocVersions.svelte';
import Collection from './pages/collection/Collection.svelte';
import Dashboard from './pages/dashboard/Dashboard.svelte';
import Live from './pages/live/Live.svelte';
import type { Route } from './types.js';

export {
  // Components
  Area,
  AreaVersionsDoc,
  Button,
  Collection,
  CollectionDoc,
  CollectionDocVersions,
  Dashboard,
  Doc,
  Field,
  ForgotPassword,
  Input,
  Live,
  Panel,
  ResetPassword,
  SignIn,
  SpinLoader
};

// Types used in generated routes

export type { DocumentFormContext } from './context/documentForm.svelte.js';
export type CollectionProps = {
  data: {
    docs: GenericDoc[];
    status: number;
    canCreate: boolean;
  };
  children: Snippet;
};
export type DocVersion = { id: string; updatedAt: Date; status: VersionsStatus };

type BaseDocData =
  | {
      aria: Partial<Route>[];
      doc: GenericDoc;
      status: 200;
      readOnly: boolean;
    }
  | {
      aria: Partial<Route>[];
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      doc: {};
      status: 401;
      readOnly: true;
    };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type DocVersions<V> = V extends true ? { versions: DocVersion[] } : {};

export type CollectionDocData<V extends boolean = boolean> = DocVersions<V> &
  BaseDocData & {
    operation: 'create' | 'update';
    hasMailer?: boolean;
  };
export type AreaDocData<V extends boolean = boolean> = DocVersions<V> &
  BaseDocData & { operation: 'update' };

export type CollectionDocumentDataWithVersions = CollectionDocData<true>;
export type AreaDataWithVersions = AreaDocData<true>;
