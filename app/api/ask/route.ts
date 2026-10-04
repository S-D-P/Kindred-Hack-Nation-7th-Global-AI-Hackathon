import { compatibility } from "@/lib/compat";
import { compare, connectionEdgeIds, connections, coverage, edgeViews, node, phenotypeEdge, sourceCount } from "@/lib/graph";
import { explain, parseIntent } from "@/lib/llm";
import { brief, discovery, dossier, landscape, matrix, story, tree } from "@/lib/research";
import type { AskResponse, Block, ChatContext, Connection, EdgeView } from "@/lib/types";

const pathEdges = (c: Connection, i = 0) => c.sharedMechanisms[i]?.path.flatMap((s) => (s.edge ? [s.edge] : [])) ?? [];
const cite = (ids: string[]) => ids.map((id) => `[${id}]`).join("");
/** Lower-case a label for mid-sentence use, but leave acronyms (AMPK, LAMP2) alone. */
const lc = (s?: string) => s?.split(" ").map((w) => (/^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w)).join(" ");

/**
 * Compact, model-facing view of the evidence: only what the claim may rest on.
 * The payload is exactly the citation allowlist: computed phenotype edges are
 * included only when their ID is in `ids`.
 */
function evidencePayload(ids: string[], extra: Record<string, EdgeView>) {
  const allowedExtra = Object.fromEntries(Object.entries(extra).filter(([id]) => ids.includes(id)));
  const views = { ...edgeViews(ids), ...allowedExtra };
  return Object.values(views).map((e) => ({
    id: e.id,
    claim: `${e.subjectLabel} | ${e.relation} | ${e.objectLabel}${e.label ? ` (${e.label})` : ""}`,
    evidence: e.evidence,
    source: e.source,
    provenance: e.provenance,
    status: e.status,
  }));
}

