export default function SearchBar({
  defaultValue = "",
  compact = false
}: {
  defaultValue?: string;
  compact?: boolean;
}) {
  return (
    <form
      className={`site-search${compact ? " site-search-compact" : ""}`}
      action="/"
      method="get"
      role="search"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search stories"
        aria-label="Search stories"
      />
    </form>
  );
}
