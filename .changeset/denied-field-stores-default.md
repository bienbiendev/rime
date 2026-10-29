---
'rimecms': patch
---

Changed: on a create, a field the caller may not write stores its default value instead of staying empty, and so does each field of a group the caller may not write. The value sent for it is ignored, and the default is neither validated nor hooked. This includes a required field closed to the current editor, and every field with a default on an anonymous create, since `FormFieldBuilder`'s default `access.create` lets only a signed-in user in. A required field the caller may not write and that has no default makes the create answer 403, and the server logs a warning naming the collection and the field. A field that is not required and has no default stays empty, as before, and an update still leaves the stored value as it is.
