import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function readReducedMotionPreference(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    const onChange = () => setPrefersReducedMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}
