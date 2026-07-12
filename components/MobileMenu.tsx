import Link from "next/link";

export type MobileMenuLink = {
  label: string;
  href: string;
};

export default function MobileMenu({ links }: { links: MobileMenuLink[] }) {
  return (
    <details className="news-home-mobile-menu">
      <summary aria-label="Open navigation menu">
        <span />
        <span />
        <span />
      </summary>
      <nav aria-label="Mobile navigation">
        {links.map((link) => (
          <Link key={link.label} href={link.href}>
            {link.label}
          </Link>
        ))}
        <Link href="/admin">Admin</Link>
      </nav>
    </details>
  );
}
