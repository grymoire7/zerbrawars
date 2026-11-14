import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const load = async (search: string, reduce: boolean) => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { search },
    matchMedia: () => ({ matches: reduce }),
  });
  return (await import("./motion")).calm;
};

describe("calm", () => {
  it("is false by default", async () => {
    expect((await load("", false))()).toBe(false);
  });
  it("follows prefers-reduced-motion", async () => {
    expect((await load("", true))()).toBe(true);
  });
  it("follows ?still=1", async () => {
    expect((await load("?still=1", false))()).toBe(true);
    expect((await load("?still=0", false))()).toBe(false);
  });
});
