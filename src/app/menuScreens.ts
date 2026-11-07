import { createMenu, type MenuModel } from "../ui/menu";
import { arcById, variantById } from "./arcs";
import {
  TAGLINE,
  TITLE,
  VARIANT_HEADING,
  WILSON,
  arcChoices,
  arcCompleteTitle,
  completeButtons,
  variantChoices,
} from "./arcModel";
import type { Screen, ScreenEnv, ScreenRequest } from "./screen";

type MenuRequest = Extract<
  ScreenRequest,
  { mode: "title" | "arcs" | "arcComplete" }
>;

function modelFor(
  req: MenuRequest,
  go: (to: ScreenRequest) => void,
): MenuModel {
  switch (req.mode) {
    case "title":
      return {
        title: TITLE,
        tagline: TAGLINE,
        heading: VARIANT_HEADING,
        items: [
          ...variantChoices().map((c) => ({
            label: c.label,
            sub: c.sub,
            onClick: () => c.to && go(c.to),
          })),
          { label: WILSON.label, sub: WILSON.note },
        ],
      };
    case "arcs":
      return {
        title: variantById(req.variant).label,
        heading: "Choose an arc",
        items: arcChoices(req.variant).map((c) => ({
          label: c.label,
          sub: c.sub,
          lines: c.lines,
          onClick: () => c.to && go(c.to),
        })),
        buttons: [{ label: "Back", onClick: () => go({ mode: "title" }) }],
      };
    case "arcComplete": {
      const arc = arcById(req.arc);
      return {
        title: arcCompleteTitle(arc),
        paragraphs: [arc.completion],
        buttons: completeButtons(req.arc, req.variant).map((b) => ({
          label: b.label,
          primary: b.primary,
          onClick: () => go(b.to),
        })),
      };
    }
  }
}

/** The title, arc picker and arc-complete screens: a menu card over an empty board. */
export function mountMenu(env: ScreenEnv, req: MenuRequest): Screen {
  const menu = createMenu(env.ui);
  menu.show(modelFor(req, env.go));
  return {
    tick: () => {},
    setStats: () => {},
    dispose() {
      menu.dispose();
      env.ui.replaceChildren();
    },
  };
}
