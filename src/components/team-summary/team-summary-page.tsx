"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateTeamSummary } from "@/lib/team/summary";
import type { TeamSnapshot } from "@/lib/types";

type ViewMode = "preview" | "markdown";

const SUMMARY_API = "/api/team";

export function TeamSummaryPage() {
  const [summary, setSummary] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SUMMARY_API);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Error ${res.status}`);
      }
      const data: TeamSnapshot = await res.json();
      setSummary(generateTeamSummary(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setSummary("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(SUMMARY_API);
        if (cancelled || !res.ok) {
          if (cancelled) return;
          const body = await res.text();
          throw new Error(body || `Error ${res.status}`);
        }
        const data: TeamSnapshot = await res.json();
        if (cancelled) return;
        setSummary(generateTeamSummary(data));
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setSummary("");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  }, [summary]);

  return (
    <div className="content-page team-summary-page">
      <header className="team-summary-header">
        <h1>Team Summary</h1>
      </header>

      <section className="team-summary-explanation">
        <p>
          This summary is automatically generated from the OpenCode configuration
          currently read from your disk.
        </p>
        <p>
          You can copy it into your global <code>AGENTS.md</code> file to provide OpenCode
          with a concise overview of your team: agents, sub-agents, roles,
          delegations, skills, and MCP servers.
        </p>
        <p>
          Studio does not modify <code>AGENTS.md</code> automatically. After a significant
          team change, regenerate this summary and copy the new version
          into your <code>AGENTS.md</code> file.
        </p>
        <p className="team-summary-path">
          Target path: <code>$OPENCODE_CONFIG_DIR/AGENTS.md</code>
        </p>
      </section>

      <article className="team-summary-card">
        <header className="team-summary-card-header">
          <div className="team-summary-tabs">
            <button
              className={`tab-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
              type="button"
            >
              Preview
            </button>
            <button
              className={`tab-btn ${viewMode === "markdown" ? "active" : ""}`}
              onClick={() => setViewMode("markdown")}
              type="button"
            >
              Markdown
            </button>
          </div>

          <div className="team-summary-actions">
            <button
              className="button"
              onClick={fetchSummary}
              type="button"
              disabled={loading}
            >
              {loading ? "Generating summary..." : "Regenerate"}
            </button>
            <button
              className="button"
              onClick={handleCopy}
              type="button"
              disabled={loading || !summary}
            >
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          </div>
        </header>

        <div className="team-summary-body">
          {loading && !summary && (
            <div className="team-summary-loading">
              <div className="spinner" />
              <span>Loading summary...</span>
            </div>
          )}

          {error && (
            <div className="team-summary-error">
              <span>Error reading configuration: {error}</span>
              <button
                className="button subtle"
                onClick={fetchSummary}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && summary && (
            <>
              {viewMode === "preview" && (
                <div className="team-summary-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
              )}
              {viewMode === "markdown" && (
                <pre className="team-summary-markdown">{summary}</pre>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList: "ul" | "ol" | false = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "") {
      if (inList) {
        html += inList === "ul" ? "</ul>" : "</ol>";
        inList = false;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) { html += inList === "ul" ? "</ul>" : "</ol>"; inList = false; }
      html += `<h2>${inlineCode(line.slice(3))}</h2>`;
    } else if (line.startsWith("### ")) {
      if (inList) { html += inList === "ul" ? "</ul>" : "</ol>"; inList = false; }
      html += `<h3>${inlineCode(line.slice(4))}</h3>`;
    } else if (line.startsWith("> ")) {
      if (inList) { html += inList === "ul" ? "</ul>" : "</ol>"; inList = false; }
      html += `<blockquote>${inlineCode(line.slice(2))}</blockquote>`;
    } else if (/^- /.test(line)) {
      if (!inList) { html += "<ul>"; inList = "ul"; }
      const content = line.slice(2);
      html += `<li>${inlineCode(content)}</li>`;
    } else {
      if (inList) { html += inList === "ul" ? "</ul>" : "</ol>"; inList = false; }
      html += `<p>${inlineCode(line)}</p>`;
    }
  }

  if (inList) { html += inList === "ul" ? "</ul>" : "</ol>"; }

  return html;
}

function inlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, "<code>$1</code>");
}
