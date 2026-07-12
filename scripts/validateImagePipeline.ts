import { buildEditorialImagePlan } from "@/lib/editorialImagePrompt";

const fixtures = [
  {
    category: "Technology",
    headline: "AI Chipmakers Race to Meet Demand From Cloud Providers",
    summary:
      "Cloud companies are expanding data-center capacity as demand for AI workloads grows."
  },
  {
    category: "Business",
    headline: "Retailers Adjust Pricing Strategy as Shoppers Pull Back",
    summary:
      "Major retailers are balancing inventory, consumer pressure and margin expectations."
  },
  {
    category: "Health",
    headline: "Hospitals Prepare for a Busy Respiratory Virus Season",
    summary:
      "Health systems are planning staffing, supplies and public-health messaging before winter."
  },
  {
    category: "Sports",
    headline: "Spain Faces Belgium in a High-Stakes International Match",
    summary:
      "The fixture is expected to test two squads with contrasting attacking styles."
  },
  {
    category: "World",
    headline: "Election Officials Prepare Security Plans Ahead of Vote",
    summary:
      "Officials are preparing secure polling operations according to available reports."
  }
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const results = fixtures.map((fixture) => {
  const plan = buildEditorialImagePlan({
    headline: fixture.headline,
    summary: fixture.summary,
    category: fixture.category,
    keywords: [fixture.category, "Daily Signal Wire", "editorial image"]
  });

  assert(plan.prompt.length > 900, `${fixture.category}: prompt is too thin`);
  assert(plan.alt.length > 20, `${fixture.category}: alt text missing`);
  assert(plan.caption.length > 20, `${fixture.category}: caption missing`);
  assert(plan.description.length > 20, `${fixture.category}: description missing`);
  assert(plan.validationNotes.length >= 3, `${fixture.category}: validation notes missing`);
  assert(plan.prompt.includes("No text"), `${fixture.category}: no-text constraint missing`);
  assert(plan.prompt.includes("no watermark"), `${fixture.category}: no-watermark constraint missing`);
  assert(plan.prompt.includes("landscape 16:9"), `${fixture.category}: 16:9 constraint missing`);
  assert(plan.category === fixture.category, `${fixture.category}: category normalization failed`);

  if (fixture.category === "World") {
    assert(plan.illustrative, "World fixture must be illustrative");
    assert(
      plan.prompt.includes("not depict a fabricated real event") ||
        plan.prompt.includes("Do not depict a fabricated real event"),
      "World fixture must include factual safeguard"
    );
  }

  return {
    category: plan.category,
    illustrative: plan.illustrative,
    entities: plan.entities,
    location: plan.location,
    tone: plan.tone,
    alt: plan.alt,
    caption: plan.caption
  };
});

console.log(JSON.stringify({ ok: true, checked: results.length, results }, null, 2));
