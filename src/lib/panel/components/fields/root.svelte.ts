type FieldState = {
  value: any;
  path: string;
  readonly editable: boolean;
  readonly visible: boolean;
  readonly error: string | false;
};

export function root(node: HTMLElement, field: FieldState) {
  node.classList.add('rz-field-root');
  node.setAttribute('style', 'position: relative; container: rz-field-root / inline-size');
  node.setAttribute('data-path', field.path);

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
}
