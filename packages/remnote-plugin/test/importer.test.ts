import { describe, it, expect } from "vitest";
import { importIntoDailyDoc, isPayload } from "../src/importer";

const fake = (today: { _id: string } | undefined | null = { _id: "daily" }) => {
  const calls: any[] = [];
  return {
    calls,
    date: { getTodaysDoc: async () => today ?? undefined },
    rem: {
      createSingleRemWithMarkdown: async (md: string, parent?: string) => { calls.push(["single", md, parent]); return { _id: "src1" }; },
      createTreeWithMarkdown: async (md: string, parent?: string) => { calls.push(["tree", md, parent]); return []; },
    },
  };
};

describe("importIntoDailyDoc", () => {
  it("creates a linked source rem under today's doc, then the card tree under it", async () => {
    const p = fake();
    const id = await importIntoDailyDoc(p, { title: "A [odd] (title)", url: "https://x.test/a", markdown: "- T =- m" });
    expect(id).toBe("src1");
    expect(p.calls[0]).toEqual(["single", "📥 [A odd title](https://x.test/a)", "daily"]);
    expect(p.calls[1]).toEqual(["tree", "- T =- m", "src1"]);
  });
  it("fails clearly when there is no Daily Document", async () => {
    await expect(importIntoDailyDoc(fake(null), { title: "t", url: "u", markdown: "m" })).rejects.toThrow(/Daily Document/);
  });
  it("validates payload shape", () => {
    expect(isPayload({ title: "t", url: "u", markdown: "m" })).toBe(true);
    expect(isPayload({ title: "t" })).toBe(false);
    expect(isPayload(null)).toBeFalsy();
  });
});
