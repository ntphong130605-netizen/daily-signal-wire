import ReaderShell from "@/components/ReaderShell";

export type StaticSection = {
  title: string;
  body: string;
  items?: string[];
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
              {section.items?.length ? (
                <ul className="static-page-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      </main>
    </ReaderShell>
  );
}
