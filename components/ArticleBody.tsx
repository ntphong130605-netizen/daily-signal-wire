import AdSlot from "@/components/ads/AdSlot";

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseMarkdown(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(3) });
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      paragraph.push(line.replace(/\*\*/g, ""));
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export default function ArticleBody({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  const inArticleIndex = blocks.length >= 8 ? 5 : -1;

  return (
    <div className="reader-article-body">
      {blocks.map((block, index) => (
        <div key={`${block.type}-${index}`}>
          {index === inArticleIndex && <AdSlot position="in-article" />}
          {block.type === "heading" && <h2>{block.text}</h2>}
          {block.type === "paragraph" && <p>{block.text}</p>}
          {block.type === "list" && (
            <ul>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
