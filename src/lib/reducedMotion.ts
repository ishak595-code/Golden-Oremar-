/**
 * Detect if user prefers reduced motion for accessibility.
 * Use this to respect vestibular disorders and motion sensitivity.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Get appropriate scroll behavior based on user's motion preference.
 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
