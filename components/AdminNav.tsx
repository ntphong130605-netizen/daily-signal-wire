"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", icon: "◫", label: "Dashboard" },
  { href: "/admin/feeds", icon: "☷", label: "Feeds" },
  { href: "/admin/stories", icon: "☰", label: "Stories" },
  { href: "/admin/research", icon: "◎", label: "Research" },
  { href: "/admin/test-batch", icon: "10", label: "Test Batch" },
  { href: "/admin/writer", icon: "✍", label: "AI Writer" },
  { href: "/admin/fact-checker", icon: "✓", label: "Fact Checker" },
  { href: "/admin/image-studio", icon: "▣", label: "Image Studio" },
  { href: "/admin/publishing", icon: "⏱", label: "Publishing" },
  { href: "/admin/growth", icon: "◆", label: "Growth" },
  { href: "/admin/planner", icon: "▦", label: "Planner" },
  { href: "/admin/distribution", icon: "⇄", label: "Distribution" },
  { href: "/admin/social", icon: "◌", label: "Social" },
  { href: "/admin/seo", icon: "⌁", label: "SEO" },
  { href: "/admin/discover", icon: "◉", label: "Discover" },
  { href: "/admin/revenue", icon: "$", label: "Revenue" },
  { href: "/admin/ads", icon: "▤", label: "Ad Manager" },
  { href: "/admin/affiliate", icon: "↗", label: "Affiliate" },
  { href: "/admin/ab-testing", icon: "A/B", label: "A/B Testing" },
  { href: "/admin/heatmap", icon: "◎", label: "Heatmap" },
  { href: "/admin/analytics", icon: "▥", label: "Analytics" },
  { href: "/admin/indexing", icon: "⌕", label: "Indexing" },
  { href: "/admin/monitoring", icon: "●", label: "Monitoring" },
  { href: "/admin/system", icon: "◈", label: "System" },
  { href: "/admin/checklist", icon: "☑", label: "Checklist" },
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
