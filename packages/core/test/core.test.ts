import { describe, it, expect } from "vitest";
import { renderCardSet, validate, hasErrors, chunkText, generateCards } from "../src";
import type { CardSet } from "../src";

const cushing: CardSet = {
  topic: "Hypercortisolism disorders",
  scaffold: "Chronic cortisol excess drives tissue breakdown and metabolic syndrome",
  gaps: [], scenarioNotes: [],
  clusters: [{
    concept: "Cushing's syndrome",
    definition: "Clinical state from chronic excess glucocorticoid exposure, from any source",
    direction: "backward",
    descriptors: [
      { kind: "descriptor", prompt: "Most common cause overall", answer: "Exogenous glucocorticoid therapy" },
      { kind: "descriptor", prompt: "Classic fat-redistribution signs (2)", answer: "Moon facies and buffalo hump" },
      { kind: "scenario", prompt: "truncal obesity, hypertension, purple abdominal striae - first test?", answer: "Screen for hypercortisolism (e.g. low-dose dexamethasone suppression)" },
      { kind: "contrast", prompt: "unlike Cushing's syndrome (any cortisol excess), what defines Cushing's disease?", answer: "A pituitary ACTH-secreting adenoma as the cause" },
    ],
  }],
};

describe("render", () => {
  it("matches the golden RemNote block", () => {
    expect(renderCardSet(cushing)).toBe(`- Hypercortisolism disorders =- Chronic cortisol excess drives tissue breakdown and metabolic syndrome
  - Cushing's syndrome :< Clinical state from chronic excess glucocorticoid exposure, from any source
    - Most common cause overall ;; Exogenous glucocorticoid therapy
    - Classic fat-redistribution signs (2) ;; Moon facies and buffalo hump
    - Scenario: truncal obesity, hypertension, purple abdominal striae - first test? ;; Screen for hypercortisolism (e.g. low-dose dexamethasone suppression)
    - Contrast: unlike Cushing's syndrome (any cortisol excess), what defines Cushing's disease? ;; A pituitary ACTH-secreting adenoma as the cause`);
  });
  it("uses :: and :> for the other directions and >> for basic cards", () => {
    const s = structuredClone(cushing);
    s.clusters[0].direction = "both";
    s.clusters[0].descriptors = [{ kind: "basic", prompt: "Psych: name the effect", answer: "Negative contrast" }];
    expect(renderCardSet(s)).toContain("Cushing's syndrome :: ");
    expect(renderCardSet(s)).toContain("Psych: name the effect >> Negative contrast");
    s.clusters[0].direction = "forward";
    expect(renderCardSet(s)).toContain(" :> ");
  });
});

describe("validate", () => {
  it("accepts the golden cluster (no errors)", () => {
    expect(hasErrors(validate(cushing))).toBe(false);
  });
  const bad = (d: Partial<CardSet["clusters"][0]["descriptors"][0]>) => {
    const s = structuredClone(cushing);
    s.clusters[0].descriptors[0] = { kind: "descriptor", prompt: "Cause", answer: "x", ...d };
    return validate(s);
  };
  it("flags answers over 15 words (Rule 2)", () => {
    expect(bad({ answer: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen" }).some((i) => i.rule === 2)).toBe(true);
  });
  it("flags unordered lists over 3 items (Rule 10)", () => {
    expect(bad({ prompt: "Symptoms", answer: "moon facies, buffalo hump, striae, hypertension, osteoporosis" }).some((i) => i.rule === 10)).toBe(true);
  });
  it("allows a counted 3-item list", () => {
    expect(bad({ prompt: "Classic signs (3)", answer: "A, B, C" }).some((i) => i.rule === 10)).toBe(false);
  });
  it("flags yes/no prompts and answers (Rule 4)", () => {
    expect(bad({ prompt: "Does more light raise the rate?", answer: "No" }).some((i) => i.rule === 4)).toBe(true);
  });
  it("flags source references (Rule 3) and delimiter injection", () => {
    expect(bad({ answer: "as the author says" }).some((i) => i.rule === 3)).toBe(true);
    expect(bad({ answer: "a ;; b" }).some((i) => i.rule === 0)).toBe(true);
  });
});

describe("chunkText", () => {
  it("never drops text", () => {
    const t = Array.from({ length: 50 }, (_, i) => `para ${i} ` + "x".repeat(100)).join("\n\n");
    const parts = chunkText(t, 500);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("\n\n").replace(/\s+/g, "")).toBe(t.replace(/\s+/g, ""));
  });
});

describe("generateCards", () => {
  const reply = (set: CardSet) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(set) }], usage: { input_tokens: 10, output_tokens: 5 } });
  it("runs one repair pass when the first answer breaks rules", async () => {
    const broken = structuredClone(cushing);
    broken.clusters[0].descriptors[0].answer = "a, b, c, d, e";
    const calls: any[] = [];
    const res = await generateCards({ title: "T", url: "u", text: "body" }, {
      apiKey: "k",
      createMessage: async (p) => { calls.push(p); return calls.length === 1 ? reply(broken) : reply(cushing); },
    });
    expect(calls.length).toBe(2);
    expect(calls[0].model).toBe("claude-opus-5-5");
    expect(calls[0].output_config.format.type).toBe("json_schema");
    expect(hasErrors(res.issues)).toBe(false);
    expect(res.usage.input).toBe(20);
  });
  it("surfaces refusals", async () => {
    await expect(generateCards({ title: "T", url: "u", text: "b" }, { apiKey: "k", createMessage: async () => ({ stop_reason: "refusal", content: [], stop_details: { category: "cyber" } }) })).rejects.toThrow(/declined/);
  });
});
