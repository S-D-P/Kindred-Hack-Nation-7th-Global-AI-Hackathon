"use client";

import type { Block, CompatItem, Connection, EdgeView } from "@/lib/types";
import { AssetsView, BriefView, CardsView, DiscoveryView, DossierView, KIN_LABEL, MatrixView, NoRouteView, STATUS_LABEL, StoryView, TreeView } from "./Research";

export type Ctx = {
  edges: Record<string, EdgeView>;
  openEdge: (id: string) => void;
  ask: (message: string, display?: string) => void;
};

const short = (label: string) =>
  label.replace(/ disease$/, "").replace("Sarcomeric hypertrophic cardiomyopathy (MYH7)", "Sarcomeric HCM");

export function Cite({ id, ctx }: { id: string; ctx: Ctx }) {
  const e = ctx.edges[id];
  const cls = e?.status === "CONTESTED" ? "contested-cite" : e?.provenance === "INFERRED" ? "inferred" : e?.status === "SINGLE_SOURCE" ? "single" : "";
  return (
    <button className={`cite ${cls}`} onClick={() => ctx.openEdge(id)} title={e ? `${e.subjectLabel} ${e.relation} ${e.objectLabel}` : id}>
      {id.startsWith("p-") ? `HPO ${id.split("-")[2]}` : id}
    </button>
  );
}

export function Cites({ ids, ctx }: { ids: string[]; ctx: Ctx }) {
  return <>{[...new Set(ids)].map((id) => <Cite key={id} id={id} ctx={ctx} />)}</>;
}

