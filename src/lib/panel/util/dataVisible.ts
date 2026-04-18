export function dataVisible(node: HTMLElement, visible: boolean) {
  //
  function update(visible: boolean) {
    if (visible) {
      node.setAttribute('data-visible', '');
    } else {
      node.removeAttribute('data-visible');
    }
  }

  update(visible);

  return {
    update
  };
}
