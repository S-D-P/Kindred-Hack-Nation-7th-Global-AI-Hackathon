"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KindredMark } from "@/components/Mark";
import { BlockView, Drawer, type Ctx } from "@/components/Blocks";
import type { AskResponse, ChatContext, EdgeView } from "@/lib/types";

type Turn = { role: "user"; text: string } | { role: "kindred"; res: AskResponse };

const SUGGESTIONS = ["Who shares our biology?", "What could we reuse?", "What should we investigate next?"];

function Composer({ onSend, busy, autoFocus }: { onSend: (t: string) => void; busy: boolean; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask about a disease, gene, mechanism or research asset"
        aria-label="Ask Kindred"
        autoFocus={autoFocus}
      />
      <button className="send" type="submit" disabled={!text.trim() || busy} aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [context, setContext] = useState<ChatContext>({});
  const [edges, setEdges] = useState<Record<string, EdgeView>>({});
  const [openEdge, setOpenEdge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingIntent = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(text: string, display?: string) {
    // "Who shares our biology?" before a disease is chosen: remember the question,
    // and replay it once the user picks their disease.
    let message = text;
    if (pendingIntent.current && !context.focal) {
      message = `${text.split(": ")[0]}: ${pendingIntent.current}`;
    }
    setTurns((t) => [...t, { role: "user", text: display ?? text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
      });
      const data = (await res.json()) as AskResponse;
      const needsDisease = data.blocks.some((b) => b.type === "choices" && b.prompt === "Which disease is yours?");
      pendingIntent.current = needsDisease ? text : null;
      setEdges((e) => ({ ...e, ...data.edges }));
      setContext(data.context);
      setTurns((t) => [...t, { role: "kindred", res: data }]);
    } catch {
      setTurns((t) => [...t, { role: "kindred", res: { blocks: [{ type: "finding", text: "Something went wrong reaching Kindred. Try again." }], edges: {}, context, intent: { intent: "error", by: "rules" } } }]);
    } finally {
      setBusy(false);
    }
  }

  const ctx: Ctx = { edges, openEdge: setOpenEdge, ask };
  const reset = () => { setTurns([]); setContext({}); setOpenEdge(null); pendingIntent.current = null; };

  if (!turns.length) {
    return (
      <main className="home">
        <KindredMark />
        <h1 className="wordmark">Kindred</h1>
        <p className="tagline">Find the connection.<br />Check the difference.</p>
        <p className="hook">What if the disease that looks most like yours isn&apos;t the disease most worth learning from?</p>
        <Composer onSend={ask} busy={busy} autoFocus />
        <div className="suggestions">
          {SUGGESTIONS.map((s) => <button key={s} className="suggestion" onClick={() => ask(s)}>{s}</button>)}
        </div>
        <section className="why">
          <p>Rare diseases don&apos;t exist in isolation. A mechanism discovered in one disease may matter to another. A study built for one population may create useful infrastructure for another. And a disease that looks similar may have completely different biology.</p>
          <p>Kindred helps researchers and patient communities navigate those connections without hiding the uncertainty.</p>
          <nav className="why-links">
            <Link href="/story">The idea that inspired Kindred</Link>
            <Link href="/how">How Kindred knows what it knows</Link>
          </nav>
        </section>
        <p className="home-foot">A research-planning aid for rare-disease communities. Not diagnosis or treatment advice.</p>
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={reset}>Kindred</button>
        <button className="ghost" onClick={reset}>New question</button>
      </header>
      <main className="thread">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="user-msg"><span>{t.text}</span></div>
          ) : (
            <div key={i} className="answer">
              {t.res.blocks.map((b, j) => <BlockView key={j} b={b} ctx={ctx} />)}
            </div>
          ),
        )}
        {busy && <div className="thinking"><span className="dot" /> Tracing evidence…</div>}
        <div ref={bottom} />
      </main>
      <div className="dock">
        <Composer onSend={ask} busy={busy} />
        <div className="note">Every claim links to its source. Resemblance is not evidence that a treatment would work.</div>
      </div>
      {openEdge && edges[openEdge] && <Drawer e={edges[openEdge]} onClose={() => setOpenEdge(null)} ctx={ctx} />}
    </>
  );
}
