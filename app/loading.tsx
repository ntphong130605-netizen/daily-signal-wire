export default function Loading() {
  return (
    <main className="newsroom-skeleton-page">
      <section className="newsroom-skeleton-hero">
        <div>
          <span className="skeleton-line short" />
          <span className="skeleton-line title" />
          <span className="skeleton-line title small" />
          <span className="skeleton-line" />
          <span className="skeleton-line medium" />
        </div>
        <div className="skeleton-image" />
      </section>
      <section className="newsroom-skeleton-grid">
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
