import Link from "next/link";
import Logo from "@/components/Logo";

function Icon({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button className="header-icon" aria-label={label} type="button">
      {children}
    </button>
  );
}

export default function Header() {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  return (
    <header className="reader-header">
      <div className="reader-header-inner">
        <div className="reader-date">
          <strong>{date}</strong>
          <span>New York · 72°F</span>
        </div>
        <Logo />
        <div className="reader-tools">
          <Link className="reader-admin-link" href="/admin">
            Newsroom
          </Link>
          <Icon label="User account">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
            </svg>
          </Icon>
          <Icon label="Open menu">
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </Icon>
        </div>
      </div>
    </header>
  );
}
