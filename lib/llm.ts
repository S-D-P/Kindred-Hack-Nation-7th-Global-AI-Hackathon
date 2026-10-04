// OpenAI is used for three narrow jobs: parse the question into an intent,
// reconcile the disease name to a canonical node, and narrate evidence the
// graph engine already computed. It never decides biomedical truth: every
// explanation must cite only the evidence IDs it was given, or it is discarded
// and a deterministic template is shown instead.
import { diseases, mentionedEntities, node, nodes, resolveEntity } from "./graph";
import type { ChatContext } from "./types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const ROUTER_MODEL = process.env.OPENAI_ROUTER_MODEL ?? "gpt-4.1-mini";
const hasKey = () => Boolean(process.env.OPENAI_API_KEY);

async function chat(body: object): Promise<string | null> {
  if (!hasKey()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, temperature: 0, ...body }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("OpenAI error", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("OpenAI request failed", err);
    return null;
  }
}

// --- 1 + 2. Intent parsing and entity reconciliation -----------------------
export const INTENTS = [
  "find_connections",
  "explain_connection",
  "explain_difference",
  "reuse_assets",
  "next_steps",
  "evidence_matrix",
  "landscape",
  "out_of_scope",
] as const;
export type Intent = (typeof INTENTS)[number];
export interface ParsedIntent {
  intent: Intent;
  entity?: string;
  other?: string;
  unmatched?: string;
  by: "openai" | "rules";
}

const ENTITY_IDS = diseases.map((d) => d.id);

export async function parseIntent(message: string, ctx: ChatContext): Promise<ParsedIntent> {
  const catalogue = diseases
    .map((d) => `${d.id}: ${d.label} (gene ${d.gene}; also called ${(d.aliases ?? []).join(", ")})`)
    .join("\n");
  const content = await chat({
    model: ROUTER_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You route questions for Kindred, a rare-disease evidence atlas. Map the user's message to one intent and to canonical disease IDs.\n` +
          `Intents:\n- find_connections: which diseases share biology / resemble a disease ("who shares our biology?")\n` +
          `- explain_connection: why two diseases are connected\n- explain_difference: why a disease is NOT a relative / how they differ\n` +
          `- reuse_assets: whether research assets, registries, studies or therapies built for one disease could be reused for another\n` +
          `- next_steps: what to investigate or do next, a research or collaboration brief\n` +
          `- evidence_matrix: how well the connections are known, strength of evidence, what is uncertain\n` +
          `- landscape: which studies, registries, organizations or publications exist around a disease or connection\n` +
          `- out_of_scope: anything else (diagnosis, treatment advice, unrelated)\n` +
          `Diseases in the atlas:\n${catalogue}\n` +
          `"entity" is the user's own disease (the focus); "other" is a second disease being compared or whose assets are discussed. ` +
          `Use "none" if not mentioned. If the user names a disease that is NOT in the atlas, put its name in "unmatched".\n` +
          `Conversation focus so far: ${ctx.focal ?? "none"}; last compared: ${ctx.other ?? "none"}.`,
      },
      { role: "user", content: message },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intent",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["intent", "entity", "other", "unmatched"],
          properties: {
            intent: { type: "string", enum: [...INTENTS] },
            entity: { type: "string", enum: [...ENTITY_IDS, "none"] },
            other: { type: "string", enum: [...ENTITY_IDS, "none"] },
            unmatched: { type: "string" },
          },
        },
      },
    },
  });
  if (content) {
    try {
      const p = JSON.parse(content);
      return {
        intent: p.intent,
        entity: p.entity !== "none" ? p.entity : undefined,
        other: p.other !== "none" ? p.other : undefined,
        unmatched: p.unmatched?.trim() || undefined,
        by: "openai",
      };
    } catch {}
  }
  return parseIntentRules(message, ctx);
}

