/** JSON schema passed to output_config.format. Kept strict-friendly (additionalProperties:false, all required). */
export const CARD_SET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "scaffold", "clusters", "gaps", "scenarioNotes"],
  properties: {
    topic: { type: "string" },
    scaffold: { type: "string" },
    clusters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["concept", "definition", "direction", "descriptors"],
        properties: {
          concept: { type: "string" },
          definition: { type: "string" },
          direction: { type: "string", enum: ["both", "forward", "backward"] },
          descriptors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "prompt", "answer"],
              properties: {
                kind: { type: "string", enum: ["descriptor", "scenario", "counterfactual", "contrast", "basic"] },
                prompt: { type: "string" },
                answer: { type: "string" },
              },
            },
          },
        },
      },
    },
    gaps: { type: "array", items: { type: "string" } },
    scenarioNotes: { type: "array", items: { type: "string" } },
  },
} as const;
