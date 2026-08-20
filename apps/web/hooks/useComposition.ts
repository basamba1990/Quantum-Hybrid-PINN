import * as React from "react";

interface UseCompositionProps<T> {
  onKeyDown?: React.KeyboardEventHandler<T>;
  onCompositionStart?: React.CompositionEventHandler<T>;
  onCompositionEnd?: React.CompositionEventHandler<T>;
}

export function useComposition<T extends HTMLElement>({
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: UseCompositionProps<T>) {
  const isComposing = React.useRef(false);

  const handleCompositionStart = React.useCallback(
    (e: React.CompositionEvent<T>) => {
      isComposing.current = true;
      onCompositionStart?.(e);
    },
    [onCompositionStart]
  );

  const handleCompositionEnd = React.useCallback(
    (e: React.CompositionEvent<T>) => {
      isComposing.current = false;
      onCompositionEnd?.(e);
    },
    [onCompositionEnd]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<T>) => {
      if (isComposing.current) {
        return;
      }
      onKeyDown?.(e);
    },
    [onKeyDown]
  );

  return {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
    isComposing: () => isComposing.current,
  };
}
