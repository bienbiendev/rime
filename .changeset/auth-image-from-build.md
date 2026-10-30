---
'rimecms': patch
---

Fixed: the sign-in, forgot-password and reset-password pages show `static/assets/panel/panel.jpg` in a built app that runs without `static/`: the image is found where the build copied it, `build/client`, as well as under `static/`. The lookup is made once per server instead of on every page load, and a page never asks for an image the app does not have.