export function parseIntentRules(message: string, ctx: ChatContext): ParsedIntent {
  const m = message.toLowerCase();
  const mentioned = mentionedEntities(message);
  // A disease-like phrase that does not resolve → coverage gap.
  const phrase = message.match(/([A-Z][\w-]+(?:[ -][A-Z0-9][\w-]*)*\s+(?:disease|syndrome|deficiency))/)?.[1];
  const unmatched = phrase && !resolveEntity(phrase) ? phrase : undefined;
  let intent: Intent = "find_connections";
  if (/\b(should|can) (i|my|he|she)\b.*\b(take|start|get|try)\b|\btreat|\bcure\b|diagnos|\bdose\b|medication|prescri/.test(m)) intent = "out_of_scope";
  else if (/reuse|borrow|built|registry|registries|asset|adapt/.test(m)) intent = "reuse_assets";
  else if (/why (don'?t|not|isn'?t)|not (a )?relative|differ|difference/.test(m)) intent = "explain_difference";
  else if (/\bwhy\b|connected|connection|how .* related/.test(m)) intent = "explain_connection";
  else if (/how well|how sure|matrix|strength of (the )?evidence|confidence/.test(m)) intent = "evidence_matrix";
  else if (/exists? around|landscape|what studies|which studies|who (works|is working)/.test(m)) intent = "landscape";
  else if (/next|investigate|brief|proposal|plan|summar/.test(m)) intent = "next_steps";
  // With no disease chosen yet, the first one named becomes the focus.
  const entity = mentioned.find((id) => id === ctx.focal) ?? (intent === "find_connections" || !ctx.focal ? mentioned[0] : undefined);
  const other = mentioned.find((id) => id !== (entity ?? ctx.focal));
  return { intent, entity, other, unmatched, by: "rules" };
}

// --- 3. Evidence-locked explanation --------------------------------------------
export interface Explained {
  text: string;
  by: "openai" | "template";
  note?: string;
}

const CITE = /\[([a-z]\d{3}|p-[a-z0-9]+-[a-z0-9]+)\]/g;

export async function explain(task: string, evidence: object, allowed: string[], fallback: string): Promise<Explained> {
  const content = await chat({
    messages: [
      {
        role: "system",
        content:
          "You explain rare-disease research evidence to a patient-organization leader with no medical training.\n" +
          "RULES:\n" +
          "1. You may only make claims supported by the supplied evidence. Do not add biomedical knowledge from your own training data.\n" +
          "2. End every sentence that states a fact with one or more evidence IDs in square brackets, exactly as given, e.g. [e014] or [p-danon-pompe].\n" +
          "3. Never imply that resemblance or a shared mechanism means a treatment will work, and never give medical advice.\n" +
          "4. Items marked INFERRED were computed by Kindred; describe them as Kindred's assessment, not as established fact.\n" +
          "5. If an edge is SINGLE_SOURCE, say it rests on one source.\n" +
          "6. Plain language. At most 4 short sentences. No headings, no lists, no preamble. Do not use em dashes.\n" +
          "7. Never mention PMIDs, trial IDs, drugs or recommendations that are not in the evidence.",
      },
      { role: "user", content: `${task}\n\nEVIDENCE (JSON):\n${JSON.stringify(evidence)}` },
    ],
  });
  if (!content) return { text: fallback, by: "template", note: hasKey() ? "deterministic fallback: OpenAI unavailable" : "deterministic fallback: no OpenAI key" };

  const problems = checkGeneration(content, allowed, JSON.stringify(evidence));
  if (problems.length) {
    console.warn("Explanation rejected", problems);
    return { text: fallback, by: "template", note: "deterministic fallback: model output failed the evidence check" };
  }
  const EM_DASH = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, "g");
  return { text: content.trim().replace(EM_DASH, ", "), by: "openai" };
}

/**
 * Guard for model output. Returns the reasons to reject it (empty = accept):
 * no citations, a citation that was not supplied, factual sentences without a
 * citation, or a PMID / trial ID that does not appear in the supplied evidence.
 */
