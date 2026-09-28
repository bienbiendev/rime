type FieldState = {
  value: any;
  path: string;
  readonly editable: boolean;
  readonly visible: boolean;
  readonly error: string | false;
};

/** Marks a field's root with its path, visibility and editable state, and follows a new field. */
export function fieldset(node: HTMLElement, initial: FieldState) {
  let field = $state.raw(initial);

  node.classList.add('rz-field-root');
  node.setAttribute('style', 'position: relative; container: rz-field-root / inline-size');

  $effect(() => {
    node.setAttribute('data-path', field.path);
  });

  $effect(() => {
    if (field.visible) {
      node.setAttribute('data-visible', '');
    } else {
      node.removeAttribute('data-visible');
    }
  });

  $effect(() => {
    if (!field.editable) {
      node.setAttribute('disabled', '');
    } else {
      node.removeAttribute('disabled');
    }
  });

  return {
    update: (next: FieldState) => (field = next)
  };
}
