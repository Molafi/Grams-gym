/**
 * Helpers for the website text editor (pure: no DB, safe to unit-test).
 * Text lives in messages/{ar,en}.json; admins override single strings by key ("home.hero.title").
 */
type Tree = { [k: string]: string | Tree };

export function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

/** Returns a copy of `tree` with `overrides` (flat keys) applied. Unknown keys are ignored. */
export function applyOverrides<T extends Tree>(tree: T, overrides: { key: string; value: string }[]): T {
  const copy = structuredClone(tree);
  for (const { key, value } of overrides) {
    const parts = key.split(".");
    let node: Tree = copy;
    let ok = true;
    for (const p of parts.slice(0, -1)) {
      const next = node[p];
      if (!next || typeof next === "string") {
        ok = false;
        break;
      }
      node = next;
    }
    const last = parts[parts.length - 1]!;
    if (ok && typeof node[last] === "string") node[last] = value;
  }
  return copy;
}

/**
 * The parts of a message the code relies on: `{name}` arguments and `<tag>` rich-text tags.
 * An edit must keep exactly the same set, otherwise the page would fail to render.
 */
export function placeholders(message: string): string[] {
  const found = new Set<string>();
  // `{name}` or `{name, plural, …}` — not plural branch text like `{0 days}` / `{# days}`.
  for (const m of message.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)) found.add(`{${m[1]}}`);
  for (const m of message.matchAll(/<\/?([a-zA-Z0-9_]+)>/g)) found.add(`<${m[1]}>`);
  return [...found].sort();
}

/** Braces and rich-text tags must be balanced, or the message can't be formatted. */
export function balanced(message: string): boolean {
  let depth = 0;
  for (const ch of message.replace(/'[{}]'/g, "")) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return false;
  }
  if (depth !== 0) return false;
  const stack: string[] = [];
  for (const m of message.matchAll(/<(\/?)([a-zA-Z0-9_]+)>/g)) {
    if (!m[1]) stack.push(m[2]!);
    else if (stack.pop() !== m[2]) return false;
  }
  return stack.length === 0;
}

export function samePlaceholders(a: string, b: string): boolean {
  return balanced(b) && placeholders(a).join("|") === placeholders(b).join("|");
}

/** Namespaces admins can't edit (internal / admin-only strings). */
export const LOCKED_NAMESPACES = new Set(["admin", "testMode", "a11y", "palette"]);

export const namespaceOf = (key: string) => key.split(".")[0] ?? key;
