"use client";

import { ArrowRight, Bot, Cpu, FileText, Plus } from "lucide-react";
import Link from "next/link";

export function EmptyConfigWelcome() {
  return (
    <div className="content-page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(145deg, #9b73ff, #6336cd)",
              color: "#fff",
            }}
          >
            <Bot size={32} />
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>
            Bienvenue dans OpenCode Team Studio
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
            Aucune configuration OpenCode personnalisée n&apos;a été détectée.
            <br />
            Vous pouvez créer votre premier agent ou configurer un modèle.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            textAlign: "left",
          }}
        >
          <WelcomeCard
            icon={<Plus size={18} />}
            title="Créer un agent"
            description="Ajoute un agent personnalisé avec un prompt et des permissions."
            href="/team"
          />
          <WelcomeCard
            icon={<Cpu size={18} />}
            title="Configurer un modèle"
            description="Ajoute un provider et déclare des modèles."
            href="/models"
          />
          <WelcomeCard
            icon={<FileText size={18} />}
            title="Guide d&apos;installation"
            description="Consulte la documentation pour configurer OpenCode."
            href="https://github.com/ArthurHtr/opencode-team-studio"
            external
          />
        </div>

        <div
          className="inline-message"
          style={{
            marginTop: 24,
            color: "var(--muted)",
            border: "1px solid var(--border)",
            background: "transparent",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 11 }}>
            L&apos;authentification des providers reste gérée par OpenCode.
            Exécute <code>/connect</code> dans OpenCode pour authentifier un provider.
          </span>
        </div>
      </div>
    </div>
  );
}

function WelcomeCard({
  icon,
  title,
  description,
  href,
  external,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const target = external ? "_blank" : undefined;
  const rel = external ? "noopener noreferrer" : undefined;

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      style={{
        display: "block",
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--panel)",
        transition: "border-color .15s, transform .15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border-strong)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border)";
        el.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          background: "#1c2030",
          color: "var(--blue)",
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
        {title}
      </strong>
      <p
        style={{
          margin: 0,
          color: "var(--muted)",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      <div
        style={{
          marginTop: 8,
          color: "var(--accent-soft)",
          fontSize: 10,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Commencer <ArrowRight size={12} />
      </div>
    </Link>
  );
}
