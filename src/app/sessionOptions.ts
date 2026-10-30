import type { SessionDebug } from "../ui/debugPanel";
import { settings, type Run } from "./run";

/** The facilitator switches and the log export, as the debug panel shows them. */
export function sessionOptions(run: Run): SessionDebug {
  return {
    brought: settings.brought,
    probe: settings.probe,
    onBrought(on) {
      settings.brought = on;
      run.ui("setting", `brought=${on}`);
    },
    onProbe(on) {
      settings.probe = on;
      run.ui("setting", `probe=${on}`);
    },
    exportJson: () => run.exportJson(),
    fileName: `zebrawars-session-seed${run.seed}.json`,
  };
}
