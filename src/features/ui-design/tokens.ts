import type { UIColorToken, UITypographyStyle, UITypographyToken, UIValueToken } from "./model";

type AliasToken = { id: string; aliasOf?: string };

/** Returns false for any alias graph that contains a self or indirect cycle. */
export function hasTokenAliasCycle<T extends AliasToken>(tokens: readonly T[]): boolean {
  const byId = new Map(tokens.map(token => [token.id, token]));
  const done = new Set<string>();
  for (const token of tokens) {
    const path = new Set<string>();
    let current: T | undefined = token;
    while (current?.aliasOf && byId.has(current.aliasOf)) {
      if (path.has(current.id)) return true;
      if (done.has(current.id)) break;
      path.add(current.id);
      current = byId.get(current.aliasOf);
    }
    if (current && path.has(current.id)) return true;
    for (const id of path) done.add(id);
  }
  return false;
}

/** Checks an alias edit before it is committed, so the picker can omit invalid targets. */
export function canSetTokenAlias<T extends AliasToken>(tokens: readonly T[], sourceId: string, targetId: string): boolean {
  if (!targetId) return true;
  if (sourceId === targetId) return false;
  const byId = new Map(tokens.map(token => [token.id, token]));
  const seen = new Set<string>();
  let current = byId.get(targetId);
  while (current?.aliasOf) {
    if (current.id === sourceId || seen.has(current.id)) return false;
    seen.add(current.id);
    current = byId.get(current.aliasOf);
  }
  return current !== undefined && current.id !== sourceId;
}

function aliasChain<T extends AliasToken>(token: T | undefined, tokens: readonly T[] = []): T[] | undefined {
  if (!token) return undefined;
  const byId = new Map(tokens.map(item => [item.id, item]));
  byId.set(token.id, token);
  const chain: T[] = [];
  const seen = new Set<string>();
  let current: T | undefined = token;
  while (current) {
    if (seen.has(current.id)) return undefined;
    seen.add(current.id);
    chain.push(current);
    if (!current.aliasOf) return chain;
    current = byId.get(current.aliasOf);
    if (!current) return undefined;
  }
  return undefined;
}

export function resolveColorToken(tokens: readonly UIColorToken[], id: string, modeId: string, fallback: string): string {
  const chain = aliasChain(tokens.find(token => token.id === id), tokens);
  const value = chain?.find(token => token.modeValues?.[modeId] !== undefined)?.modeValues?.[modeId] ?? chain?.[chain.length - 1]?.value;
  return value && /^#[\da-f]{3,8}$/i.test(value) ? value : fallback;
}

/** Converts a color alias to independent values while preserving every mode. */
export function materializeColorToken(token: UIColorToken, modeIds: readonly string[], tokens: readonly UIColorToken[]): UIColorToken {
  return {
    ...token,
    value: resolveColorToken(tokens, token.id, "", token.value),
    aliasOf: undefined,
    modeValues: Object.fromEntries(modeIds.map(modeId => [modeId, resolveColorToken(tokens, token.id, modeId, token.value)])),
  };
}

export function resolveTypographyToken(token: UITypographyToken | undefined, modeId: string, tokens?: readonly UITypographyToken[]): UITypographyStyle | undefined {
  const chain = aliasChain(token, tokens);
  if (!chain) return undefined;
  const base = chain[chain.length - 1];
  const fields: Array<keyof UITypographyStyle> = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"];
  const result = {} as UITypographyStyle;
  for (const field of fields) {
    const modeValue = chain.find(item => item.modeValues?.[modeId]?.[field] !== undefined)?.modeValues?.[modeId]?.[field];
    result[field] = (modeValue ?? base[field]) as never;
  }
  return result;
}

export function resolveValueToken(token: UIValueToken | undefined, modeId: string, tokens?: readonly UIValueToken[]): number | undefined {
  const chain = aliasChain(token, tokens);
  if (!chain) return undefined;
  const base = chain[chain.length - 1];
  const override = chain.find(item => item.modeValues?.[modeId] !== undefined);
  const value = override?.modeValues?.[modeId] ?? base.value;
  const unit = override?.unit ?? base.unit;
  return value * (unit === "rem" ? 16 : 1);
}

/** Converts an alias to independent values while preserving its current appearance in every mode. */
export function materializeTypographyToken(token: UITypographyToken, modeIds: readonly string[], tokens: readonly UITypographyToken[]): UITypographyToken {
  const base = resolveTypographyToken(token, "", tokens) ?? token;
  const modeValues = Object.fromEntries(modeIds.map(modeId => [modeId, resolveTypographyToken(token, modeId, tokens) ?? base]));
  return { ...token, ...base, aliasOf: undefined, modeValues };
}

/** Converts an alias to independent values while preserving its current appearance in every mode. */
export function materializeValueToken(token: UIValueToken, modeIds: readonly string[], tokens: readonly UIValueToken[]): UIValueToken {
  const unitScale = token.unit === "rem" ? 16 : 1;
  const toTokenUnit = (modeId: string) => {
    const value = resolveValueToken(token, modeId, tokens);
    return value === undefined ? token.value : value / unitScale;
  };
  return {
    ...token,
    value: toTokenUnit(""),
    aliasOf: undefined,
    modeValues: Object.fromEntries(modeIds.map(modeId => [modeId, toTokenUnit(modeId)])),
  };
}

export type UIEffectToken = { id: string; name: string; value: string; modeValues?: Record<string, string>; aliasOf?: string };

export function resolveEffectToken(token: UIEffectToken | undefined, modeId: string, tokens?: readonly UIEffectToken[]): string | undefined {
  const chain = aliasChain(token, tokens);
  if (!chain) return undefined;
  const base = chain[chain.length - 1];
  return chain.find(item => item.modeValues?.[modeId] !== undefined)?.modeValues?.[modeId] ?? base.value;
}

/** Converts an alias to independent values while preserving its current appearance in every mode. */
export function materializeEffectToken(token: UIEffectToken, modeIds: readonly string[], tokens: readonly UIEffectToken[]): UIEffectToken {
  const value = resolveEffectToken(token, "", tokens) ?? token.value;
  const modeValues = Object.fromEntries(modeIds.map(modeId => [modeId, resolveEffectToken(token, modeId, tokens) ?? value]));
  return { ...token, value, aliasOf: undefined, modeValues };
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function colorLuminance(value: string): number | undefined {
  const raw = value.trim().replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(raw)) return undefined;
  const hex = raw.length === 3 ? [...raw].map(char => char + char).join("") : raw;
  const [r, g, b] = [0, 2, 4].map(offset => linearChannel(parseInt(hex.slice(offset, offset + 2), 16)));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number | undefined {
  const a = colorLuminance(foreground), b = colorLuminance(background);
  if (a === undefined || b === undefined) return undefined;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