export async function POST(req: Request) {
  const { message, context = {} } = (await req.json()) as { message: string; context?: ChatContext };
  const parsed = await parseIntent(message, context);

  let focal = parsed.entity ?? context.focal;
  let other = parsed.other;
  // "Why isn't PRKAG2 a relative?", a newly named disease is the comparison, not a new focus.
  if (context.focal && parsed.entity && parsed.entity !== context.focal && !parsed.other && parsed.intent !== "find_connections") {
    focal = context.focal;
    other = parsed.entity;
  }

  const blocks: Block[] = [];
  const extraEdges: Record<string, EdgeView> = {};
  const cited = new Set<string>();
  const addPhenotypeEdge = (a: string, b: string) => {
    const p = phenotypeEdge(a, b);
    if (p) extraEdges[p.id] = p;
    return p?.id;
  };
  /** Kindred synthesis: OpenAI narrates only these edges; the template is the fallback. */
  const synthesize = async (task: string, ids: string[], fallback: string): Promise<Block> => {
    const allowed = [...new Set(ids)];
    allowed.forEach((id) => (id.startsWith("p-") ? addPhenotypeEdge(id.split("-")[1], id.split("-")[2]) : cited.add(id)));
    const out = await explain(task, evidencePayload(allowed, extraEdges), allowed, fallback);
    return {
      type: "explanation",
      ...out,
      sources: sourceCount(allowed) + (allowed.some((id) => id.startsWith("p-")) ? 1 : 0),
      claims: allowed.length,
    };
  };
  const respond = (ctx: ChatContext) => {
    const body: AskResponse = {
      blocks,
      edges: { ...edgeViews(cited), ...extraEdges },
      context: ctx,
      intent: { intent: parsed.intent, entity: focal, other, by: parsed.by },
    };
    return Response.json(body);
  };

  // --- not in the atlas: say so, with coverage --------------------------------
  if (parsed.unmatched && !parsed.entity) {
    blocks.push({ type: "finding", text: `${parsed.unmatched} is not in this atlas, so Kindred cannot show a supported connection for it.` });
    blocks.push({
      type: "gap",
      query: parsed.unmatched,
      coverage: coverage(),
      needed: [
        "A curated gene–disease record (e.g. MedlinePlus Genetics or OMIM)",
        "HPO phenotype annotations, to compare symptom profiles",
        "At least one source describing the disrupted cellular process",
        "Registry, natural-history or trial records on ClinicalTrials.gov",
      ],
    });
    blocks.push({ type: "disclaimer" });
    return respond(context);
  }

  if (parsed.intent === "out_of_scope") {
    blocks.push({ type: "finding", text: "Kindred maps research connections. It cannot diagnose, recommend treatment or advise on care." });
    blocks.push({ type: "choices", prompt: "Questions Kindred can answer", options: [
      { label: "Who shares our biology?", message: "Who shares our biology?" },
      { label: "What could we reuse?", message: "What could we reuse?" },
    ] });
    return respond(context);
  }

  if (!focal) {
    blocks.push({ type: "choices", prompt: "Which disease is yours?", options: [
      { label: "Danon disease", message: "Danon disease: who shares our biology?" },
      { label: "Pompe disease", message: "Pompe disease: who shares our biology?" },
      { label: "PRKAG2 cardiac syndrome", message: "PRKAG2 cardiac syndrome: who shares our biology?" },
      { label: "Fabry disease", message: "Fabry disease: who shares our biology?" },
    ] });
    return respond(context);
  }

  const focalLabel = node(focal)!.label;
  const all = connections(focal);
  const relative = all.find((c) => c.kinship === "RELATIVE");
  const lookAlike = all.find((c) => c.kinship === "LOOK_ALIKE");

  // --- 1. Who shares our biology? ---------------------------------------------
  if (parsed.intent === "find_connections") {
    const resembling = all.filter((c) => c.phenotype > 0.08 || c.mechanism > 0).length;
    const d = dossier(focal);
    const branches = tree(focal);
    const stories = all.map((c) => story(focal!, c));
    const disc = discovery(focal);
    blocks.push({ type: "dossier", dossier: d });
    blocks.push({ type: "finding", text: `${resembling} diseases in this atlas resemble ${focalLabel}, but they are not equally related.` });
    if (disc) {
      blocks.push({ type: "discovery", discovery: disc });
      disc.edges.forEach((id) => (id.startsWith("p-") ? addPhenotypeEdge(id.split("-")[1], id.split("-")[2]) : cited.add(id)));
    }
    blocks.push({ type: "kinship", focal, focalLabel, connections: all });
    blocks.push({ type: "cards", stories });
    blocks.push({ type: "tree", root: focalLabel, branches });
    all.forEach((c) => connectionEdgeIds(c).forEach((id) => cited.add(id)));
    all.forEach((c) => addPhenotypeEdge(focal!, c.disease));
    [
      d.cause.edges, ...d.mechanism.map((m) => m.edges), ...d.landscape.map((l) => l.edges), ...d.gaps.map((g) => g.edges),
      ...branches.flatMap((b) => b.leaves.map((l) => l.edges)),
      ...stories.flatMap((s) => [s.connected.edges, s.different.edges, s.investigate.edges]),
    ].flat().forEach((id) => (id.startsWith("p-") ? null : cited.add(id)));

    const ids: string[] = [];
    let fallback = "";
    if (relative) {
      const p = pathEdges(relative);
      ids.push(...p, ...relative.directEdges);
      fallback += `Kindred classifies ${relative.label} as a mechanistic relative: both diseases record ${lc(relative.sharedMechanisms[0].label)} ${cite(p)}. `;
    }
    if (lookAlike) {
      const pid = addPhenotypeEdge(focal, lookAlike.disease)!;
      const g = pathEdges(lookAlike);
      const cause = lookAlike.onlyOther[0];
      ids.push(pid, ...g, ...lookAlike.directEdges, ...(cause ? [cause.edge] : []));
      fallback += `${lookAlike.label} has the strongest symptom overlap ${cite([pid, ...lookAlike.directEdges])}, but the only mechanism it shares is ${lc(lookAlike.sharedMechanisms[0]?.label) ?? "none"} ${cite(g)}; its cause runs through ${lc(cause?.label)} ${cite(cause ? [cause.edge] : [])}. `;
    }
    fallback += "This is Kindred's assessment of the evidence in this prototype, not a clinical judgment.";
    blocks.push(
      await synthesize(
        `In plain language, explain to the leader of a ${focalLabel} patient group why Kindred classifies ${relative?.label ?? "no disease"} as a mechanistic relative and ${lookAlike?.label ?? "no disease"} as a phenotypic look-alike. Kinship results: ${JSON.stringify(all.map((c) => ({ disease: c.label, kinship: c.kinship, mechanismOverlap: c.mechanism, phenotypeOverlap: c.phenotype })))}`,
        ids,
        fallback,
      ),
    );
    blocks.push({ type: "choices", prompt: "Explore", options: [
      ...(relative ? [{ label: `Explore ${relative.label.replace(/ disease$/, "")} connection`, message: `Why are ${focalLabel} and ${relative.label} connected?` }] : []),
      ...(lookAlike ? [{ label: `Why isn't ${lookAlike.gene ?? lookAlike.label} a relative?`, message: `Why don't you think ${lookAlike.gene ?? lookAlike.label} is a relative?` }] : []),
      { label: "How well do we know this?", message: "How well do we know this?" },
      ...(relative ? [{ label: `Can we reuse what the ${relative.label.replace(/ disease$/, "")} community built?`, message: `Can we reuse what the ${relative.label.replace(/ disease$/, "")} community built?` }] : []),
      { label: "Research brief", message: "Prepare a research brief" },
    ] });
    blocks.push({ type: "disclaimer" });
    return respond({ focal });
  }

  // --- 2. Why are we connected? / 3. Why not a relative? ------------------------
  if (parsed.intent === "explain_connection" || parsed.intent === "explain_difference") {
    const target = other ?? (parsed.intent === "explain_difference" ? lookAlike?.disease : relative?.disease);
    if (!target) {
      blocks.push({ type: "finding", text: `No ${parsed.intent === "explain_difference" ? "look-alike" : "relative"} of ${focalLabel} is recorded in this atlas.` });
      return respond({ focal });
    }
    const c = compare(focal, target);
    const mode = c.kinship === "RELATIVE" ? "why" : "why_not";
    connectionEdgeIds(c).forEach((id) => cited.add(id));
    const pid = addPhenotypeEdge(focal, target)!;
    const p = pathEdges(c);
    const weak = c.sharedMechanisms[0]?.weakestEdge;

    blocks.push({
      type: "finding",
      text:
        mode === "why"
          ? `${focalLabel} and ${c.label} meet at ${lc(c.sharedMechanisms[0].label)}. The connection is only as strong as its weakest link${weak ? `, which rests on a single source` : ""}.`
          : c.kinship === "LOOK_ALIKE"
            ? `${c.label} resembles ${focalLabel} in the clinic, but the evidence points to a different mechanism.`
            : c.kinship === "UNKNOWN"
              ? `There is too little phenotype data on ${c.label} to judge resemblance, and no shared mechanism is recorded.`
              : `${c.label} shares only a broad pathway with ${focalLabel}, and little of its symptom profile.`,
    });
    const s = story(focal, c);
    [...s.connected.edges, ...s.different.edges, ...s.investigate.edges].forEach((id) => (id.startsWith("p-") ? null : cited.add(id)));
    blocks.push({ type: "story", story: s });
    if (s.noRoute) {
      const downstream = c.sharedMechanisms[0];
      blocks.push({
        type: "noroute",
        label: c.label,
        reason: downstream
          ? `The only shared node, ${lc(downstream.label)}, is a downstream consequence. Nothing upstream (gene product or pathway) is shared in this atlas.`
          : `No gene product, pathway or cellular process is shared in this atlas${c.directEdges.length ? ", even though the two can present alike in the clinic" : ""}.`,
        edges: [...(downstream ? pathEdges(c) : []), ...c.directEdges],
      });
    }
    blocks.push({ type: "path", focal, focalLabel, connection: c, mode });

    let fallback: string;
    let ids: string[];
    if (mode === "why") {
      ids = [...p, ...c.directEdges, pid];
      fallback =
        `Loss of ${node(focal)!.gene} slows the fusion of autophagic vacuoles with lysosomes ${cite([p[0], p[1]])}, and a review describes impaired autophagosome–lysosome fusion in ${c.label} muscle ${cite([p[2]])}. ` +
        (weak ? `That second link rests on a single source ${cite([weak])}, so the connection should be checked by an expert. ` : "") +
        (c.directEdges.length ? `The diseases also differ: ${focalLabel} involves a structural lysosomal protein rather than an enzyme ${cite(c.directEdges.slice(0, 1))}. ` : "") +
        `A shared mechanism is a reason to compare notes, not evidence that a treatment will transfer.`;
    } else {
      const fo = c.onlyFocal.filter((x) => x.tier !== "cellular").slice(0, 2);
      const oo = c.onlyOther.filter((x) => x.tier !== "cellular").slice(0, 2);
      ids = [pid, ...c.directEdges, ...fo.map((x) => x.edge), ...oo.map((x) => x.edge), ...p, ...c.contested];
      const kinshipName = { LOOK_ALIKE: "a phenotypic look-alike", DISTANT: "distant", UNKNOWN: "unknown, because its phenotype data is too sparse", RELATIVE: "a mechanistic relative" }[c.kinship];
      fallback =
        (c.kinship === "LOOK_ALIKE"
          ? `${c.label} shares many heart findings with ${focalLabel}, more than any other disease in this atlas ${cite([pid, ...c.directEdges])}. `
          : `${c.label} has limited recorded symptom overlap with ${focalLabel} ${cite([pid, ...c.directEdges])}. `) +
        `But ${focalLabel} runs through ${fo.map((x) => lc(x.label)).join(" and ")} ${cite(fo.map((x) => x.edge))}, while ${c.label} runs through ${oo.map((x) => lc(x.label)).join(" and ")} ${cite(oo.map((x) => x.edge))}. ` +
        (c.sharedMechanisms[0] ? `The one shared node, ${lc(c.sharedMechanisms[0].label)}, is ${c.sharedMechanisms[0].tier === "cellular" ? "a downstream consequence, not a shared cause" : "a broad pathway"} ${cite(p)}. ` : "") +
        (c.contested.length ? `One finding about ${c.label} is contested between sources ${cite(c.contested)}. ` : "") +
        `Kindred therefore classifies it as ${kinshipName}, based on the evidence in this prototype.`;
    }
    blocks.push(
      await synthesize(
        mode === "why"
          ? `Explain why ${focalLabel} and ${c.label} are connected, step by step along the path, and name the weakest link. Also mention one important difference if the evidence includes one.`
          : `Explain the difference between phenotypic resemblance and a mechanistic relationship, using ${focalLabel} and ${c.label}. Say what they share clinically and where their mechanisms diverge.`,
        ids,
        fallback,
      ),
    );
    const groups = landscape(focal, target);
    groups.flatMap((g) => g.items.flatMap((i) => i.edges)).forEach((id) => cited.add(id));
    blocks.push({ type: "assets", title: "What exists around this connection?", groups });
    const sharedStudy = c.sharedAssets[0] && node(c.sharedAssets[0]);
    blocks.push({ type: "choices", prompt: "Next", options: [
      ...(mode === "why"
        ? [{ label: `Can we reuse what the ${c.label.replace(/ disease$/, "")} community built?`, message: `Can we reuse what the ${c.label.replace(/ disease$/, "")} community built?` }]
        : [{ label: relative ? `Why is ${relative.label.replace(/ disease$/, "")} a relative?` : "Who shares our biology?", message: relative ? `Why are ${focalLabel} and ${relative.label} connected?` : "Who shares our biology?" }]),
      { label: "How well do we know this?", message: "How well do we know this?" },
      { label: "Research brief", message: "Prepare a research brief" },
    ] });
    if (mode === "why_not" && sharedStudy) {
      blocks.splice(blocks.length - 1, 0, {
        type: "finding",
        secondary: true,
        text: `Still useful: look-alikes can share clinical infrastructure. ${sharedStudy.label} already enrols both diseases.`,
      });
    }
    blocks.push({ type: "disclaimer" });
    return respond({ focal, other: target });
  }

  const followUps = [
    { label: "How well do we know this?", message: "How well do we know this?" },
    { label: "Research brief", message: "Prepare a research brief" },
    ...(relative ? [{ label: `Can we reuse what the ${relative.label.replace(/ disease$/, "")} community built?`, message: `Can we reuse what the ${relative.label.replace(/ disease$/, "")} community built?` }] : []),
  ];

  // --- What exists around a disease or connection? -------------------------------
  if (parsed.intent === "landscape") {
    const target = other ?? lookAlike?.disease ?? relative?.disease;
    if (target) {
      const groups = landscape(focal, target);
      groups.flatMap((g) => g.items.flatMap((i) => i.edges)).forEach((id) => cited.add(id));
      blocks.push({ type: "finding", text: `What already exists around ${focalLabel} and ${node(target)!.label}. Shared infrastructure is a practical link, not evidence of shared biology.` });
      blocks.push({ type: "assets", title: "Research landscape", groups });
      blocks.push({ type: "choices", prompt: "Next", options: followUps });
      blocks.push({ type: "disclaimer" });
      return respond({ focal, other: target });
    }
  }

  // --- How well do we know this? -------------------------------------------------
  if (parsed.intent === "evidence_matrix") {
    const rows = matrix(focal);
    rows.flatMap((r) => r.edges).forEach((id) => (id.startsWith("p-") ? addPhenotypeEdge(id.split("-")[1], id.split("-")[2]) : cited.add(id)));
    const n = (s: string) => rows.filter((r) => r.status === s).length;
    blocks.push({
      type: "finding",
      text: `Kindred doesn't only show what is connected. It shows how well each connection is known: ${n("SUPPORTED")} supported, ${n("SINGLE_SOURCE")} single source, ${n("CONTESTED")} contested, ${n("INFERRED")} computed, ${n("UNKNOWN")} unknown.`,
    });
    blocks.push({ type: "matrix", focalLabel, rows });
    blocks.push({ type: "choices", prompt: "Next", options: followUps.filter((o) => !o.label.startsWith("How well")) });
    blocks.push({ type: "disclaimer" });
    return respond({ focal, other });
  }

  // --- Research brief ---------------------------------------------------------------
  if (parsed.intent === "next_steps") {
    const b = brief(focal);
    const ids = [...b.rows.flatMap((r) => r.edges), ...b.questions.flatMap((q) => q.edges)];
    blocks.push({ type: "finding", text: `A research brief for a first conversation with researchers about ${focalLabel}. It is a planning aid, not a medical recommendation or treatment plan.` });
    const rel = relative ? pathEdges(relative) : [];
    const fallback =
      (relative ? `The strongest research lead is the ${relative.label} community, because both diseases record ${lc(relative.sharedMechanisms[0].label)} ${cite(rel)}. ` : "") +
      (relative?.sharedMechanisms[0]?.weakestEdge ? `That link rests on one source, so it is the first thing to check with an expert ${cite([relative.sharedMechanisms[0].weakestEdge])}. ` : "") +
      (focal === "danon" ? `Shared biology does not mean shared treatment: Danon involves a structural protein, not an enzyme ${cite(["e032"])}.` : "");
    blocks.push(
      await synthesize(
        `Write the opening paragraph of a research brief that a ${focalLabel} patient-organization leader could bring to a first meeting with researchers. Name the strongest lead, its weakest evidence, and the main limitation. Brief rows: ${JSON.stringify(b.rows)}`,
        ids,
        fallback,
      ),
    );
    blocks.push({ type: "brief", focalLabel, rows: b.rows, questions: b.questions });
    blocks.push({ type: "disclaimer" });
    return respond({ focal, other });
  }

  // --- 4. Can we reuse what they built? -------------------------------------------
  const source = other && other !== focal ? other : relative?.disease;
  if (!source) {
    blocks.push({ type: "finding", text: `No related community with curated assets is recorded for ${focalLabel} in this atlas.` });
    return respond({ focal });
  }
  if (!(focal === "danon" && source === "pompe")) {
    blocks.push({ type: "finding", text: `The compatibility check is only curated for Pompe disease assets → Danon disease in this prototype.` });
    blocks.push({ type: "gap", query: `${node(source)!.label} assets for ${focalLabel}`, coverage: coverage(), needed: [
      "Curated records of the source community's registries, studies, biomarkers and therapies",
      "Evidence for each asset's biological and eligibility assumptions",
    ] });
    return respond({ focal });
  }
  const c = compatibility(focal, source);
  const pid = addPhenotypeEdge(focal, source)!;
  const ids = [...new Set([...c.items.flatMap((i) => i.edges), ...c.questions.flatMap((q) => q.edges), ...c.existing, ...c.shared, ...c.contacts])];
  ids.filter((id) => !id.startsWith("p-")).forEach((id) => cited.add(id));
  const sourceLabel = node(source)!.label;
  const counts = (v: string) => c.items.filter((i) => i.verdict === v).length;
  blocks.push({
    type: "finding",
    text: `Some of what the ${sourceLabel.replace(/ disease$/, "")} community built could be adapted, but not everything. ${counts("TRANSFERS")} transfers, ${counts("ADAPT")} needs adaptation, ${counts("DOES_NOT_TRANSFER")} do not transfer, and ${counts("UNKNOWN")} need expert review.`,
  });
  blocks.push({ type: "compat", source, target: focal, ...c });
  const therapy = c.items.find((i) => i.verdict === "DOES_NOT_TRANSFER" && i.component.startsWith("Enzyme"));
  const fallback =
    `The registry's design could be reused, because it is a way of collecting data rather than a biological claim ${cite(["e060"])}. ` +
    (therapy ? `Enzyme replacement does not carry over on this evidence, because ${focalLabel} is caused by loss of a structural lysosomal protein, not an enzyme ${cite(["e032", "e011"])}. ` : "") +
    `Before building anything, note that ${focalLabel} already has natural-history studies ${cite(c.existing.slice(0, 2))}.`;
  blocks.push(
    await synthesize(
      `Summarise for a ${focalLabel} patient-group leader what Kindred concluded about reusing ${sourceLabel} assets. The verdicts below were decided by Kindred's rules; do not change them, just explain the most important two or three. Verdicts: ${JSON.stringify(c.items.map((i) => ({ component: i.component, verdict: i.verdict, reason: i.reason, evidence: i.edges })))}. Existing ${focalLabel} assets: ${JSON.stringify(c.existing)}.`,
      [...ids, pid],
      fallback,
    ),
  );
  blocks.push({ type: "choices", prompt: "Next", options: followUps.filter((o) => !o.label.startsWith("Can we reuse")) });
  blocks.push({ type: "disclaimer" });
  return respond({ focal, other: source });
}