export function checkGeneration(content: string, allowed: string[], evidenceText: string): string[] {
  const problems: string[] = [];
  const cited = [...content.matchAll(CITE)].map((m) => m[1]);
  if (!cited.length) problems.push("no citations");
  for (const id of cited) if (!allowed.includes(id)) problems.push(`unknown citation ${id}`);
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 25);
  const uncited = sentences.filter((s) => !/\[([a-z]\d{3}|p-[a-z0-9]+-[a-z0-9]+)\]/.test(s));
  if (uncited.length > 1) problems.push(`${uncited.length} uncited sentences`);
  for (const ref of content.match(/PMID:?\s*\d+|NCT\d{8}/gi) ?? []) {
    const digits = ref.replace(/\D/g, "");
    if (!evidenceText.includes(digits)) problems.push(`identifier not in evidence: ${ref}`);
  }
  problems.push(...ungroundedEntities(content, evidenceText).map((e) => `entity not in evidence: ${e}`));
  return problems;
}

/**
 * Entity grounding: a valid citation must not carry an unsupported disease or gene.
 * Conservative and deterministic. An entity is grounded only if its name (or one of
 * its atlas aliases) appears in the supplied evidence, so a cited sentence about a
 * disease the evidence never mentions is rejected.
 *   1. Atlas diseases and genes named in the output (via the normalised alias set).
 *   2. Named disease phrases outside the atlas: a run of capitalised or alphanumeric
 *      name tokens directly before "disease" / "syndrome" / "deficiency"
 *      ("Batten disease"). Generic phrases with no name ("the disease") are ignored.
 *   3. Gene-like symbols (LAMP2, GBA1): capitalised alphanumeric tokens with a digit.
 */
export function ungroundedEntities(content: string, evidenceText: string): string[] {
  const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const ev = norm(evidenceText);
  const inEvidence = (name: string) => name.trim().length > 1 && ev.includes(norm(name));
  const bad = new Set<string>();

  for (const id of mentionedEntities(content)) {
    const d = node(id)!;
    const names = [d.label, ...(d.aliases ?? []), d.gene ?? ""].filter(Boolean);
    if (!names.some(inEvidence)) bad.add(d.label);
  }
  for (const g of nodes.filter((n) => n.type === "gene")) {
    if (new RegExp(`\\b${g.label}\\b`).test(content) && !inEvidence(g.label)) bad.add(g.label);
  }

  // Citation markers are not words; drop them before reading names.
  const tokens = content.replace(/\[[^\]]*\]/g, " ").split(/\s+/);
  const nameToken = /^(?:[A-Z][\w'-]*|[a-z]*\d[\w-]*)$/;
  const stop = /^(The|A|An|This|That|These|Those|Both|Each|In|Of|And|But|While|For|Like|Kindred)$/;
  tokens.forEach((tok, i) => {
    const kw = tok.match(/^(disease|syndrome|deficiency)/i)?.[1];
    if (!kw) return;
    // Name tokens directly before the keyword; punctuation ends the phrase ("Mechanistically, Danon disease").
    const run: string[] = [];
    for (let j = i - 1; j >= 0 && run.length < 4; j--) {
      const raw = tokens[j];
      if (/[,.;:!?)]$/.test(raw)) break;
      const t = raw.replace(/[^\w'-]/g, "");
      if (!nameToken.test(t) || stop.test(t)) break;
      run.unshift(t);
    }
    if (!run.length) return; // a generic phrase ("the disease", "storage disease") names nothing
    // Grounded if the name, or its tail nearest the keyword, appears in the evidence.
    const grounded = run.some((_, k) => inEvidence(`${run.slice(k).join(" ")} ${kw}`));
    if (!grounded) bad.add(`${run.join(" ")} ${kw}`);
  });

  for (const sym of content.match(/\b[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b/g) ?? []) {
    if (!/^(PMID|NCT)/.test(sym) && !inEvidence(sym)) bad.add(sym);
  }
  return [...bad];
}