/** Renders model or template text, turning [e014] markers into evidence buttons. */
function CitedText({ text, ctx }: { text: string; ctx: Ctx }) {
  const parts = text.split(/(\[(?:[a-z]\d{3}|p-[a-z0-9]+-[a-z0-9]+)\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(.+)\]$/);
        return m ? <Cite key={i} id={m[1]} ctx={ctx} /> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
function KinshipPlot({ focalLabel, connections, ctx }: { focalLabel: string; connections: Connection[]; ctx: Ctx }) {
  const W = 640, H = 330, L = 52, R = 24, T = 26, B = 46;
  const xMax = 0.25, yMax = 0.6;
  const x = (v: number) => L + (Math.min(v, xMax) / xMax) * (W - L - R);
  const y = (v: number) => H - B - (Math.min(v, yMax) / yMax) * (H - T - B);
  const question = (c: Connection) =>
    c.kinship === "RELATIVE"
      ? `Why are ${focalLabel} and ${c.label} connected?`
      : `Why don't you think ${c.gene && c.kinship === "LOOK_ALIKE" ? c.gene : short(c.label)} is a relative?`;

  return (
    <div className="panel">
      <div className="kin-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diseases plotted by symptom overlap and mechanism overlap with ${focalLabel}`}>
          {/* regions */}
          <rect x={L} y={T} width={W - L - R} height={y(0.3) - T} fill="var(--accent-soft)" opacity="0.55" />
          <line x1={L} x2={W - R} y1={y(0.3)} y2={y(0.3)} stroke="var(--line-strong)" strokeDasharray="3 4" />
          <line x1={x(0.15)} x2={x(0.15)} y1={y(0.3)} y2={H - B} stroke="var(--line-strong)" strokeDasharray="3 4" />
          <text x={L + 10} y={T + 18} className="caps" fill="var(--accent)" style={{ fontSize: 10.5 }}>Mechanistic relatives</text>
          <text x={W - R - 10} y={y(0.3) + 18} textAnchor="end" className="caps" fill="var(--ink-2)" style={{ fontSize: 10.5 }}>Phenotypic look-alikes</text>
          <text x={L + 10} y={y(0.3) + 18} className="caps" fill="var(--muted)" style={{ fontSize: 10.5 }}>Distant</text>
          {/* axes */}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink)" strokeWidth="1" />
          <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth="1" />
          {[0, 0.1, 0.2].map((v) => (
            <text key={v} x={x(v)} y={H - B + 16} textAnchor="middle" fontSize="10.5" fill="var(--muted)" className="mono">{v.toFixed(1)}</text>
          ))}
          {[0, 0.3, 0.6].map((v) => (
            <text key={v} x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted)" className="mono">{v.toFixed(1)}</text>
          ))}
          <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--ink-2)">Symptom overlap →</text>
          <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--ink-2)">Mechanism overlap →</text>
          {/* points */}
          {connections.map((c) => {
            const cx = x(c.phenotype), cy = y(c.mechanism);
            const right = cx + 14 + short(c.label).length * 7.6 < W - 4;
            return (
              <g key={c.disease} className="pt" onClick={() => ctx.ask(question(c))} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && ctx.ask(question(c))}>
                <title>{`${c.label}: ${KIN_LABEL[c.kinship]}. Click to see why`}</title>
                <circle cx={cx} cy={cy} r="16" fill="transparent" />
                {c.kinship === "RELATIVE" && <circle className="mark" cx={cx} cy={cy} r="8" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2" />}
                {c.kinship === "LOOK_ALIKE" && <circle className="mark" cx={cx} cy={cy} r="7.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />}
                {c.kinship === "DISTANT" && <circle className="mark" cx={cx} cy={cy} r="5" fill="var(--muted)" stroke="var(--muted)" strokeWidth="1" />}
                {c.kinship === "UNKNOWN" && <circle className="mark" cx={cx} cy={cy} r="6" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2 2" />}
                <text x={right ? cx + 14 : cx - 14} y={cy - 2} textAnchor={right ? "start" : "end"} fontSize="13.5" fontWeight="600" fill={c.kinship === "DISTANT" || c.kinship === "UNKNOWN" ? "var(--ink-2)" : "var(--ink)"}>{short(c.label)}</text>
                <text x={right ? cx + 14 : cx - 14} y={cy + 13} textAnchor={right ? "start" : "end"} fontSize="10.5" fill="var(--muted)" className="mono">{c.gene}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="kin-legend">
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--accent)" /></svg>Mechanistic relative</span>
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--ink)" strokeWidth="1.8" /></svg>Phenotypic look-alike</span>
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="3.5" fill="var(--muted)" /></svg>Distant</span>
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--muted)" strokeDasharray="2 2" /></svg>Unknown</span>
      </div>
      <div className="kin-method">
        Compared with {focalLabel}. Symptom overlap: simGIC over HPO phenotype annotations, weighted so rare findings count more than common ones.
        Mechanism overlap: shared gene-product, pathway and cellular nodes in this atlas (weights 3 / 2 / 1). Relative ≥ 0.3 mechanism; look-alike ≥ 0.15 symptoms.
        These are transparent heuristics for this prototype, not clinical similarity scores.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function PathWhy({ c, ctx }: { c: Connection; ctx: Ctx }) {
  const main = c.sharedMechanisms[0];
  return (
    <div className="panel">
      <div className="path">
        {main.path.map((s, i) => {
          const e = s.edge ? ctx.edges[s.edge] : undefined;
          return (
            <div key={i}>
              <div className="step">
                <span className={`step-node ${s.type}`}>{s.label}</span>
                <span className="step-type">{s.type === "mechanism" ? "" : s.type}</span>
                {s.node === main.node && <span className="shared-flag">Shared</span>}
              </div>
              {e && (
                <button className={`link ${e.status === "CONTESTED" ? "CONTESTED" : e.provenance}`} onClick={() => ctx.openEdge(e.id)}>
                  <span className="rail" />
                  <span className="link-body">
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)", marginRight: 8 }}>{e.id}</span>
                    <span className="link-text">{e.subjectLabel} <i>{e.relation}</i> {e.objectLabel}</span>
                    <span className="badge">{e.provenance.toLowerCase()} · {STATUS_LABEL[e.status].toLowerCase()}</span>
                    {e.id === main.weakestEdge && <span className="weak">← weakest link</span>}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {c.sharedMechanisms.length > 1 && (
        <div className="also">
          <span style={{ marginRight: 4 }}>Also shared:</span>
          {c.sharedMechanisms.slice(1).map((m) => (
            <span key={m.node} className="chip">
              {m.label} <Cites ids={m.path.flatMap((p) => (p.edge ? [p.edge] : [])).filter((id, i, a) => i === 1 || i === a.length - 2)} ctx={ctx} />
            </span>
          ))}
        </div>
      )}
      {c.directEdges.length > 0 && (
        <div className="shared-band">
          <b style={{ color: "var(--ink)" }}>What differs: </b>
          {c.directEdges.map((id) => ctx.edges[id]?.label).filter(Boolean).join("; ")} <Cites ids={c.directEdges} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

function PathWhyNot({ c, focalLabel, focal, ctx }: { c: Connection; focalLabel: string; focal: string; ctx: Ctx }) {
  const pid = `p-${focal}-${c.disease}`;
  const fo = c.onlyFocal.filter((x) => x.tier !== "cellular");
  const oo = c.onlyOther.filter((x) => x.tier !== "cellular");
  const shared = c.sharedMechanisms[0];
  return (
    <div className="panel">
      <div className="resemble">
        <div className="caps" style={{ color: "var(--muted)" }}>What they share clinically</div>
        <div className="chips">
          {c.sharedPhenotypes.slice(0, 6).map((p) => <span key={p.id} className="chip">{p.name}</span>)}
          <Cites ids={[pid, ...c.directEdges]} ctx={ctx} />
        </div>
      </div>
      <div className="diverge">
        {[{ title: focalLabel, items: fo }, { title: c.label, items: oo }].map((col) => (
          <div key={col.title}>
            <h4>{col.title} runs through</h4>
            {col.items.length ? col.items.map((m) => (
              <div key={m.id} className="mech-row">
                {m.label} <Cite id={m.edge} ctx={ctx} />
                <small>{m.tier === "molecular" ? "what the gene product is" : "pathway"}</small>
              </div>
            )) : <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No mechanism recorded in this atlas.</p>}
          </div>
        ))}
      </div>
      <div className="shared-band">
        {shared
          ? <>Only shared mechanism node: <b style={{ color: "var(--ink)" }}>{shared.label.toLowerCase()}</b>, a {shared.tier === "cellular" ? "downstream cellular consequence, not a shared cause" : `${shared.tier}-level node`}. <Cites ids={shared.path.flatMap((p) => (p.edge ? [p.edge] : []))} ctx={ctx} /></>
          : <>No mechanism node is shared in this atlas.</>}
      </div>
      <Contested ids={c.contested} ctx={ctx} />
    </div>
  );
}

/** Pairs of sources that disagree. Kindred shows both sides rather than picking one. */
function Contested({ ids, ctx }: { ids: string[]; ctx: Ctx }) {
  const items = ids.map((id) => ctx.edges[id]).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="contested">
      <div className="contested-head">
        <span className="caps">Evidence disagrees</span>
        <span className="contested-claim">Kindred doesn&apos;t resolve the contradiction by guessing.</span>
      </div>
      <div className="contested-sides">
        {items.map((e, i) => (
          <button key={e.id} className="side" onClick={() => ctx.openEdge(e.id)}>
            <span className="side-label">{i === 0 ? "One source says" : "Another source says"}</span>
            <span className="side-quote">
              {e.quoteChecks[0] === "VERIFIED"
                ? `“${e.evidence.length > 170 ? e.evidence.slice(0, 167) + "…" : e.evidence}”`
                : e.label ?? e.evidence}
            </span>
            <span className="side-source">{e.source.split(" (")[0]} <span className="mono">{e.id}</span></span>
          </button>
        ))}
      </div>
      <p className="contested-note">Both sides stay visible. An expert should check whether they describe the same variants.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
const VERDICTS: { v: CompatItem["verdict"]; title: string }[] = [
  { v: "TRANSFERS", title: "May transfer" },
  { v: "ADAPT", title: "Needs adaptation" },
  { v: "DOES_NOT_TRANSFER", title: "Does not transfer" },
  { v: "UNKNOWN", title: "Unknown: expert review" },
];

function Compat({ b, ctx }: { b: Extract<Block, { type: "compat" }>; ctx: Ctx }) {
  const subjects = (ids: string[]) =>
    [...new Map(ids.map((id) => [ctx.edges[id]?.subject, id])).values()].filter((id) => ctx.edges[id]);
  return (
    <>
      <div className="panel">
        {VERDICTS.map(({ v, title }) => {
          const items = b.items.filter((i) => i.verdict === v);
          if (!items.length) return null;
          return (
            <div key={v} className="compat-group">
              <div className="compat-head"><span className={`verdict-dot v-${v}`} /><span className="caps">{title}</span></div>
              {items.map((i) => (
                <div key={i.component} className="compat-item">
                  <b>{i.component}</b>
                  <p>{i.reason} <Cites ids={i.edges} ctx={ctx} />{i.inferred && <span className="badge">Kindred assessment</span>}</p>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="section two-col">
        <div>
          <div className="caps section-label">Before you build: already exists</div>
          <ul className="list-plain">
            {subjects(b.existing).map((id) => (
              <li key={id}>{ctx.edges[id].subjectLabel} <Cite id={id} ctx={ctx} /></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="caps section-label">Shared with a look-alike</div>
          <ul className="list-plain">
            {subjects(b.shared).map((id) => (
              <li key={id}>{ctx.edges[id].subjectLabel} <Cites ids={b.shared} ctx={ctx} /></li>
            ))}
          </ul>
          <div className="caps section-label" style={{ marginTop: 18 }}>Who to talk to</div>
          <ul className="list-plain">
            {b.contacts.map((id) => (
              <li key={id}><a href={ctx.edges[id]?.sourceUrl} target="_blank" rel="noreferrer">{ctx.edges[id]?.subjectLabel}</a> <Cite id={id} ctx={ctx} /></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="section">
        <div className="caps section-label">Questions for expert review</div>
        <ol className="questions">
          {b.questions.map((q) => (
            <li key={q.question}>{q.question} <Cites ids={q.edges} ctx={ctx} /></li>
          ))}
        </ol>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
export function BlockView({ b, ctx }: { b: Block; ctx: Ctx }) {
  switch (b.type) {
    case "finding":
      return <p className={b.secondary ? "finding sub" : "finding"}>{b.text}</p>;
    case "kinship":
      return (
        <div className="section">
          <KinshipPlot focalLabel={b.focalLabel} connections={b.connections} ctx={ctx} />
        </div>
      );
    case "discovery":
      return <DiscoveryView d={b.discovery} ctx={ctx} />;
    case "noroute":
      return <NoRouteView label={b.label} reason={b.reason} edges={b.edges} ctx={ctx} />;
    case "dossier":
      return <DossierView d={b.dossier} ctx={ctx} />;
    case "tree":
      return <TreeView root={b.root} branches={b.branches} ctx={ctx} />;
    case "cards":
      return <CardsView stories={b.stories} ctx={ctx} />;
    case "story":
      return <StoryView s={b.story} ctx={ctx} />;
    case "assets":
      return <AssetsView title={b.title} groups={b.groups} ctx={ctx} />;
    case "matrix":
      return <MatrixView rows={b.rows} ctx={ctx} />;
    case "brief":
      return <div className="section"><BriefView focalLabel={b.focalLabel} rows={b.rows} questions={b.questions} ctx={ctx} /></div>;
    case "path":
      return (
        <div className="section">
          {b.mode === "why"
            ? <PathWhy c={b.connection} ctx={ctx} />
            : <PathWhyNot c={b.connection} focal={b.focal} focalLabel={b.focalLabel} ctx={ctx} />}
        </div>
      );
    case "explanation":
      return (
        <div>
          <p className="explain"><CitedText text={b.text} ctx={ctx} /></p>
          <div className="explain-by">
            <b>Kindred synthesis</b>
            {b.sources ? ` · ${b.sources} sources · ${b.claims} evidence claims` : ""}
            {b.by === "openai" ? " · written from the supplied evidence only, citations checked" : ` · from the evidence graph${b.note ? ` (${b.note})` : ""}`}
          </div>
        </div>
      );
    case "compat":
      return <div className="section"><Compat b={b} ctx={ctx} /></div>;
    case "gap":
      return (
        <div className="section panel gap">
          <div className="caps" style={{ color: "var(--muted)" }}>What this atlas covers</div>
          <p style={{ margin: "6px 0 12px" }}>
            {b.coverage.diseases.join(", ")} · {b.coverage.edges} evidence edges from {b.coverage.sources} sources · HPO {b.coverage.hpoVersion}.
          </p>
          <div className="caps" style={{ color: "var(--muted)" }}>Evidence that would let Kindred answer</div>
          <ul>{b.needed.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      );
    case "choices":
      return (
        <div>
          {b.prompt && b.prompt !== "Explore" && b.prompt !== "Next" && <div className="choice-prompt">{b.prompt}</div>}
          <div className="choices">
            {b.options.map((o) => <button key={o.label} className="choice" onClick={() => ctx.ask(o.message, o.label)}>{o.label}</button>)}
          </div>
        </div>
      );
    case "disclaimer":
      return (
        <p className="disclaimer">
          Kindred shows documented biology and research infrastructure. Resemblance or a shared mechanism does not establish that a treatment would work. This is a research-planning aid, not diagnosis or medical advice.
        </p>
      );
  }
}

// ---------------------------------------------------------------------------
export function Drawer({ e, onClose, ctx }: { e: EdgeView; onClose: () => void; ctx: Ctx }) {
  const verified = e.quoteChecks[0] === "VERIFIED";
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Evidence">
        <button className="ghost close" onClick={onClose}>Close</button>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{e.id.startsWith("p-") ? "computed" : e.id} · provenance trace</span>
        <h3>{e.subjectLabel} <span className="rel">{e.relation}</span> {e.objectLabel}</h3>
        {e.label && <p style={{ marginTop: -6, color: "var(--ink-2)" }}>{e.label}</p>}

        <ol className="trace">
          <li>
            <div className="trace-step caps">Source</div>
            <a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source}</a>
            <div className="trace-note">
              {e.provenance === "CURATED" && "Curated reference resource"}
              {e.provenance === "EXTRACTED" && "Peer-reviewed publication"}
              {e.provenance === "INFERRED" && "Computed by Kindred from the data, not an observation"}
            </div>
          </li>
          <li>
            <div className="trace-step caps">Evidence passage</div>
            <blockquote className={`quote ${e.provenance}`}>{e.quoteChecks[0] === "VERIFIED" ? `“${e.evidence}”` : e.evidence}</blockquote>
            {e.provenance !== "INFERRED" && (
              <div className={verified ? "verified" : "trace-note"}>
                {verified ? "✓ Found verbatim in the source by automated check" : "Not machine-checkable for this source type"}
              </div>
            )}
          </li>
          <li>
            <div className="trace-step caps">Normalised claim</div>
            <div className="claim">
              <span className="ent">{e.subjectLabel}{e.subjectType && <small>{e.subjectType}</small>}</span>
              <span className="arrow">{e.relation} →</span>
              <span className="ent">{e.objectLabel}{e.objectType && <small>{e.objectType}</small>}</span>
            </div>
          </li>
          <li>
            <div className="trace-step caps">Status</div>
            <span className={`pill ${e.provenance}`}>{e.provenance.toLowerCase()}</span> <span className={`pill ${e.status}`}>{STATUS_LABEL[e.status]}</span>
            <div className="trace-note">
              {e.status === "SINGLE_SOURCE" && "One source. Any path through this edge is capped at single source by the weakest-link rule."}
              {e.status === "SUPPORTED" && "A curated resource or two independent sources."}
              {e.status === "CONTESTED" && <>Sources disagree; contradicted by <Cites ids={e.contradictedBy ?? []} ctx={ctx} /></>}
              {e.status === "INFERRED" && "Kindred's own computation; shown as an assessment, never as fact."}
            </div>
            {e.status !== "CONTESTED" && <div className="trace-note">Contradictions: none recorded in this atlas.</div>}
          </li>
        </ol>

        {e.corroboratedBy?.map((c, i) => (
          <div key={i} className="corrob">
            <div className="caps" style={{ color: "var(--muted)" }}>Independently supported by</div>
            <blockquote>“{c.evidence}”</blockquote>
            <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{c.source}</a>
            {e.quoteChecks[i + 1] === "VERIFIED" && <span className="verified" style={{ marginLeft: 8 }}>✓ verified</span>}
          </div>
        ))}
      </aside>
    </>
  );
}
