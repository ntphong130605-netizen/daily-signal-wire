import ReaderShell from "@/components/ReaderShell";

export type StaticSection = {
  title: string;
  body: string;
};

export default function StaticPage({
  eyebrow,
  title,
  description,
  sections
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: StaticSection[];
}) {
  return (
    <ReaderShell>
      <main className="static-page-shell">
        <section className="static-page-hero">
          <p className="section-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>

        <section className="static-page-card">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>
      </main>
    </ReaderShell>
  );
}
