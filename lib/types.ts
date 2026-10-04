export type Provenance = "CURATED" | "EXTRACTED" | "INFERRED";
export type Status = "SUPPORTED" | "SINGLE_SOURCE" | "CONTESTED" | "INFERRED" | "UNKNOWN";

export interface GraphNode {
  id: string;
  type: "disease" | "gene" | "mechanism" | "phenotype" | "asset" | "organization";
  label: string;
  aliases?: string[];
  ids?: Record<string, string>;
  hpoSources?: string[];
  gene?: string;
  tier?: "molecular" | "pathway" | "cellular";
  kind?: string;
  community?: string;
  url?: string;
}

export interface SourceRef {
  source: string;
  sourceUrl: string;
  evidence: string;
}

export interface Edge extends SourceRef {
  id: string;
  subject: string;
  relation: string;
  object: string;
  label?: string;
  provenance: Provenance;
  status: Status;
  corroboratedBy?: SourceRef[];
  contradictedBy?: string[];
}

/** Edge as sent to the browser, with labels resolved and quote checks attached. */
export interface EdgeView extends Edge {
  subjectLabel: string;
  subjectType?: GraphNode["type"];
  objectType?: GraphNode["type"];
  objectLabel: string;
  quoteChecks: ("VERIFIED" | "NOT_FOUND" | "NOT_CHECKABLE")[];
}

export type Kinship = "RELATIVE" | "LOOK_ALIKE" | "DISTANT" | "UNKNOWN";

export interface PathStep {
  node: string;
  label: string;
  type: GraphNode["type"];
  /** Edge linking this step to the next one (absent on the last step). */
  edge?: string;
  /** Direction of that edge relative to reading order. */
  reversed?: boolean;
}

export interface SharedMechanism {
  node: string;
  label: string;
  tier: NonNullable<GraphNode["tier"]>;
  path: PathStep[];
  weakest: Status;
  weakestEdge: string | null;
}

export interface Connection {
  disease: string;
  label: string;
  gene?: string;
  phenotype: number;
  mechanism: number;
  kinship: Kinship;
  phenotypeTermCount: number;
  sharedMechanisms: SharedMechanism[];
  onlyFocal: { id: string; label: string; tier: string; edge: string }[];
  onlyOther: { id: string; label: string; tier: string; edge: string }[];
  sharedPhenotypes: { id: string; name: string; ic: number }[];
  directEdges: string[];
  sharedAssets: string[];
  /** CONTESTED edges about either disease, each paired with what contradicts it. */
  contested: string[];
  summary: string;
}

export type CompatVerdict = "TRANSFERS" | "ADAPT" | "DOES_NOT_TRANSFER" | "UNKNOWN";

export interface CompatItem {
  component: string;
  verdict: CompatVerdict;
  reason: string;
  edges: string[];
  inferred: boolean;
}

export interface ExpertQuestion {
  question: string;
  edges: string[];
}

/** A short statement and the evidence IDs it rests on. */
export interface Cited {
  text: string;
  edges: string[];
}

/** The three questions every Kindred connection answers. */
export interface Story {
  disease: string;
  label: string;
  kinship: Kinship;
  mechanism: number;
  phenotype: number;
  connected: Cited;
  different: Cited;
  investigate: Cited;
  implication: string;
  sources: number;
  claims: number;
  weakest: Status | null;
  ask: string;
  /** "How far can I safely take this?" Categorical, never a single score. */
  scorecard: { label: string; value: string; tone: "good" | "warn" | "bad" | "none" }[];
  /** True when nothing upstream of a downstream consequence is shared. */
  noRoute: boolean;
}

/** The counterintuitive contrast: the closest look is not the closest biology. */
export interface Discovery {
  focalLabel: string;
  bySymptoms: { label: string; phenotype: number; mechanism: number };
  byMechanism: { label: string; phenotype: number; mechanism: number };
  edges: string[];
}

export interface Dossier {
  disease: string;
  label: string;
  subtitle: string;
  ids: Record<string, string>;
  cause: Cited;
  mechanism: Cited[];
  phenotypes: { name: string; frequency: number }[];
  phenotypeNote: string;
  related: { label: string; kinship: Kinship }[];
  landscape: Cited[];
  gaps: Cited[];
}

export interface AssetItem {
  label: string;
  detail: string;
  edges: string[];
  url?: string;
}
export interface AssetGroup {
  title: string;
  note: string;
  items: AssetItem[];
}

export interface MatrixRow {
  claim: string;
  evidence: string;
  sources: number;
  status: Status;
  edges: string[];
}

export interface BriefRow {
  label: string;
  value: string;
  edges: string[];
}

export interface TreeLeaf {
  label: string;
  detail: string;
  ask?: string;
  edges: string[];
}
export interface TreeBranch {
  kind: "mechanism" | "phenotype" | "distant" | "asset" | "gap";
  label: string;
  leaves: TreeLeaf[];
}

export type Block =
  | { type: "finding"; text: string; secondary?: boolean }
  | { type: "dossier"; dossier: Dossier }
  | { type: "discovery"; discovery: Discovery }
  | { type: "noroute"; label: string; reason: string; edges: string[] }
  | { type: "tree"; root: string; branches: TreeBranch[] }
  | { type: "cards"; stories: Story[] }
  | { type: "story"; story: Story }
  | { type: "assets"; title: string; groups: AssetGroup[] }
  | { type: "matrix"; focalLabel: string; rows: MatrixRow[] }
  | { type: "brief"; focalLabel: string; rows: BriefRow[]; questions: ExpertQuestion[] }
  | { type: "kinship"; focal: string; focalLabel: string; connections: Connection[] }
  | { type: "path"; focal: string; focalLabel: string; connection: Connection; mode: "why" | "why_not" }
  | { type: "explanation"; text: string; by: "openai" | "template"; note?: string; sources?: number; claims?: number }
  | { type: "compat"; source: string; target: string; items: CompatItem[]; existing: string[]; shared: string[]; contacts: string[]; questions: ExpertQuestion[] }
  | { type: "gap"; query: string; coverage: { diseases: string[]; edges: number; sources: number; hpoVersion: string }; needed: string[] }
  | { type: "choices"; prompt: string; options: { label: string; message: string }[] }
  | { type: "disclaimer" };

export interface ChatContext {
  focal?: string;
  other?: string;
}

export interface AskResponse {
  blocks: Block[];
  edges: Record<string, EdgeView>;
  context: ChatContext;
  intent: { intent: string; entity?: string; other?: string; by: "openai" | "rules" };
}
