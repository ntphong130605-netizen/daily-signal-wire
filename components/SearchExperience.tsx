"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { newsroomCategories } from "@/lib/categoryLanding";
import { trackEvent } from "@/lib/client/analytics";
import type { SearchFilters, SearchResponse, SearchResult, SearchSuggestion } from "@/lib/searchEngine";

const recentSearchKey = "dsw-recent-searches";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toQueryString(filters: SearchFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "" || value === "any" || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

function formatTime(value: string | null) {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function highlight(text: string, query: string) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return text;
  const pattern = new RegExp(`(${tokens.join("|")})`, "ig");
  return text.split(pattern).map((part, index) =>
    tokens.some((token) => new RegExp(`^${token}$`, "i").test(part)) ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function SearchResultCard({
  result,
  query
}: {
  result: SearchResult;
  query: string;
}) {
  return (
    <article className="search-result-card">
      <Link className="search-result-image" href={`/news/${result.slug}`}>
        {result.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={result.imageUrl} alt={result.imageAlt || result.title} />
        ) : (
          <span>Daily Signal Wire</span>
        )}
      </Link>
      <div className="search-result-body">
        <div className="search-result-meta">
          <Link href={`/category/${result.categorySlug}`}>{result.category}</Link>
          <time dateTime={result.publishedAt || result.createdAt} suppressHydrationWarning>
            {formatTime(result.publishedAt || result.createdAt)}
          </time>
          <span>{result.author}</span>
          <span>{result.readingMinutes} min read</span>
          <span>{result.views === null ? "Public views unavailable" : `${result.views} views`}</span>
        </div>
        <h2>
          <Link href={`/news/${result.slug}`}>{highlight(result.title, query)}</Link>
        </h2>
        <p>{highlight(result.summary || result.excerpt, query)}</p>
        <div className="search-result-tags">
          {result.tags.slice(0, 4).map((tag) => (
            <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
          {result.aiGenerated && <span>AI-assisted</span>}
        </div>
      </div>
    </article>
  );
}

export default function SearchExperience({
  initialResponse,
  initialFilters
}: {
  initialResponse: SearchResponse;
  initialFilters: SearchFilters;
}) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [draftQuery, setDraftQuery] = useState(initialFilters.q || "");
  const [response, setResponse] = useState(initialResponse);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [visibleCount, setVisibleCount] = useState(12);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastTrackedSearchRef = useRef("");

  const allSuggestions = useMemo<SearchSuggestion[]>(() => response.suggestions.slice(0, 10), [response.suggestions]);
  const visibleResults = response.results.slice(0, visibleCount);
  const popularSearches = response.popularSearches.length
    ? response.popularSearches
    : newsroomCategories.map((category) => category.name).slice(0, 8);

  useEffect(() => {
    try {
      setRecentSearches(JSON.parse(window.localStorage.getItem(recentSearchKey) || "[]"));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(current + 10, response.results.length));
      }
    }, { rootMargin: "520px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [response.results.length]);

  function rememberSearch(value: string) {
    const clean = value.trim();
    if (clean.length < 2) return;
    const next = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    window.localStorage.setItem(recentSearchKey, JSON.stringify(next));
  }

  function updateFilters(next: SearchFilters, options: { remember?: boolean } = {}) {
    const normalized = { ...next, q: next.q?.trim() || "" };
    setFilters(normalized);
    setVisibleCount(12);
    if (options.remember && normalized.q) rememberSearch(normalized.q);

    const queryString = toQueryString(normalized);
    window.history.replaceState(null, "", queryString ? `/search?${queryString}` : "/search");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    startTransition(async () => {
      try {
        const result = await fetch(`/api/search?${queryString}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!result.ok) return;
        const data = (await result.json()) as SearchResponse;
        setResponse(data);
        const trackedQuery = normalized.q?.trim() || "";
        if (trackedQuery.length > 1 && trackedQuery !== lastTrackedSearchRef.current) {
          lastTrackedSearchRef.current = trackedQuery;
          trackEvent("search", {
            query: trackedQuery,
            result_count: data.total,
            category: normalized.category || "",
            tag: normalized.tag || ""
          });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          // Keep the previous response visible; search should never blank the page.
        }
      }
    });
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      updateFilters({ ...filters, q: draftQuery });
    }, 260);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    const next = { ...filters, [key]: value };
    updateFilters(next, { remember: key === "q" });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    updateFilters({ ...filters, q: draftQuery }, { remember: true });
    setSuggestionsOpen(false);
  }

  function suggestionKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!allSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((index) => Math.min(index + 1, allSuggestions.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && suggestionsOpen && allSuggestions[activeSuggestion]) {
      event.preventDefault();
      window.location.href = allSuggestions[activeSuggestion].href;
    }
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  return (
    <div className="search-experience">
      <section className="search-hero">
        <p className="search-kicker">Daily Signal Wire Search</p>
        <h1>Search the newsroom by story, topic, category and source signal.</h1>
        <p>
          Find editor-reviewed AI newsroom articles, Google Trends coverage and RSS-informed reporting with typo-tolerant matching.
        </p>
        <form className="search-live-form" role="search" onSubmit={submitSearch}>
          <div
            className="search-live-box"
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-controls="search-suggestions"
            aria-owns="search-suggestions"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={suggestionKeyDown}
              placeholder="Search AI, markets, health, sports…"
              aria-label="Search Daily Signal Wire"
              aria-autocomplete="list"
              aria-controls="search-suggestions"
            />
            <button type="submit">Search</button>
          </div>
          {suggestionsOpen && allSuggestions.length > 0 && (
            <div className="search-suggestions" id="search-suggestions" role="listbox">
              {allSuggestions.map((suggestion, index) => (
                <Link
                  key={`${suggestion.type}-${suggestion.href}-${suggestion.label}`}
                  href={suggestion.href}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  className={cx(index === activeSuggestion && "active")}
                  onMouseEnter={() => setActiveSuggestion(index)}
                >
                  <span>{suggestion.type}</span>
                  <strong>{highlight(suggestion.label, draftQuery)}</strong>
                  {suggestion.meta && <small>{suggestion.meta}</small>}
                </Link>
              ))}
            </div>
          )}
        </form>
      </section>

      <section className="search-quick-links" aria-label="Search discovery shortcuts">
        <div>
          <p className="search-kicker">Recent searches</p>
          <div>
            {(recentSearches.length ? recentSearches : ["AI", "Business", "Technology"]).map((item) => (
              <button key={item} type="button" onClick={() => {
                setDraftQuery(item);
                updateFilters({ ...filters, q: item }, { remember: true });
              }}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="search-kicker">Popular searches</p>
          <div>
            {popularSearches.slice(0, 8).map((item) => (
              <button key={item} type="button" onClick={() => {
                setDraftQuery(item);
                updateFilters({ ...filters, q: item }, { remember: true });
              }}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="search-kicker">Trending topics</p>
          <div>
            {response.trendingTopics.slice(0, 8).map((item) => (
              <button key={item} type="button" onClick={() => {
                setDraftQuery(item);
                updateFilters({ ...filters, q: item }, { remember: true });
              }}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="search-mobile-actions">
        <button type="button" onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? "Hide filters" : "Filter results"}
        </button>
      </div>

      <div className="search-layout">
        <aside className={cx("search-filters", filtersOpen && "open")} aria-label="Search filters">
          <div className="search-filter-heading">
            <p className="search-kicker">Filters</p>
            <button type="button" onClick={() => {
              const reset = { q: filters.q || "" };
              setDraftQuery(filters.q || "");
              updateFilters(reset);
            }}>
              Reset
            </button>
          </div>
          <label>
            Category
            <select value={filters.category || ""} onChange={(event) => setFilter("category", event.target.value)}>
              <option value="">All categories</option>
              {response.facets.categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label} ({category.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select value={filters.tag || ""} onChange={(event) => setFilter("tag", event.target.value)}>
              <option value="">All tags</option>
              {response.facets.tags.map((tag) => (
                <option key={tag.value} value={tag.value}>
                  {tag.label} ({tag.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <select value={filters.date || "any"} onChange={(event) => setFilter("date", event.target.value as SearchFilters["date"])}>
              <option value="any">Any time</option>
              <option value="24h">Past 24 hours</option>
              <option value="7d">Past 7 days</option>
              <option value="30d">Past 30 days</option>
              <option value="year">Past year</option>
            </select>
          </label>
          <label>
            Author
            <select value={filters.author || ""} onChange={(event) => setFilter("author", event.target.value)}>
              <option value="">All authors</option>
              {response.facets.authors.map((author) => (
                <option key={author.value} value={author.value}>
                  {author.label} ({author.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            Reading time
            <select
              value={filters.readingTime || "any"}
              onChange={(event) => setFilter("readingTime", event.target.value as SearchFilters["readingTime"])}
            >
              <option value="any">Any length</option>
              <option value="under-3">Under 3 minutes</option>
              <option value="3-5">3–5 minutes</option>
              <option value="5-10">5–10 minutes</option>
              <option value="10-plus">10+ minutes</option>
            </select>
          </label>
          <label className="search-checkbox">
            <input
              type="checkbox"
              checked={Boolean(filters.trending)}
              onChange={(event) => setFilter("trending", event.target.checked)}
            />
            Trending only
          </label>
          <label className="search-checkbox">
            <input
              type="checkbox"
              checked={Boolean(filters.ai)}
              onChange={(event) => setFilter("ai", event.target.checked)}
            />
            AI-generated articles
          </label>
        </aside>

        <main className="search-results-panel" aria-live="polite" aria-busy={isPending}>
          <div className="search-results-heading">
            <div>
              <p className="search-kicker">{isPending ? "Searching…" : "Search results"}</p>
              <h2>
                {response.query
                  ? `${response.total} results for “${response.query}”`
                  : `${response.total} latest newsroom results`}
              </h2>
            </div>
            <span>Fuzzy + partial matching</span>
          </div>

          {visibleResults.length ? (
            <div className="search-results-list">
              {visibleResults.map((result) => (
                <SearchResultCard key={result.id} result={result} query={response.query} />
              ))}
              <div ref={sentinelRef} className="search-scroll-sentinel">
                {visibleCount < response.results.length ? "Loading more results…" : "End of results"}
              </div>
            </div>
          ) : (
            <section className="search-empty-state">
              <div className="empty-signal">
                <span />
                <span />
                <span />
              </div>
              <h2>No results found.</h2>
              <p>Try a broader term, remove filters, or explore trending topics below.</p>
              <div className="search-empty-links">
                {popularSearches.slice(0, 8).map((item) => (
                  <button key={item} type="button" onClick={() => {
                    setDraftQuery(item);
                    updateFilters({ q: item }, { remember: true });
                  }}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="search-popular-categories">
                {newsroomCategories.slice(0, 8).map((category) => (
                  <Link key={category.slug} href={`/category/${category.slug}`}>
                    {category.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="search-related-panel">
          <section>
            <p className="search-kicker">Related searches</p>
            <div className="search-related-links">
              {response.relatedSearches.map((item) => (
                <button key={item} type="button" onClick={() => {
                  setDraftQuery(item);
                  updateFilters({ ...filters, q: item }, { remember: true });
                }}>
                  {item}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="search-kicker">Categories</p>
            <div className="search-related-links">
              {newsroomCategories.slice(0, 12).map((category) => (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
