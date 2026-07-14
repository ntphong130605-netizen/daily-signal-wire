import type { Metadata } from "next";
import Link from "next/link";
import ReaderShell from "@/components/ReaderShell";
import { newsroomAuthors, personJsonLd } from "@/lib/eeat";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Editorial Team",
  description:
    "Meet the Daily Signal Wire editorial desks responsible for source review, corrections, AI transparency and newsroom standards.",
  alternates: {
    canonical: absoluteUrl("/editorial-team")
  },
  openGraph: {
    title: `Editorial Team | ${siteName}`,
    description:
      "Daily Signal Wire editorial desks responsible for source review, corrections, AI transparency and newsroom standards.",
    url: absoluteUrl("/editorial-team"),
    type: "website"
  }
};

export default function EditorialTeamPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": newsroomAuthors.map((author) => personJsonLd(author))
  };

  return (
    <ReaderShell>
      <main className="static-page-shell">
        <section className="static-page-hero">
          <p className="section-kicker">Newsroom identity</p>
          <h1>Editorial team</h1>
          <p>
            Daily Signal Wire is organized around accountable desks, transparent sourcing and
            human editorial approval for AI-assisted drafts.
          </p>
        </section>

        <section className="editorial-team-grid" aria-label="Editorial team profiles">
          {newsroomAuthors.map((author) => (
            <article className="editorial-team-card" key={author.slug}>
              <div className="author-card-avatar" aria-hidden="true">
                {author.initials}
              </div>
              <div>
                <p className="section-kicker">{author.role}</p>
                <h2>{author.name}</h2>
                <p>{author.bio}</p>
                <div className="article-tags" aria-label={`${author.name} expertise`}>
                  {author.expertise.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
                <Link href={`/authors/${author.slug}`} className="source-pill">
                  View profile →
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="static-page-card">
          <article>
            <h2>How accountability works</h2>
            <p>
              Articles identify the authoring desk, publication dates, source review notes and
              image disclosures. Editors can update stories, add corrections and reject AI drafts
              that do not meet sourcing or clarity standards.
            </p>
          </article>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>
    </ReaderShell>
  );
}
