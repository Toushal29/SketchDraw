/** Bounds a single captured stroke so pathological input cannot exhaust canvas memory. */
export const MAX_STROKE_POINTS = 100_000;

/** Bounds stroke data loaded from one document across all pages and groups. */
export const MAX_DOCUMENT_STROKE_POINTS = 1_000_000;
