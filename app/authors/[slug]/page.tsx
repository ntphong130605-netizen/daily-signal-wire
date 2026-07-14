import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReaderShell from "@/components/ReaderShell";
import {
  authorBySlug,
  authorUrl,
  newsroomAuthors,
  newsroomPolicies,
  personJsonLd
} from "@/lib/eeat";
import { absoluteUrl, siteName } from "@/lib/site";

export function generateStaticParams() {
  return newsroomAuthors.map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = authorBySlug(slug);
  if (!author) return {};

  return {
    title: `${author.name} | Author`,
    description: author.bio,
    alternates: {
      canonical: authorUrl(author)
    },
    openGraph: {
      title: `${author.name} | ${siteName}`,
      description: author.bio,
      url: authorUrl(author),
      type: "profile"
    }
  };
}

export default async function AuthorPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = authorBySlug(slug);
  if (!author) notFound();

  const jsonLd = personJsonLd(author);

  return (
    <ReaderShell>
      <main className="static-page-shell">
        <nav className="article-breadcrumb premium-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/editorial-team">Editorial team</Link>
          <span>/</span>
          <span aria-current="page">{author.name}</span>
        </nav>

        <section className="author-profile-hero">
          <div className="author-card-avatar author-profile-avatar" aria-hidden="true">
            {author.initials}
          </div>
          <div>
            <p className="section-kicker">{author.role}</p>
            <h1>{author.name}</h1>
            <p>{author.bio}</p>
          </div>
        </section>

        <section className="static-page-card">
          <article>
            <h2>Expertise</h2>
            <p>
              This profile represents the accountable newsroom desk for the work credited to this
              byline. Daily Signal Wire uses desks for source review and standards enforcement when
              individual reporter profiles are not yet configured.
            </p>
            <ul className="static-page-list">
              {author.expertise.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </article>
          <article>
            <h2>Editorial safeguards</h2>
            <p>
              Drafts credited to this desk are expected to include reviewable source URLs,
              fact-check notes, image disclosures and editor approval before publication.
            </p>
            <div className="policy-link-grid" aria-label="Editorial policy links">
              <Link href="/editorial-policy">Editorial policy</Link>
              <Link href="/fact-check-policy">Fact-check policy</Link>
              <Link href="/corrections-policy">Corrections policy</Link>
              <Link href="/ai-transparency">AI transparency</Link>
            </div>
          </article>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              ...jsonLd,
              mainEntityOfPage: absoluteUrl(`/authors/${author.slug}`),
              publishingPrinciples: newsroomPolicies.editorial
            })
          }}
        />
      </main>
    </ReaderShell>
  );
}
