import type { ReactNode } from "react";

/** A large figure with a label and a short explanation. `tone` colours the figure (data colours only). */
export function StatCard({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "sun" | "earth" | "ok" | "warn" }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
