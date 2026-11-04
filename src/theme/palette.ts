/**
 * The one source of truth for colour (B1a design spec, section 4.1).
 * Token name to hex string. Canvas and CSS use the string, three.js uses hex(name).
 * applyCssTokens sets --zw-<name> custom properties so UI style strings can say var(--zw-text).
 */
export const PALETTE = {
  bg: "#15171C",
  surface: "#1F232B",
  raised: "#272C36",
  control: "#2D3340",
  "control-hover": "#3A4150",
  line: "#3A4150",
  "line-strong": "#4A5263",
  text: "#E8EAF0",
  "text-muted": "#A9B0BD",
  focus: "#9FD8F0",
  order: "#EBA0FF",
  warn: "#FFB4AA",
  "warn-line": "#FF6A5A",
  goal: "#F0C05A",
  energy: "#9FD8F0",
  med: "#5BE3C6",
  tissue: "#F2A7A0",
  heat: "#FF9A3C",
  swarm: "#9FD8F0",
  "swarm-loaded": "#5E7C8C",
  cargo: "#4A3480",
  "region-lung": "#FF8CBD",
  "region-lung-bg": "#DFA08B",
  "region-skin": "#6A4E44",
  "region-lymph": "#46405E",
  "region-liver": "#4E3030",
  "region-gut": "#5A4436",
  strep: "#F0A843",
  "strep-ink": "#F2B35B",
  staph: "#1FA39A",
  "staph-ink": "#4FD3C7",
  aspergillus: "#9A80E8",
  "aspergillus-ink": "#B9A2F0",
  virus: "#B8C7D9",
  "sealed-rim": "#F4EFE0",
  "tissue-healthy": "#FF8CBD",
  "tissue-stressed": "#FF7F78",
  "tissue-damaged": "#D42A3C",
  "heat-ink": "#3A0F0B",
  spread: "#FFD23F",
  spore: "#6FB8FF",
  grow: "#F2F2F2",
  blocked: "#FF8A7A",
  stall: "#7FE0C8",
  // Incoming germs at a door (battle-depth slice 4): a thick ring, never the only cue.
  incoming: "#C6F25A",
  // Drawn at 80% opacity under every telegraph and order mark.
  "mark-halo": "#15171C",
  kill: "#FFF3C4",
  residual: "#FFD84A",
  granuloma: "#B08A5A",
  "granuloma-dark": "#5E4630",
  // Added in slice 1: literals the spec table has no token for.
  white: "#FFFFFF",
  "order-bg": "#3A2A4A",
  "notice-bg": "#2F2A22",
  "notice-line": "#6B5A3A",
  notice: "#D9A35C",
  "info-bg": "#22303A",
  "med-bg": "#173A33",
  // Activity cards (B1b-4): a bright accent per family and a dark tint of it for the card body.
  // Not green, teal or mint (medication) and not the germ colours; an icon always rides with them.
  "card-yard": "#F2D24B",
  "card-yard-bg": "#3F4039",
  "card-lake": "#4DA3FF",
  "card-lake-bg": "#2C3A4E",
  "card-band": "#FF6FAE",
  "card-band-bg": "#413444",
  "card-sleepover": "#8A8CFF",
  "card-sleepover-bg": "#33384E",
  "card-game": "#FF8A4C",
  "card-game-bg": "#44352E",
  "card-doctor": "#F1EDE2",
  "card-doctor-bg": "#3F434B",
  "card-rest": "#93A3BA",
  "card-rest-bg": "#343A46",
} as const;

export type PaletteName = keyof typeof PALETTE;

/** The colour as a number, for three.js materials and colours. */
export function hex(name: PaletteName): number {
  return parseInt(PALETTE[name].slice(1), 16);
}

/** Sets --zw-<name> on the given root (normally document.documentElement). */
export function applyCssTokens(root: HTMLElement): void {
  for (const name of Object.keys(PALETTE) as PaletteName[]) {
    root.style.setProperty(`--zw-${name}`, PALETTE[name]);
  }
}
