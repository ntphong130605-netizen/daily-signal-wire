import Link from "next/link";
import {
  ContentPlannerBoard,
  GeneratePlanButton
} from "@/components/AdminGrowthActions";
import { parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export default async function AdminPlannerPage() {
  const now = new Date();
  const data = await safeDbQuery(
    "admin_planner_query_failed",
    {
      items: [] as {
        id: string;
        topic: string;
        category: string;
        status: string;
        priority: number;
        plannedFor: Date;
        timezone: string;
        sourceType: string;
        angle: string | null;
        targetKeywords: string;
      }[],
      statusCounts: [] as { status: string; _count: { _all: number } }[]
    },
    async () => {
      const [items, statusCounts] = await Promise.all([
        prisma.contentPlanItem.findMany({
          where: { plannedFor: { gte: new Date(now.getTime() - 24 * 36e5) } },
          orderBy: [{ plannedFor: "asc" }, { priority: "asc" }],
          take: 120
        }),
        prisma.contentPlanItem.groupBy({
          by: ["status"],
          _count: { _all: true }
        })
      ]);
      return { items, statusCounts };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">AI Content Planner</p>
          <h1>Publishing Calendar</h1>
          <p>
            Plan coverage from Google Trends, evergreen topics, breaking-news
            balance and category mix. Drag stories across days to reschedule.
          </p>
        </div>
        <GeneratePlanButton days={7} />
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid compact">
          {data.statusCounts.length === 0 ? (
            <div>
              <span>Plan status</span>
              <strong>0</strong>
              <small>No calendar items yet</small>
            </div>
          ) : (
            data.statusCounts.map((row) => (
              <div key={row.status}>
                <span>{row.status}</span>
                <strong>{row._count._all}</strong>
                <small>calendar items</small>
              </div>
            ))
          )}
        </section>

        <section className="panel planner-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Next seven days</p>
              <h2>Editorial schedule</h2>
            </div>
            <Link href="/admin/trends" className="source-pill">
              Trend queue →
            </Link>
          </div>
          {data.items.length === 0 ? (
            <div className="empty-state">
              <h3>No publishing plan yet</h3>
              <p>Generate a schedule to create source-first story assignments.</p>
            </div>
          ) : (
            <ContentPlannerBoard
              items={data.items.map((item) => ({
                id: item.id,
                topic: item.topic,
                category: item.category,
                status: item.status,
                priority: item.priority,
                plannedFor: item.plannedFor.toISOString(),
                timezone: item.timezone,
                targetKeywords: parseStringArray(item.targetKeywords)
              }))}
            />
          )}
        </section>

        <section className="panel planner-brief-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2>Upcoming story briefs</h2>
            </div>
          </div>
          {data.items.length === 0 ? (
            <div className="empty-state compact">
              <h3>No assignments</h3>
              <p>Planner output will show topic, angle, source and target keywords.</p>
            </div>
          ) : (
            <div className="growth-table">
              <div className="growth-table-head">
                <span>Time</span>
                <span>Topic</span>
                <span>Source</span>
                <span>Priority</span>
              </div>
              {data.items.slice(0, 20).map((item) => (
                <article key={item.id} className="growth-table-row">
                  <time>{formatDate(item.plannedFor)}</time>
                  <div>
                    <strong>{item.topic}</strong>
                    <small>{item.angle || "No angle saved yet."}</small>
                    <small>
                      Keywords: {parseStringArray(item.targetKeywords).join(", ") || item.topic}
                    </small>
                  </div>
                  <span>{item.sourceType}</span>
                  <span>P{item.priority}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
