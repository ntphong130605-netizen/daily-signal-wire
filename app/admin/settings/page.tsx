import { isDatabaseConfigured, prisma, safeDbQuery } from "@/lib/prisma";

function flag(value: string | undefined) {
  return value ? "Configured" : "Not configured";
}

export default async function AdminSettingsPage() {
  const { adSlots, feedCount, storyCount } = await safeDbQuery(
    "admin_settings_query_failed",
    { adSlots: [], feedCount: 0, storyCount: 0 },
    async () => {
      const [adSlots, feedCount, storyCount] = await Promise.all([
        prisma.adSlot.findMany({ orderBy: { placement: "asc" } }),
        prisma.feed.count(),
        prisma.feedStory.count()
      ]);

      return { adSlots, feedCount, storyCount };
    }
  );

  const settings = [
    ["Database", isDatabaseConfigured() ? "Configured" : "Missing DATABASE_URL"],
    ["OpenAI", flag(process.env.OPENAI_API_KEY)],
    ["AI model", process.env.AI_MODEL || "Default model fallback"],
    ["Site URL", process.env.NEXT_PUBLIC_SITE_URL || "Default Vercel URL fallback"],
    [
      "AdSense client",
      flag(
        process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
          process.env.NEXT_PUBLIC_ADSENSE_CLIENT
      )
    ],
    ["Google Analytics", flag(process.env.GOOGLE_ANALYTICS_ID)],
    ["Cron secret", flag(process.env.CRON_SECRET)],
    ["NextAuth secret", flag(process.env.NEXTAUTH_SECRET)]
  ];

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Settings</h1>
          <p>Environment status, reader inventory and advertising placeholders.</p>
        </div>
        <div className="header-badge">{feedCount} feeds · {storyCount} stories</div>
      </header>
      <main className="admin-content admin-reader-content">
        <div className="admin-two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Runtime</p>
                <h2>Environment checks</h2>
              </div>
              <span className="source-pill">No secrets are printed</span>
            </div>
            <div className="settings-list">
              {settings.map(([name, value]) => (
                <div key={name}>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <aside className="admin-side-stack">
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Ad slots</h2>
              </div>
              <div className="settings-list compact">
                {adSlots.map((slot) => (
                  <div key={slot.id}>
                    <span>{slot.label}</span>
                    <strong>{slot.enabled ? "Enabled" : "Hidden"}</strong>
                    <small>{slot.slotId || "Dev placeholder: Ad Slot"}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel admin-form-panel settings-note">
              <h2>Editorial guardrails</h2>
              <p>
                RSS stories remain source metadata. AI conversion creates drafts only,
                stores source URLs and fact-check notes, and never publishes without admin
                approval.
              </p>
              <p>
                The schema includes User, Feed, FeedFolder, FeedStory, SavedStory,
                StoryTag, Category, AdSlot, Post and Trend models. NextAuth environment
                fields are ready for production integration.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
