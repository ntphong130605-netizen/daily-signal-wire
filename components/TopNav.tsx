import Link from "next/link";
import SearchBar from "@/components/SearchBar";

const links = [
  { label: "Trending", href: "/?sort=trending" },
  { label: "Latest", href: "/?sort=latest" },
  { label: "Video", href: "/?topic=video" },
  { label: "Topics", href: "/?topic=topics" },
  { label: "US News", href: "/?topic=US%20News" },
  { label: "Sports", href: "/?topic=Sports" },
  { label: "Tech", href: "/?topic=Technology" },
  { label: "Money", href: "/?topic=Money" },
  { label: "Entertainment", href: "/?topic=Entertainment" }
];

export default function TopNav({
  searchValue = ""
}: {
  searchValue?: string;
}) {
  return (
    <nav className="top-nav" aria-label="Primary navigation">
      <div className="top-nav-inner">
        <div className="top-nav-scroll">
          {links.map((link) => (
            <Link key={link.label} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <SearchBar defaultValue={searchValue} compact />
      </div>
    </nav>
  );
}
