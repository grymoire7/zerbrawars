import { describe, expect, it } from "vitest";

// B2 enforcement: no player-facing pathogen word in a string literal outside the central module
// (src/sim/organisms.ts). Comments and identifiers (strep:, KIND_COLOR.staph) are not scanned;
// only text inside string and template literals is.

const sources = import.meta.glob("/src/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const BANNED =
  /aspergillus|staph|strep|\bmou?ld|\bfungus|\bfungi\b|\bbacteri(?:a|um|al)\b/i;

/** Files that may say these words, each with the reason. */
const FILE_ALLOWLIST: Record<string, string> = {
  "/src/sim/organisms.ts": "the central module: the names live here",
};

/** String literals that are ids, not text a player reads. */
const ID_LITERALS: readonly [RegExp, string][] = [
  [/^(?:strep|staph|aspergillus)$/, "pathogen kind ids (PATHOGEN_KINDS keys)"],
  [/^(?:strep|staph|aspergillus)-ink$/, "palette token names"],
  [/^(?:mold|bacterium)$/, "PathogenForm ids"],
];

/** Text of every string and template literal in a TypeScript source, comments skipped. */
export function literals(src: string): string[] {
  const out: string[] = [];
  const n = src.length;
  let i = 0;
  // Each open template is on the stack with the brace depth of its current ${ } (or -1 in text).
  const stack: { text: string; depth: number }[] = [];
  const push = (t: string) => out.push(t);
  while (i < n) {
    const top = stack.at(-1);
    const c = src[i];
    if (top && top.depth < 0) {
      // Inside template text.
      if (c === "\\") {
        top.text += src.slice(i, i + 2);
        i += 2;
      } else if (c === "`") {
        push(top.text);
        stack.pop();
        i++;
      } else if (c === "$" && src[i + 1] === "{") {
        push(top.text);
        top.text = "";
        top.depth = 0;
        i += 2;
      } else {
        top.text += c;
        i++;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n")
        j += src[j] === "\\" ? 2 : 1;
      push(src.slice(i + 1, j));
      i = j + 1;
    } else if (c === "`") {
      stack.push({ text: "", depth: -1 });
      i++;
    } else if (top && c === "{") {
      top.depth++;
      i++;
    } else if (top && c === "}") {
      if (top.depth === 0) top.depth = -1;
      else top.depth--;
      i++;
    } else {
      i++;
    }
  }
  return out;
}

const isId = (s: string) =>
  s.includes("--zw-") || ID_LITERALS.some(([re]) => re.test(s));

describe("organism names", () => {
  it("scans the real source tree", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it("finds pathogen words in literals but not in comments or ids", () => {
    const ok = literals(
      '// Staph here\n/* mold */ const a = { strep: 1 }; const b = "strep"; const c = `x ${"staph"}`;',
    );
    expect(ok.filter((s) => BANNED.test(s) && !isId(s))).toEqual([]);
    const bad = literals('const t = `a ${x} mold`; const u = "Strep 1";');
    expect(bad.filter((s) => BANNED.test(s) && !isId(s))).toEqual([
      " mold",
      "Strep 1",
    ]);
  });

  it("keeps pathogen words out of every string outside the central module", () => {
    const found: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      if (/\.test\.ts$/.test(path) || path in FILE_ALLOWLIST) continue;
      for (const s of literals(src)) {
        if (BANNED.test(s) && !isId(s))
          found.push(`${path}: ${s.slice(0, 80)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
