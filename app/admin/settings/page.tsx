import Link from "next/link";
import {
  adsenseClientId,
  adsensePublisherId,
  adsenseSlotFor,
  hasAdsTxtConfiguration,
  maskPublicId
} from "@/lib/ads";
import { configuredImageStorageLabel } from "@/lib/aiImage";
import { channelConfigured, distributionPlatforms } from "@/lib/growth";
import { isDatabaseConfigured, prisma, safeDbQuery } from "@/lib/prisma";
import { socialReadiness } from "@/lib/socialDistribution";

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

  const adsenseChecks = [
    ["Client ID configured", adsenseClientId()],
    ["Top slot configured", adsenseSlotFor("top")],
    ["In-article slot configured", adsenseSlotFor("in-article")],
    ["Sidebar slot configured", adsenseSlotFor("sidebar")],
    ["Bottom slot configured", adsenseSlotFor("bottom")],
    ["ads.txt configured", hasAdsTxtConfiguration() ? adsensePublisherId() : ""],
    ["Cookie consent enabled", "enabled"]
  ] as const;

  const settings = [
    ["Database", isDatabaseConfigured() ? "Configured" : "Missing DATABASE_URL"],
    ["OpenAI", flag(process.env.OPENAI_API_KEY)],
    ["AI model", process.env.AI_MODEL || "Default model fallback"],
    ["Image model", process.env.IMAGE_MODEL || "Default image model fallback"],
    ["Image storage", configuredImageStorageLabel()],
    ["Site URL", process.env.NEXT_PUBLIC_SITE_URL || "Default Vercel URL fallback"],
    [
      "AdSense client",
      adsenseClientId() ? maskPublicId(adsenseClientId()) : "Not configured"
    ],
    [
      "Google Analytics",
      flag(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
    ],
    [
      "Google Search Console",
      flag(process.env.NEXT_PUBLIC_GSC_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION)
    ],
    ["GTM", flag(process.env.NEXT_PUBLIC_GTM_ID)],
    ["Microsoft Clarity", flag(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID)],
    ["AdSense estimate RPM", flag(process.env.ADSENSE_ESTIMATED_RPM)],
    ["Editorial timezone", process.env.EDITORIAL_TIMEZONE || "America/New_York"],
    ["Cron secret", flag(process.env.CRON_SECRET)],
    ["NextAuth secret", flag(process.env.NEXTAUTH_SECRET)]
  ];
  const socialChannels = socialReadiness();

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
                <div>
                  <p className="eyebrow">Google AdSense</p>
                  <h2>Ad configuration</h2>
                </div>
              </div>
              <div className="settings-list compact adsense-status-list">
                {adsenseChecks.map(([name, value]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong className={value ? "configured" : "missing"}>
                      {value ? "Configured" : "Not configured"}
                    </strong>
                    {value && value !== "enabled" && (
                      <small>{maskPublicId(value)}</small>
                    )}
                  </div>
                ))}
              </div>
              <div className="settings-actions">
                <Link className="button button-secondary" href="/?previewAds=1">
                  Preview Ad Placements
                </Link>
                <Link className="button button-secondary" href="/api/health" target="_blank">
                  Validate Configuration
                </Link>
              </div>
              <p className="settings-help-text">
                No revenue data is estimated here. Use Google AdSense reports after
                account approval and never click your own ads for testing.
              </p>
            </section>
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Ad slots</h2>
              </div>
              <div className="settings-list compact">
                {adSlots.map((slot) => (
                  <div key={slot.id}>
                    <span>{slot.label}</span>
                    <strong>{slot.enabled ? "Enabled" : "Hidden"}</strong>
                    <small>{slot.slotId || "Dev placeholder: Advertisement"}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Growth channels</h2>
              </div>
              <div className="settings-list compact">
                {distributionPlatforms.map((channel) => (
                  <div key={channel.platform}>
                    <span>{channel.label}</span>
                    <strong
                      className={channelConfigured(channel.platform) ? "configured" : "missing"}
                    >
                      {channelConfigured(channel.platform)
                        ? "Configured"
                        : "Missing credentials"}
                    </strong>
                    <small>
                      {channel.credentialKeys.length === 0
                        ? "No credentials required"
                        : channel.credentialKeys.join(", ")}
                    </small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Social distribution</h2>
              </div>
              <div className="settings-list compact">
                {socialChannels.map((channel) => (
                  <div key={channel.platform}>
                    <span>{channel.label}</span>
                    <strong className={channel.configured ? "configured" : "missing"}>
                      {channel.configured ? "Configured" : "Waiting for credentials"}
                    </strong>
                    <small>
                      {channel.configured ? "Ready to publish" : channel.missing.join(", ")}
                    </small>
                  </div>
                ))}
              </div>
              <div className="settings-actions">
                <Link className="button button-secondary" href="/admin/social">
                  Open Social Queue
                </Link>
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
                StoryTag, Category, AdSlot, GeneratedImage, SiteSetting, Post and
                Trend models. NextAuth environment fields are ready for production
                integration.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
