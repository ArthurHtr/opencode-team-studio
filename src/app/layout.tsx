import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = { title: "OpenCode Team Studio", description: "Visual agent team builder for OpenCode" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body><div className="app-shell"><Sidebar /><main className="main-content">{children}</main></div></body></html>;
}
