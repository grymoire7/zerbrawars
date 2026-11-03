import { describe, expect, it } from "vitest";
import { PARAMS } from "../sim/params";
import {
  battleStatusModel,
  inflammationState,
  tissueState,
  type BattleStatusInput,
} from "./battleModel";

const base: BattleStatusInput = {
  tissue: 18,
  damage: 0,
  medLevel: 1,
  charges: { antibacterial: 1, antifungal: 2, strong: 0 },
  choices: 215,
};
const cell = (i: BattleStatusInput, id: string) =>
  battleStatusModel(i).cells.find((c) => c.id === id)!;

describe("tissueState", () => {
  it("names the three bands", () => {
    expect(tissueState(20)).toBe("healthy");
    expect(tissueState(16)).toBe("healthy");
    expect(tissueState(15)).toBe("strained");
    expect(tissueState(11)).toBe("strained");
    expect(tissueState(PARAMS.outcome.backupTissueHealth)).toBe(
      "backup coming",
    );
    expect(tissueState(0)).toBe("backup coming");
  });
});

describe("inflammationState", () => {
  it("is calm at 0, warm at 1-2, hot at 3+", () => {
    expect(inflammationState(0)).toBe("calm");
    expect(inflammationState(1)).toBe("warm");
    expect(inflammationState(2)).toBe("warm");
    expect(inflammationState(3)).toBe("hot");
    expect(inflammationState(5)).toBe("hot");
  });
});

describe("battleStatusModel", () => {
  it("has Tissue, Inflammation, Medication and Score in order", () => {
    expect(battleStatusModel(base).cells.map((c) => c.label)).toEqual([
      "Tissue",
      "Inflammation",
      "Medication",
      "Score",
    ]);
  });

  it("reads tissue as health out of the maximum with a state word", () => {
    const t = cell(base, "tissue");
    expect(t.value).toBe("18/20");
    expect(t.state).toBe("healthy");
  });

  it("ghosts the next tick's loss on the tissue bar", () => {
    const t = cell({ ...base, damage: 2 }, "tissue");
    expect(t.bar).toMatchObject({ kind: "fill", solid: 0.8, ghost: 0.9 });
  });

  it("words the inflammation forecast", () => {
    const calm = cell(base, "inflammation");
    expect(calm.state).toBe("calm");
    expect(calm.value).toBe("none");
    const warm = cell({ ...base, damage: 1 }, "inflammation");
    expect(warm.state).toBe("warm");
    expect(warm.value).toBe("-1 next turn");
    expect(cell({ ...base, damage: 4 }, "inflammation").state).toBe("hot");
  });

  it("counts doses and charges", () => {
    const m = cell(base, "medication");
    expect(m.value).toBe("3/3");
    expect(m.explain).toContain("3 charges");
    expect(m.state).toBe("full");
    const low = cell(
      {
        ...base,
        medLevel: 1 / 3,
        charges: { antibacterial: 0, antifungal: 1, strong: 0 },
      },
      "medication",
    );
    expect(low.value).toBe("1/3");
    expect(low.explain).toContain("1 charge");
    expect(low.state).toBe("low");
    expect(cell({ ...base, medLevel: 0 }, "medication").state).toBe("none");
  });

  it("shows the score, and drops the cell in a standalone battle", () => {
    const s = cell(base, "score");
    expect(s.value).toBe("215");
    expect(s.state).toBe("Outcome next");
    expect(
      battleStatusModel({ ...base, choices: null }).cells.map((c) => c.id),
    ).toEqual(["tissue", "inflammation", "medication"]);
  });

  it("gives every cell a label, value, state word and explanation", () => {
    for (const c of battleStatusModel(base).cells) {
      expect(c.label && c.value && c.state && c.explain).toBeTruthy();
    }
  });
});
