rimecms runtime modules : `$rime` is the runtime module for rimecms, it contains the core runtime functions that resolve the host config and schema.

```
import { rime, Collection, Area } from '$rime/config';
import schema from '$rime/schema';
```

Other repo runtime modules currently do :

```
// <pckg>/src/lib/index.ts
import { polymorph } from '$rime/path/to/local'
// resolve to $lib/path/to/local/module.(server.)ts
```

On lib it resolve by its path, easy. But once packed, to be consuemd by another repo :

```
// node_modules/<pckg>/dist/lib/index.ts
import { polymorph } from '$rime/path/to/local/lib'
// resolve to node_module/<pckg>/dist/path/to/local/module.(server.)ts
// or node_module/.vite/deps/<pckg>.js
```

And this part is the tricky one.

This make me think that the lib should provide its own "resolver" like a .d.ts for example.
When the lib is packed all that modules imports are processed to ends inside a `modules.d.ts` or something. And paths replace in place by their full path to the consumer can resolve.

Something like '$lib' and sveltekit. And in between "$app/state" or "$env/dynamic/<type>".

So two problems :

- package local dev need type and local resolve
- consumer need type and local resolve
- package provide a way for consumer to resolve and type

Some synthax ideas :

```
import { whatever } from '@package/path/to:module';
import { whatever } from 'rime-embed-field/path/to:module';
// relative
import { whatever } from '.:module';
import { whatever } from '../foo/bar:module';
```
