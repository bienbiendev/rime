// Isomorphic entry — the only file anything imports. Server-only, no client half: a browser has
// no origin list to enforce. See docs/rime-modules-resolution.md, case C.
export { cors } from '$rime/modules';
