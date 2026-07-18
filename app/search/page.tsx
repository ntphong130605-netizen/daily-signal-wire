import type { Metadata } from "next";
import ReaderShell from "@/components/ReaderShell";
import SearchExperience from "@/components/SearchExperience";
import AdSlot from "@/components/ads/AdSlot";
import { filtersFromRecord, runSearch } from "@/lib/searchServer";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromRecord(params);
  const query = filters.q?.trim() || "";
  const canonical = query
    ? absoluteUrl(`/search?q=${encodeURIComponent(query)}`)
    : absoluteUrl("/search");
  const title = query ? `Search results for ${query}` : "Search Daily Signal Wire";
  const description = query
    ? `Search Daily Signal Wire coverage for ${query}, including source-first reporting, categories, tags and AI-assisted newsroom articles.`
    : "Search Daily Signal Wire for source-first news, Google Trends coverage, RSS-informed reporting and editor-reviewed AI newsroom articles.";

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url: canonical,
      siteName,
      type: "website",
      images: [
        {
          url: absoluteUrl("/editorial/ai/newsroom.jpg"),
          width: 1600,
          height: 900,
          alt: "Daily Signal Wire search"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description,
      images: [absoluteUrl("/editorial/ai/newsroom.jpg")]
    },
    robots: {
      index: Boolean(query),
      follow: true,
      googleBot: {
        index: Boolean(query),
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = filtersFromRecord(params);
  const response = await runSearch(filters);
  const query = filters.q?.trim() || "";
  const searchJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      name: query ? `Search results for ${query}` : "Daily Signal Wire Search",
      url: query ? absoluteUrl(`/search?q=${encodeURIComponent(query)}`) : absoluteUrl("/search"),
      description: siteDescription(),
      isPartOf: {
        "@type": "WebSite",
        name: siteName,
        url: absoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl("/search")}?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: query ? `Search results for ${query}` : "Latest searchable coverage",
      itemListElement: response.results.slice(0, 12).map((result, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/news/${result.slug}`),
        name: result.title
      }))
    }
  ];

  return (
    <ReaderShell searchValue={query}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(searchJsonLd) }}
      />
      <AdSlot position="search" className="search-page-ad" />
      <SearchExperience initialResponse={response} initialFilters={filters} />
    </ReaderShell>
  );
}
