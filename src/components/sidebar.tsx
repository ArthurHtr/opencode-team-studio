"use client";

import { Boxes, Cpu, DatabaseBackup, Network, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/team", label: "Team", icon: Network },
  { href: "/team-summary", label: "Team Summary", icon: Users },
  { href: "/resources", label: "Resources", icon: Boxes },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/configuration", label: "Configuration", icon: Settings2 },
  { href: "/backups", label: "Backups", icon: DatabaseBackup },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  return <aside className="sidebar"><div className="brand"><div className="brand-mark"><Network size={19} /></div><div><strong>OpenCode Studio</strong><span>Agent Team Builder</span></div></div><nav className="nav-list">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${isActive(pathname, href) ? "active" : ""}`}><Icon size={17} />{label}</Link>)}</nav><div className="sidebar-note"><span className="status-dot" />Local configuration active<br /><small>OpenCode files are generated automatically.</small></div></aside>;
}
