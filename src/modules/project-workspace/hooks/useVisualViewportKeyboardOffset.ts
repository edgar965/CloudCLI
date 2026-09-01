import { useEffect } from 'react';

/** Keeps the fixed workspace shell above the virtual keyboard in iOS Safari. */
export function useVisualViewportKeyboardOffset() {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return undefined;
    }

    const updateKeyboardHeight = () => {
      // Only an on-screen keyboard is meant here. A window that changes size -
      // going fullscreen and back - reports a viewport that does not match
      // innerHeight for a moment, and with no further event the shell keeps
      // that gap: the message box ends up below the visible area. A pointer
      // that is not touch has no on-screen keyboard to make room for.
      const keyboardHeight = navigator.maxTouchPoints > 0
        ? Math.max(0, window.innerHeight - visualViewport.height)
        : 0;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    };

    visualViewport.addEventListener('resize', updateKeyboardHeight);
    // The window settles after the viewport does, so a fullscreen change is
    // measured again from here rather than left at the value in between.
    window.addEventListener('resize', updateKeyboardHeight);
    return () => {
      visualViewport.removeEventListener('resize', updateKeyboardHeight);
      window.removeEventListener('resize', updateKeyboardHeight);
    };
  }, []);
}
