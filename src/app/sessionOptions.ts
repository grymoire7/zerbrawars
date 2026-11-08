import type { SessionDebug } from "../ui/debugPanel";
import { logFileName } from "./facilitatorModel";
import { settings, type Run } from "./run";

/** The facilitator switches and the log export, as the debug panel and the menu show them. */
export function sessionOptions(run: Run): SessionDebug {
  return {
    get brought() {
      return settings.brought;
    },
    get probe() {
      return settings.probe;
    },
    onBrought(on) {
      settings.brought = on;
      run.ui("setting", `brought=${on}`);
    },
    onProbe(on) {
      settings.probe = on;
      run.ui("setting", `probe=${on}`);
    },
    exportJson: () => run.exportJson(),
    fileName: logFileName(run.seed),
  };
}
