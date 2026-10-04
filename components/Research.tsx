"use client";

import type { AssetGroup, BriefRow, Discovery, Dossier, ExpertQuestion, Kinship, MatrixRow, Story, TreeBranch } from "@/lib/types";
import { Cites, type Ctx } from "./Blocks";

export const KIN_LABEL: Record<Kinship, string> = {
  RELATIVE: "Mechanistic relative",
  LOOK_ALIKE: "Phenotypic look-alike",
  DISTANT: "Distant",
  UNKNOWN: "Unknown: limited data",
};

export const STATUS_LABEL: Record<string, string> = {
  SUPPORTED: "Supported",
  SINGLE_SOURCE: "Single source",
  CONTESTED: "Contested",
  INFERRED: "Computed",
  UNKNOWN: "Unknown",
};

// ---------------------------------------------------------------------------
/** The counterintuitive moment: symptom-first and mechanism-first point at different diseases. */
export function DiscoveryView({ d, ctx }: { d: Discovery; ctx: Ctx }) {
  const focal = d.focalLabel.replace(/ disease$/, "");
  const col = (title: string, question: string, pick: Discovery["bySymptoms"], lens: "sym" | "mech") => (
    <div className={`disc-col ${lens}`}>
      <div className="caps disc-kicker">{title}</div>
      <p className="disc-q">{question}</p>
      <div className="disc-answer">→ {pick.label}</div>
      <div className="bars">
        <div className="bar-row">
          <span className="bar-label">Symptoms</span>
          <span className="bar"><span className="fill sym" style={{ width: `${(pick.phenotype / 0.25) * 100}%` }} /></span>
          <span className="bar-num mono">{pick.phenotype.toFixed(2)}</span>
        </div>
        <div className="bar-row">
          <span className="bar-label">Mechanism</span>
          <span className="bar"><span className="fill mech" style={{ width: `${(pick.mechanism / 0.6) * 100}%` }} /></span>
          <span className="bar-num mono">{pick.mechanism.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
  return (
    <section className="discovery">
      <p className="disc-headline">The disease that looks most like {focal} isn&apos;t the disease most worth learning from.</p>
      <div className="disc-grid">
        {col("Traditional similarity search", `What looks most like ${focal}?`, d.bySymptoms, "sym")}
        {col("Kindred", `What shares meaningful biology with ${focal}?`, d.byMechanism, "mech")}
      </div>
      <p className="disc-punch">Same evidence. Different question. Different research path.</p>
      <p className="disc-sub">
        If you search only by symptoms, you might follow the wrong branch. Kindred keeps four things separate:
        phenotypic resemblance, mechanistic relationship, research infrastructure and evidence strength. <Cites ids={d.edges} ctx={ctx} />
      </p>
      <p className="disc-note">A research direction, not a treatment signal. Sharing biology does not mean sharing a therapy.</p>
    </section>
  );
}

/** Kindred knowing when NOT to connect two diseases. */
export function NoRouteView({ label, reason, edges, ctx }: { label: string; reason: string; edges: string[]; ctx: Ctx }) {
  return (
    <section className="noroute">
      <svg className="noroute-mark" width="54" height="40" viewBox="0 0 54 40" aria-hidden="true">
        <line x1="4" y1="20" x2="30" y2="20" stroke="var(--ink)" strokeWidth="1.5" />
        <line x1="30" y1="20" x2="44" y2="20" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2 3" />
        <circle cx="4" cy="20" r="3.5" fill="var(--ink)" />
        <circle cx="48" cy="20" r="4" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      </svg>
      <div>
        <p className="noroute-title">No supported route found.</p>
        <p className="noroute-claim">Kindred will not infer a biological connection from similarity alone.</p>
        <p className="noroute-reason">{label}: {reason} <Cites ids={edges} ctx={ctx} /></p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
export function DossierView({ d, ctx }: { d: Dossier; ctx: Ctx }) {
  return (
    <section className="dossier panel">
      <header className="dossier-head">
        <div>
          <h2 className="dossier-title">{d.label}</h2>
          <div className="dossier-sub">{d.subtitle}</div>
        </div>
        <div className="dossier-ids mono">
          {Object.entries(d.ids).map(([k, v]) => <span key={k}>{k} {v}</span>)}
        </div>
      </header>
      <div className="dossier-grid">
        <div className="dcell">
          <div className="caps dlabel">Molecular cause</div>
          <p>{d.cause.text} <Cites ids={d.cause.edges} ctx={ctx} /></p>
        </div>
        <div className="dcell">
          <div className="caps dlabel">Biological mechanism</div>
          <ul className="dlist">{d.mechanism.map((m) => <li key={m.text}>{m.text} <Cites ids={m.edges} ctx={ctx} /></li>)}</ul>
        </div>
        <div className="dcell">
          <div className="caps dlabel">Key phenotypes</div>
          <div className="chips">{d.phenotypes.map((p) => <span key={p.name} className="chip" title={`Recorded in about ${Math.round(p.frequency * 100)}% of patients`}>{p.name}</span>)}</div>
          <p className="dnote">{d.phenotypeNote} (HPO)</p>
        </div>
        <div className="dcell">
          <div className="caps dlabel">Related diseases</div>
          <ul className="dlist">{d.related.map((r) => <li key={r.label}>{r.label.replace(/ disease$/, "")} <span className={`tag ${r.kinship}`}>{KIN_LABEL[r.kinship]}</span></li>)}</ul>
        </div>
        <div className="dcell">
          <div className="caps dlabel">Research landscape</div>
          <ul className="dlist">{d.landscape.map((l) => <li key={l.text}>{l.text} <Cites ids={l.edges} ctx={ctx} /></li>)}</ul>
        </div>
        <div className="dcell">
          <div className="caps dlabel gap-label">Evidence gaps</div>
          <ul className="dlist">{d.gaps.map((g) => <li key={g.text}>{g.text} <Cites ids={g.edges} ctx={ctx} /></li>)}</ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
const BRANCH_MARK: Record<TreeBranch["kind"], string> = {
  mechanism: "var(--accent)",
  phenotype: "var(--ink)",
  asset: "var(--extracted)",
  gap: "var(--contested)",
  distant: "var(--muted)",
};

/** The Kindred Path: one root, a few labelled branches, clickable leaves. */
export function TreeView({ root, branches, ctx }: { root: string; branches: TreeBranch[]; ctx: Ctx }) {
  return (
    <nav className="tree" aria-label={`Kindred Path from ${root}`}>
      <div className="tree-root"><span className="root-dot" />{root}</div>
      <ul className="tree-branches">
        {branches.map((b, i) => (
          <li key={b.label} className={`tree-branch ${b.kind}`} style={{ ["--i" as string]: i, ["--mark" as string]: BRANCH_MARK[b.kind] }}>
            <div className="branch-label caps">{b.label}</div>
            <ul className="tree-leaves">
              {b.leaves.map((l) => (
                <li key={l.label + l.detail}>
                  <button className="leaf" onClick={() => (l.ask ? ctx.ask(l.ask, l.ask) : l.edges[0] && ctx.openEdge(l.edges[0]))}>
                    <span className="leaf-label">{l.label}</span>
                    <span className="leaf-detail">{l.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
function Whys({ s, ctx }: { s: Story; ctx: Ctx }) {
  return (
    <dl className="whys">
      <dt>Why connected</dt>
      <dd>{s.connected.text} <Cites ids={s.connected.edges} ctx={ctx} /></dd>
      <dt>Why different</dt>
      <dd>{s.different.text} <Cites ids={s.different.edges} ctx={ctx} /></dd>
      <dt>Why investigate</dt>
      <dd>{s.investigate.text} <Cites ids={s.investigate.edges} ctx={ctx} /></dd>
    </dl>
  );
}

/** "How far can I safely take this?" Five categorical answers, no composite score. */
function Scorecard({ s }: { s: Story }) {
  return (
    <div className="scorecard" aria-label="How far can this connection be taken?">
      {s.scorecard.map((x) => (
        <div key={x.label} className={`sc ${x.tone}`}>
          <span className="sc-label">{x.label}</span>
          <span className="sc-value"><i />{x.value}</span>
        </div>
      ))}
    </div>
  );
}

function Scores({ s }: { s: Story }) {
  return (
    <div className="scores">
      <span><b className="mono">{s.mechanism.toFixed(2)}</b> mechanism overlap</span>
      <span><b className="mono">{s.phenotype.toFixed(2)}</b> symptom overlap</span>
      <span>{s.sources} sources · {s.claims} evidence claims</span>
      {s.weakest && s.kinship === "RELATIVE" && <span>Weakest link: <span className={`pill ${s.weakest}`}>{STATUS_LABEL[s.weakest]}</span></span>}
    </div>
  );
}

export function CardsView({ stories, ctx }: { stories: Story[]; ctx: Ctx }) {
  return (
    <div className="cards">
      {stories.map((s) => (
        <article key={s.disease} className={`card ${s.kinship}`}>
          <header className="card-head">
            <h3>{s.label}</h3>
            <span className={`tag ${s.kinship}`}>{KIN_LABEL[s.kinship]}</span>
          </header>
          <Scores s={s} />
          <Scorecard s={s} />
          {(s.kinship === "RELATIVE" || s.kinship === "LOOK_ALIKE") && <Whys s={s} ctx={ctx} />}
          <p className="implication">{s.implication}</p>
          <button className="explore" onClick={() => ctx.ask(s.ask, s.ask)}>Explore connection →</button>
        </article>
      ))}
    </div>
  );
}

export function StoryView({ s, ctx }: { s: Story; ctx: Ctx }) {
  return (
    <article className={`card single ${s.kinship}`}>
      <header className="card-head">
        <h3>{s.label}</h3>
        <span className={`tag ${s.kinship}`}>{KIN_LABEL[s.kinship]}</span>
      </header>
      <Scores s={s} />
      <Scorecard s={s} />
      <Whys s={s} ctx={ctx} />
      <p className="implication">{s.implication}</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
export function AssetsView({ title, groups, ctx }: { title: string; groups: AssetGroup[]; ctx: Ctx }) {
  return (
    <section className="section">
      <h3 className="section-title">{title}</h3>
      <div className="asset-groups">
        {groups.map((g) => (
          <div key={g.title} className={`asset-group ${g.title.startsWith("Requires") ? "review" : ""}`}>
            <div className="caps dlabel">{g.title}</div>
            <p className="dnote">{g.note}</p>
            <ul className="list-plain">
              {g.items.map((i) => (
                <li key={i.label}>
                  {i.url ? <a href={i.url} target="_blank" rel="noreferrer">{i.label}</a> : <b>{i.label}</b>}
                  <div className="asset-detail">{i.detail} <Cites ids={i.edges} ctx={ctx} /></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
export function MatrixView({ rows, ctx }: { rows: MatrixRow[]; ctx: Ctx }) {
  return (
    <div className="section panel matrix-wrap">
      <table className="matrix">
        <thead>
          <tr><th>Claim</th><th>Evidence</th><th className="num">Sources</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.claim} onClick={() => ctx.openEdge(r.edges[0])} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && ctx.openEdge(r.edges[0])}>
              <td>{r.claim} <span className="row-cites"><Cites ids={r.edges} ctx={ctx} /></span></td>
              <td className="muted">{r.evidence}</td>
              <td className="num mono">{r.sources}</td>
              <td><span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dnote" style={{ padding: "0 16px 12px" }}>
        A chain is only as strong as its weakest edge. Computed rows are Kindred&apos;s own assessments; click any row for the source.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BriefView({ focalLabel, rows, questions, ctx }: { focalLabel: string; rows: BriefRow[]; questions: ExpertQuestion[]; ctx: Ctx }) {
  return (
    <article className="brief panel">
      <header className="brief-head">
        <div className="caps" style={{ color: "var(--muted)" }}>Kindred research brief</div>
        <h2 className="dossier-title">{focalLabel}</h2>
      </header>
      <dl className="brief-rows">
        {rows.map((r) => (
          <div key={r.label} className="brief-row">
            <dt>{r.label}</dt>
            <dd>{r.value} <Cites ids={r.edges} ctx={ctx} /></dd>
          </div>
        ))}
      </dl>
      {questions.length > 0 && (
        <div className="brief-q">
          <div className="caps dlabel">Questions for expert review</div>
          <ol className="questions">
            {questions.map((q) => <li key={q.question}>{q.question} <Cites ids={q.edges} ctx={ctx} /></li>)}
          </ol>
        </div>
      )}
      <footer className="brief-foot">
        Prepared from {rows.length} evidence-backed findings. Not a medical recommendation or treatment plan.
        <button className="ghost" onClick={() => window.print()}>Print</button>
      </footer>
    </article>
  );
}

