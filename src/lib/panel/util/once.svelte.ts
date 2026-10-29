/** `once(func)` runs `func` one time, after the component mounts, in the browser only. */
export const useOnce = () => {
  const once = (func: Function) => {
    let done = $state(false);

    $effect(() => {
      if (!done) {
        func();
        done = true;
      }
    });
  };

  return { once };
};
