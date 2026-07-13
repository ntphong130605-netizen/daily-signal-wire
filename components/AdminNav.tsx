"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", icon: "◫", label: "Dashboard" },
  { href: "/admin/feeds", icon: "☷", label: "Feeds" },
  { href: "/admin/stories", icon: "☰", label: "Stories" },
  { href: "/admin/research", icon: "◎", label: "Research" },
  { href: "/admin/writer", icon: "✍", label: "AI Writer" },
  { href: "/admin/trends", icon: "↗", label: "US trends" },
  { href: "/admin/posts", icon: "✦", label: "Posts" },
  { href: "/admin/settings", icon: "⚙", label: "Settings" }
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="side-nav">
      {links.map((link) => {
        const active =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link className={`side-link ${active ? "active" : ""}`} href={link.href} key={link.href}>
            <span>{link.icon}</span> {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
