import { downloadText } from "../ui/download";
import { facilitator } from "./facilitator";
import {
  EXPORT_FIRST,
  SAVED_LINE,
  exportFirst,
  logFileName,
  titleExport,
} from "./facilitatorModel";
import { createMenu, type Menu, type MenuModel } from "../ui/menu";
import { heldRun } from "./heldRun";
import { arcById, variantById, type VariantId } from "./arcs";
import {
  TAGLINE,
  REPLACE_CONFIRM,
  TITLE,
  VARIANT_HEADING,
  WILSON,
  arcCompleteTitle,
  completeButtons,
  continueChoice,
  needsReplaceConfirm,
  pickerChoices,
  variantChoices,
} from "./arcModel";
import { introCardFor, partAfterIntro } from "./tutorialModel";
import type { Run } from "./run";
import type { Screen, ScreenEnv, ScreenRequest } from "./screen";

const arcsRequest = (variant: VariantId): ScreenRequest => ({
  mode: "arcs",
  variant,
});

type MenuRequest = Extract<
  ScreenRequest,
  { mode: "title" | "arcs" | "arcComplete" | "arcIntro" }
>;

function modelFor(
  req: MenuRequest,
  go: (to: ScreenRequest) => void,
  /** Asks before a choice that would replace the held summer. */
  pick: (to: ScreenRequest | undefined) => void,
): MenuModel {
  switch (req.mode) {
    case "title": {
      const held = heldRun();
      const cont = continueChoice(
        held && { campaign: held.campaign(), variant: held.variant },
      );
      const fx = titleExport(facilitator.on, held !== null);
      const exportItem = fx &&
        held && {
          label: fx.label,
          sub: fx.sub,
          small: true,
          onClick: () => saveLog(held),
        };
      return {
        title: TITLE,
        tagline: TAGLINE,
        heading: VARIANT_HEADING,
        scene: { wordmark: true },
        items: [
          ...(cont
            ? [
                {
                  label: cont.label,
                  sub: cont.sub,
                  primary: true,
                  onClick: () => cont.to && go(cont.to),
                },
              ]
            : []),
          ...(exportItem ? [exportItem] : []),
          ...variantChoices().map((c) => ({
            label: c.label,
            sub: c.sub,
            onClick: () => c.to && go(c.to),
          })),
          { label: WILSON.label, sub: WILSON.note },
        ],
      };
    }
    case "arcs": {
      const held = heldRun();
      return {
        title: variantById(req.variant).label,
        heading: "Choose an arc",
        scene: { wordmark: false },
        items: pickerChoices(
          req.variant,
          held && { campaign: held.campaign(), variant: held.variant },
        ).map((c) => ({
          label: c.label,
          sub: c.sub,
          lines: c.lines,
          onClick: () => pick(c.to),
        })),
        buttons: [{ label: "Back", onClick: () => go({ mode: "title" }) }],
      };
    }
    case "arcComplete": {
      const arc = arcById(req.arc);
      return {
        title: arcCompleteTitle(arc),
        paragraphs: [arc.completion],
        buttons: completeButtons(req.arc, req.variant).map((b) => ({
          label: b.label,
          primary: b.primary,
          // Go on to Arc 2 replaces a held summer, so it asks first like the picker does.
          onClick: () => pick(b.to),
        })),
      };
    }
    case "arcIntro": {
      const card = introCardFor(arcById(req.arc));
      const start = (button: "begin" | "skip") =>
        go({
          mode: "arcPlay",
          arc: req.arc,
          variant: req.variant,
          part: partAfterIntro(button),
          // Arc 2 plays the seed the intro was opened with, and does not show the card again.
          ...(req.seed !== undefined ? { seed: req.seed } : {}),
          introSeen: true,
        });
      return {
        title: card.title,
        paragraphs: card.paragraphs,
        scene: { wordmark: false },
        buttons: [
          { label: card.begin, primary: true, onClick: () => start("begin") },
          ...(card.skip
            ? [{ label: card.skip, onClick: () => start("skip") }]
            : []),
          { label: "Back", onClick: () => go(arcsRequest(req.variant)) },
        ],
      };
    }
  }
}

/** Saves the held run's session log as a file; the line is what the card says afterwards. */
function saveLog(run: Run): string {
  downloadText(logFileName(run.seed), run.exportJson());
  return SAVED_LINE;
}

/** The title, arc picker and arc-complete screens: a menu card over an empty board. */
export function mountMenu(env: ScreenEnv, req: MenuRequest): Screen {
  const menu = createMenu(env.ui);
  let confirming = false;
  const show = () => {
    confirming = false;
    menu.show(modelFor(req, env.go, pick));
  };
  const pick = (to: ScreenRequest | undefined) => {
    if (!to) return;
    if (needsReplaceConfirm(to, heldRun() !== null)) {
      confirming = true;
      confirmReplace(menu, to, env.go, show);
      return;
    }
    env.go(to);
  };
  show();
  return {
    tick: () => {},
    setStats: () => {},
    // Browser Back steps up one screen: the question to the card it came from, the intro and the
    // arc-complete card to the picker, the picker to the title. The title has none, so Back there
    // is the browser's own.
    ...(req.mode === "title"
      ? {}
      : {
          back() {
            if (confirming) show();
            else
              env.go(
                req.mode === "arcs"
                  ? { mode: "title" }
                  : arcsRequest(req.variant),
              );
          },
        }),
    dispose() {
      menu.dispose();
      env.ui.replaceChildren();
    },
  };
}

/** The in-page card before a new summer replaces the held one; keeping it comes first and has focus. */
function confirmReplace(
  menu: Menu,
  to: ScreenRequest,
  go: (to: ScreenRequest) => void,
  back: () => void,
) {
  const held = heldRun();
  // A facilitator can save the log of the summer about to be replaced.
  const first = exportFirst(facilitator.on, held !== null);
  menu.show({
    title: REPLACE_CONFIRM.title,
    paragraphs: [REPLACE_CONFIRM.text, ...(first ? [first.line] : [])],
    focusFirstButton: true,
    buttons: [
      { label: REPLACE_CONFIRM.keep, primary: true, onClick: back },
      ...(first && held
        ? [{ label: EXPORT_FIRST.button, onClick: () => saveLog(held) }]
        : []),
      { label: REPLACE_CONFIRM.replace, onClick: () => go(to) },
    ],
  });
}
