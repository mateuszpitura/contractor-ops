import { useCallback, useRef, useState } from 'react';

const DEFAULT_DELAY = 3000;

/**
 * Double-confirmation pattern: first click sets "confirming" state,
 * second click within timeout triggers the action. Resets automatically
 * after the delay expires.
 */
export function useDoubleConfirmation(
  onConfirm: () => void,
  delay = DEFAULT_DELAY,
): {
  isConfirming: boolean;
  handleClick: () => void;
  cancel: () => void;
} {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    setIsConfirming(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!isConfirming) {
      setIsConfirming(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, delay);
      return;
    }
    // Second click — confirm
    clearTimeout(timerRef.current);
    setIsConfirming(false);
    onConfirm();
  }, [isConfirming, delay, onConfirm]);

  return { isConfirming, handleClick, cancel };
}
