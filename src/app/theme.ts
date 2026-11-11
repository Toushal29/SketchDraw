import type { Theme } from "../model";

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const STORAGE_KEY = "sketchdraw-theme";

export function readThemePreference(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light") return "light";
  return "dark";
}

export function writeThemePreference(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "light") {
    el.setAttribute("data-theme", "light");
  } else {
    el.removeAttribute("data-theme");
  }
}

export function resolvedColorScheme(theme: Theme): "light" | "dark" {
  return theme === "light" ? "light" : "dark";
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

export function readCustomTokens(): CustomThemeTokens {
  return {
    background: "#0c0c0e",
    surface: "#18181b",
    surfaceElevated: "#1f1f23",
    surfaceInput: "#26262b",
    border: "#2c2c33",
    textPrimary: "#e4e4e8",
    textSecondary: "#8b8b96",
    primary: "#3b82f6",
  };
}

export function writeCustomTokens(_tokens: CustomThemeTokens) {}
export function applyCustomTokens(_tokens: CustomThemeTokens) {}
export function clearCustomTokens() {}
