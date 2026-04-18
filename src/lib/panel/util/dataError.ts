export function dataError(node: HTMLElement, condition: boolean) {
  //
  function update(value: boolean) {
    if (value) {
      node.setAttribute('data-error', '');
    } else {
      node.removeAttribute('data-error');
    }
  }

  update(condition);

  return {
    update
  };
}
