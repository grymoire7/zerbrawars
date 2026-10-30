import { createInsetView } from "../render/insetView";
import { battleFromLoadout } from "../sim/battle/setup";
import { campaignSummary, carryPreview } from "../sim/campaign";
import { loadoutFromLife } from "../sim/life/loadout";
import { createDebugPanel } from "../ui/debugPanel";
import { createInterlude, type InterludeModel } from "../ui/interlude";
import { weekLine } from "./campaignModel";
import type { Run } from "./run";
import type { Screen, ScreenEnv } from "./screen";
import { sessionOptions } from "./sessionOptions";

/** The beats between weeks that have no board: a quiet week, and the campaign summary. */
export function mountInterlude(
  env: ScreenEnv,
  run: Run,
  kind: "quiet" | "summary",
): Screen {
  const { root, panels, ui } = env;
  document.getElementById("app")?.classList.add("life");
  const c = run.campaign();
  const slab = battleFromLoadout(loadoutFromLife(c.life));
  const inset = createInsetView(root, slab);
  inset.setAura(c.life.medLevel);
  const card = createInterlude(ui);

  const debug = createDebugPanel(panels.scroll, {
    mode: "campaign",
    onMode: (m) =>
      env.go(m === "campaign" ? { mode: "campaign" } : { mode: m }),
    scenario: "",
    seed: run.seed,
    session: sessionOptions(run),
  });

  let model: InterludeModel;
  if (kind === "quiet") {
    const carry = carryPreview(c);
    const last = c.cycle >= c.cycles;
    model = {
      title: "A quiet week",
      lead: "Nothing landed and nothing flared, so there is nothing to fight. Enjoy it.",
      notes: [
        `You get a breather: energy goes from ${carry.energy.left} to ${carry.energy.next} for ${last ? "the days after" : "next week"}.`,
      ],
      groups: [],
      buttons: [
        {
          label: last ? "See your summary" : `Start week ${c.life.week + 1}`,
          primary: true,
          onClick: () => {
            run.next();
            env.go(
              run.campaign().mode === "done"
                ? { mode: "summary", run }
                : { mode: "life", run },
            );
          },
        },
      ],
    };
  } else {
    const sum = campaignSummary(c);
    const g = sum.grades;
    const battles = g.cleared + g.contained + g.neededBackup;
    model = {
      title: `Your ${c.cycles} weeks`,
      lead:
        `${sum.points} points across ${sum.weeks} weeks (${sum.goalsMet} goal${sum.goalsMet === 1 ? "" : "s"} met). ` +
        `${battles} ${battles === 1 ? "battle" : "battles"}, ${sum.quietWeeks} quiet.`,
      notes: [
        `Battles: ${g.cleared} all clear, ${g.contained} contained, ${g.neededBackup} needed backup. ` +
          `Doctor visits: ${sum.doctorVisits}${sum.earlyVisits > 0 ? ` (${sum.earlyVisits} early)` : ""}. ` +
          (sum.reservoirsLeft > 0
            ? `${sum.reservoirsLeft} still carried over at the end, and could show up as symptoms.`
            : "Nothing carried over at the end."),
      ],
      groups: c.history.map((h) => {
        const w = weekLine(h);
        return {
          head: `Week ${w.week}: ${w.points}`,
          lines: [w.result, w.doctor, w.carried],
        };
      }),
      buttons: [
        {
          label: "Play again (same seed)",
          primary: true,
          onClick: () => env.go({ mode: "campaign", seed: run.seed }),
        },
        {
          label: "New seed",
          onClick: () =>
            env.go({
              mode: "campaign",
              seed: Math.floor(Math.random() * 1_000_000),
            }),
        },
      ],
    };
  }
  card.show(model);

  return {
    setStats: (text) => debug.setStats(text),
    tick: (dt) => inset.tick(dt),
    dispose() {
      document.getElementById("app")?.classList.remove("life");
      card.dispose();
      inset.dispose();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
