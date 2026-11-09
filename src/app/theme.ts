import type { Theme } from "../model";

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "ai", label: "AI" },
  { value: "minimalist", label: "Minimal" },
  { value: "custom", label: "Custom" },
];

const VALID_THEMES = new Set<string>(THEME_OPTIONS.map(o => o.value));

export function readThemePreference(): Theme {
  try {
    const stored = localStorage.getItem("sketchdraw-theme");
    if (stored && VALID_THEMES.has(stored)) return stored as Theme;
  } catch { /* Fall through to default. */ }
  return "system";
}

export function writeThemePreference(theme: Theme) {
  try { localStorage.setItem("sketchdraw-theme", theme); } catch { /* Theme still applies for this session. */ }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function resolvedColorScheme(theme: Theme): "light" | "dark" {
  if (theme === "dark" || theme === "ai") return "dark";
  if (theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return "light";
}

export type CustomThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceInput: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
};

const CUSTOM_TOKEN_MAP: Record<keyof CustomThemeTokens, string> = {
  background: "--custom-background",
  surface: "--custom-surface",
  surfaceElevated: "--custom-surface-elevated",
  surfaceInput: "--custom-surface-input",
  border: "--custom-border",
  textPrimary: "--custom-text-primary",
  textSecondary: "--custom-text-secondary",
  primary: "--custom-primary",
};

export function readCustomTokens(): CustomThemeTokens {
  const defaults: CustomThemeTokens = {
    background: "#F5F5F7",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    surfaceInput: "#F2F2F7",
    border: "#D1D1D6",
    textPrimary: "#1D1D1F",
    textSecondary: "#636366",
    primary: "#007AFF",
  };
  try {
    const stored = localStorage.getItem("sketchdraw-custom-theme");
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const key of Object.keys(defaults) as (keyof CustomThemeTokens)[]) {
        if (typeof parsed[key] === "string" && /^#[\da-f]{6}$/i.test(parsed[key])) {
          defaults[key] = parsed[key];
        }
      }
    }
  } catch { /* Use defaults. */ }
  return defaults;
}

export function writeCustomTokens(tokens: CustomThemeTokens) {
  try { localStorage.setItem("sketchdraw-custom-theme", JSON.stringify(tokens)); } catch { /* Tokens still apply for this session. */ }
}

export function applyCustomTokens(tokens: CustomThemeTokens) {
  const root = document.documentElement;
  for (const [key, prop] of Object.entries(CUSTOM_TOKEN_MAP) as [keyof CustomThemeTokens, string][]) {
    root.style.setProperty(prop, tokens[key]);
  }
  const lum = relativeLuminance(tokens.background);
  root.style.setProperty("--custom-color-scheme", lum > 0.4 ? "light" : "dark");
}

export function clearCustomTokens() {
  const root = document.documentElement;
  for (const prop of Object.values(CUSTOM_TOKEN_MAP)) {
    root.style.removeProperty(prop);
  }
  root.style.removeProperty("--custom-color-scheme");
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
