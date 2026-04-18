export function disabled(node: HTMLElement, condition: boolean | undefined) {
  //
  function update(value: boolean | undefined) {
    if (value) {
      node.setAttribute('disabled', '');
    } else {
      node.removeAttribute('disabled');
    }
  }

  update(condition);

  return {
    update
  };
}
