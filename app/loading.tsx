export default function Loading() {
  return (
    <main className="newsroom-skeleton-page" aria-busy="true" aria-live="polite">
      <section className="newsroom-skeleton-hero" aria-label="Loading top story">
        <div>
          <span className="skeleton-line short" />
          <span className="skeleton-line title" />
          <span className="skeleton-line title small" />
          <span className="skeleton-line" />
          <span className="skeleton-line medium" />
        </div>
        <div className="skeleton-image" />
      </section>
      <section className="newsroom-skeleton-grid" aria-label="Loading story cards">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="skeleton-card" key={index}>
            <span className="skeleton-thumb" />
            <span className="skeleton-line" />
            <span className="skeleton-line medium" />
          </div>
        ))}
      </section>
    </main>
  );
}
