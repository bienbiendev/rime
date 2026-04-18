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
