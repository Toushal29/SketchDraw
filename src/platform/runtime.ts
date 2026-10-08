/** Shared platform gate for Windows-only interface and feature code. */
export const isWindowsPlatform = () =>
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
