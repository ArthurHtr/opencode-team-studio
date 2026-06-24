"use client";

import { Boxes, Cpu, DatabaseBackup, Network, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/team", label: "Équipe", icon: Network },
  { href: "/resources", label: "Ressources", icon: Boxes },
  { href: "/models", label: "Modèles", icon: Cpu },
  { href: "/configuration", label: "Configuration", icon: Settings2 },
  { href: "/backups", label: "Sauvegardes", icon: DatabaseBackup },
];

export function Sidebar() {
  const pathname = usePathname();
  return <aside className="sidebar"><div className="brand"><div className="brand-mark"><Network size={19} /></div><div><strong>OpenCode Team Studio</strong><span>Agent Team Builder</span></div></div><nav className="nav-list">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}><Icon size={17} />{label}</Link>)}</nav><div className="sidebar-note"><span className="status-dot" />Configuration locale active<br /><small>Les fichiers OpenCode sont générés automatiquement.</small></div></aside>;
}
