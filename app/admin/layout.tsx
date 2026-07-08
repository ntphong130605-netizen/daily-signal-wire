import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/login");

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Logo href="/admin" inverse compact />
        <AdminNav />
        <div className="sidebar-note">
          <span className="live-dot" />
          Cron-ready newsroom
        </div>
        <LogoutButton />
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
