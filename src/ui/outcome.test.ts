import { describe, expect, it } from "vitest";
import { outcomeHeading } from "./outcome";

describe("outcomeHeading", () => {
  it("says Backup arrived. kindly when the battle ended on the backup line", () => {
    const h = outcomeHeading("neededBackup", "backup");
    expect(h.title).toBe("Backup arrived.");
    expect(h.summary).toMatch(/care team stepped in/);
    expect(h.summary).not.toMatch(/fail|lost|your fault/i);
  });

  it("keeps the grade copy for other endings", () => {
    expect(outcomeHeading("cleared", "noFreePathogens").title).toBe(
      "All clear",
    );
    expect(outcomeHeading("neededBackup", "maxTurns").title).toBe(
      "Backup arrived",
    );
  });
});
