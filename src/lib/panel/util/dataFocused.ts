export function dataFocused(node: HTMLElement, condition: boolean) {
  function update(value: boolean) {
    if (value) {
      node.setAttribute('data-focused', '');
    } else {
      node.removeAttribute('data-focused');
    }
  }

  update(condition);

  return {
    update
  };
}
