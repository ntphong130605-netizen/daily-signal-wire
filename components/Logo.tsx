import Link from "next/link";

export default function Logo({
  href = "/",
  inverse = false,
  compact = false
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`site-logo${inverse ? " site-logo-inverse" : ""}${
        compact ? " site-logo-compact" : ""
      }`}
      aria-label="Daily Signal Wire home"
    >
      <svg
        className="site-logo-icon"
        viewBox="0 0 48 48"
        role="img"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="13" fill="currentColor" />
        <path
          d="M9.5 25h6l3.3-8.2 5.7 16.3 4.5-11.2 2.6 6.1h6.9"
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M34.2 14.5c2.6 1.6 4.3 4.4 4.3 7.5M36.8 9.8c4.3 2.6 7.2 7.4 7.2 12.7"
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
      <span className="site-logo-copy">
        <strong>Daily Signal</strong>
        <span>Wire</span>
      </span>
    </Link>
  );
}
