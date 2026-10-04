import type { Metadata } from "next";
import Link from "next/link";
import { KindredMark } from "@/components/Mark";

export const metadata: Metadata = {
  title: "The idea that inspired Kindred",
  description: "Why look sideways across disease boundaries, and why Kindred tries to make that systematic.",
};

const SOURCES = [
  { id: "s1", label: "Every Cure, About", url: "https://everycure.org/about/" },
  { id: "s2", label: "Castleman Disease Collaborative Network, About us", url: "https://cdcn.org/about-us/" },
  { id: "s3", label: "Fajgenbaum et al., J Clin Invest 2019 (PMID 31408438)", url: "https://pubmed.ncbi.nlm.nih.gov/31408438/" },
  { id: "s4", label: "ClinicalTrials.gov NCT03933904", url: "https://clinicaltrials.gov/study/NCT03933904" },
];

const Ref = ({ n }: { n: number }) => (
  <a className="ref" href={SOURCES[n - 1].url} target="_blank" rel="noreferrer" title={SOURCES[n - 1].label}>{n}</a>
);

const STEPS = [
  { title: "A rare disease", body: "Few patients, few researchers, few papers. Everything known about it can fit in a handful of labs." },
  { title: "The obvious research boundary", body: "Research is organised by disease name. When the answer isn't inside that boundary, the search often stops there.", boundary: true },
  { title: "Look sideways", body: "At other diseases, other mechanisms, existing drugs, other research communities, and evidence never collected for this problem.", turn: true },
  { title: "Another disease, mechanism or research asset", body: "Something built or learned somewhere else that bears on the same biology." },
  { title: "A new research path", body: "Not an answer. A better question, with evidence to check." },
];

export default function Story() {
  return (
    <main className="story">
      <nav className="story-nav"><Link href="/">Kindred</Link></nav>

      <header className="story-head">
        <div className="caps story-kicker">The idea that inspired Kindred</div>
        <h1>A rare disease can become an information island.</h1>
      </header>

      <section className="story-prose">
        <p>
          In 2010, David Fajgenbaum was a third-year medical student when he became critically ill with Castleman disease.<Ref n={1} />{" "}
          In 2012 he co-founded the Castleman Disease Collaborative Network with Dr. Frits van Rhee, to coordinate research across the global community.<Ref n={2} />
        </p>
        <p>
          He and his team found an overactive pathway in his blood and tested sirolimus, a drug approved as an immunosuppressant after kidney transplants that had never been used for Castleman disease.<Ref n={1} />{" "}
          The work on mTOR signalling was published in 2019<Ref n={3} />, and sirolimus is now being studied in a clinical trial.<Ref n={4} />
        </p>
        <p className="story-quote">
          “Repurposing existing drugs for new uses is possible, because many diseases share the same underlying problem or mechanism in the body.”
          <span>Every Cure, which Fajgenbaum co-founded<Ref n={1} /></span>
        </p>
        <p>
          The answer wasn&apos;t waiting inside one disease. Finding it meant looking sideways.
        </p>
      </section>

      <section className="sideways" aria-label="Looking sideways">
        {STEPS.map((s, i) => (
          <div key={s.title} className={`sw-step ${s.boundary ? "boundary" : ""} ${s.turn ? "turn" : ""} ${i >= 3 ? "beyond" : ""}`} style={{ ["--i" as string]: i }}>
            <span className="sw-node" />
            <div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="story-ask">
        <p className="story-question">What if every rare-disease community had a map for looking sideways?</p>
        <p>
          Kindred is a small attempt at that map. It separates the diseases that look alike from the ones that share biology,
          shows what research already exists around a connection, and is explicit about how well each link is known.
        </p>
        <p className="story-honest">
          Kindred did not discover anything about Castleman disease. This story is the inspiration for how Kindred thinks,
          not evidence for any connection in its atlas.
        </p>
      </section>

      <footer className="story-end">
        <KindredMark size={52} />
        <div className="wordmark">Kindred</div>
        <p className="tagline">Find the connection.<br />Check the difference.</p>
        <Link className="story-cta" href="/">Open the atlas →</Link>
        <ol className="story-sources">
          {SOURCES.map((s, i) => <li key={s.id}><span>{i + 1}</span> <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
        </ol>
      </footer>
    </main>
  );
}
