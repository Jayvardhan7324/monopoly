// UX-2: Accessibility hook for modals.
// - Closes on Escape key
// - Focuses the container on mount (basic focus management)
// - Locks body scroll while open (prevents background scroll on mobile)
// - Returns a ref to attach to the modal container

import { useEffect, useRef } from 'react';

export interface ModalAccessibilityOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Allow Escape to close. Default true. */
  closeOnEscape?: boolean;
  /** Lock body scroll while open. Default true. */
  lockScroll?: boolean;
}

export function useModalAccessibility<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  closeOnEscape = true,
  lockScroll = true,
}: ModalAccessibilityOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus the container so keyboard users land in the modal.
    const node = containerRef.current;
    if (node) {
      // If the container has no tabindex, add one temporarily so focus works.
      if (!node.hasAttribute('tabindex')) {
        node.setAttribute('tabindex', '-1');
      }
      node.focus({ preventScroll: true });
    }

    const prevOverflow = lockScroll ? document.body.style.overflow : '';
    if (lockScroll) {
      document.body.style.overflow = 'hidden';
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Simple focus trap: if Tab goes outside the container, wrap around.
      if (e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (lockScroll) {
        document.body.style.overflow = prevOverflow;
      }
      // Restore focus to the element that opened the modal.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    };
  }, [isOpen, closeOnEscape, lockScroll, onClose]);

  return containerRef;
}
