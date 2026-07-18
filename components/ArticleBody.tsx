import AdSlot from "@/components/ads/AdSlot";
import AffiliateBlock, { type AffiliateOffer } from "@/components/AffiliateBlock";
import type { RevenueExperimentPayload } from "@/lib/revenue";
import { slugify } from "@/lib/slug";

export type ArticleHeading = {
  id: string;
  level: 2 | 3 | 4;
  text: string;
};

type BaseBlock = {
  context?: "key-takeaways" | "timeline" | "pros-cons" | "statistics";
};

type Block =
  | (BaseBlock & { type: "heading"; id: string; level: 2 | 3 | 4; text: string })
  | (BaseBlock & { type: "paragraph"; text: string; first?: boolean })
  | (BaseBlock & { type: "list"; ordered: boolean; items: string[] })
  | (BaseBlock & { type: "table"; headers: string[]; rows: string[][] })
  | (BaseBlock & { type: "blockquote"; text: string })
  | (BaseBlock & { type: "code"; language?: string; code: string })
  | (BaseBlock & {
      type: "callout";
      variant: "note" | "fact" | "warning" | "success";
      title: string;
      text: string;
    });

function contextFromHeading(text: string): BaseBlock["context"] {
  const value = text.toLowerCase();
  if (value.includes("key takeaway") || value.includes("what to know")) {
    return "key-takeaways";
  }
  if (value.includes("timeline") || value.includes("what happened")) {
    return "timeline";
  }
  if (value.includes("pros") || value.includes("cons")) return "pros-cons";
  if (value.includes("number") || value.includes("statistic")) return "statistics";
  return undefined;
}

function isTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function splitTableRow(line: string) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function calloutVariant(value: string): "note" | "fact" | "warning" | "success" {
  const normalized = value.toLowerCase();
  if (["fact", "source", "verify"].includes(normalized)) return "fact";
  if (["warning", "caution", "alert"].includes(normalized)) return "warning";
  if (["success", "update"].includes(normalized)) return "success";
  return "note";
}

function parseMarkdown(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let unorderedList: string[] = [];
  let orderedList: string[] = [];
  let quote: string[] = [];
  let firstParagraphSeen = false;
  let context: BaseBlock["context"];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({
        type: "paragraph",
        text: paragraph.join(" ").replace(/\*\*/g, "").trim(),
        first: !firstParagraphSeen,
        context
      });
      firstParagraphSeen = true;
      paragraph = [];
    }
  }

  function flushLists() {
    if (unorderedList.length) {
      blocks.push({ type: "list", ordered: false, items: unorderedList, context });
      unorderedList = [];
    }
    if (orderedList.length) {
      blocks.push({ type: "list", ordered: true, items: orderedList, context });
      orderedList = [];
    }
  }

  function flushQuote() {
    if (quote.length) {
      blocks.push({ type: "blockquote", text: quote.join(" "), context });
      quote = [];
    }
  }

  function flushAll() {
    flushParagraph();
    flushLists();
    flushQuote();
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      flushAll();
      continue;
    }

    const fence = line.match(/^```(\w+)?/);
    if (fence) {
      flushAll();
      const language = fence[1];
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language, code: code.join("\n"), context });
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length as 2 | 3 | 4;
      const text = heading[2].replace(/\*\*/g, "").trim();
      context = contextFromHeading(text);
      blocks.push({ type: "heading", level, id: slugify(text), text, context });
      continue;
    }

    const callout = line.match(/^\[!(\w+)\]\s*(.*)$/);
    if (callout) {
      flushAll();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        body.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({
        type: "callout",
        variant: calloutVariant(callout[1]),
        title: callout[2] || callout[1],
        text: body.join(" "),
        context
      });
      continue;
    }

    if (line.includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1].trim())) {
      flushAll();
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "table", headers, rows, context });
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushLists();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      flushQuote();
      orderedList = [];
      unorderedList.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      flushQuote();
      unorderedList = [];
      orderedList.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushLists();
    flushQuote();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

export function extractArticleHeadings(content: string): ArticleHeading[] {
  return parseMarkdown(content)
    .filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading")
    .map((block) => ({
      id: block.id,
      level: block.level,
      text: block.text
    }));
}

function blockClass(block: Block) {
  return [
    "article-content-block",
    `article-block-${block.type}`,
    block.context ? `article-context-${block.context}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function InlineText({ text }: { text: string }) {
  return <>{text.replace(/\*\*/g, "")}</>;
}

export default function ArticleBody({
  content,
  affiliateOffers = [],
  articleSlug = "",
  category = "",
  ctaExperiment
}: {
  content: string;
  affiliateOffers?: AffiliateOffer[];
  articleSlug?: string;
  category?: string;
  ctaExperiment?: RevenueExperimentPayload | null;
}) {
  const blocks = parseMarkdown(content);
  const paragraphIndexes = blocks
    .map((block, index) => (block.type === "paragraph" ? index : -1))
    .filter((index) => index >= 0);
  const afterFirstParagraphIndex = paragraphIndexes[0] ?? -1;
  const affiliateParagraphIndex = paragraphIndexes[1] ?? -1;
  const middleParagraphIndex =
    paragraphIndexes.length >= 6
      ? paragraphIndexes[Math.floor(paragraphIndexes.length / 2)]
      : -1;

  return (
    <div className="reader-article-body">
      {blocks.map((block, index) => (
        <div key={`${block.type}-${index}`} className={blockClass(block)}>
          {block.type === "heading" &&
            (block.level === 2 ? (
              <h2 id={block.id}>{block.text}</h2>
            ) : block.level === 3 ? (
              <h3 id={block.id}>{block.text}</h3>
            ) : (
              <h4 id={block.id}>{block.text}</h4>
            ))}

          {block.type === "paragraph" && (
            <p className={block.first ? "article-first-paragraph" : undefined}>
              <InlineText text={block.text} />
            </p>
          )}

          {block.type === "list" &&
            (block.ordered ? (
              <ol>
                {block.items.map((item) => (
                  <li key={item}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul>
                {block.items.map((item) => (
                  <li key={item}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            ))}

          {block.type === "table" && (
            <div className="article-table-wrap">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${row.join("-")}-${rowIndex}`}>
                      {block.headers.map((header, cellIndex) => (
                        <td key={`${header}-${cellIndex}`}>{row[cellIndex] || ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {block.type === "blockquote" && (
            <blockquote>
              <InlineText text={block.text} />
            </blockquote>
          )}

          {block.type === "code" && (
            <pre>
              <code>{block.code}</code>
            </pre>
          )}

          {block.type === "callout" && (
            <aside className={`article-callout article-callout-${block.variant}`}>
              <strong>{block.title}</strong>
              <p>{block.text}</p>
            </aside>
          )}

          {index === afterFirstParagraphIndex && (
            <AdSlot position="in-article" className="article-inline-ad article-inline-ad-first" />
          )}
          {index === middleParagraphIndex && middleParagraphIndex !== afterFirstParagraphIndex && (
            <AdSlot position="between-paragraphs" className="article-inline-ad article-inline-ad-mid" />
          )}
          {index === affiliateParagraphIndex && affiliateOffers.length > 0 && (
            <AffiliateBlock
              offers={affiliateOffers}
              articleSlug={articleSlug}
              category={category}
              ctaExperiment={ctaExperiment}
            />
          )}
        </div>
      ))}
    </div>
  );
}
