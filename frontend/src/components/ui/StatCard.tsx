import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  description?: string;
  // Shows where the number comes from, e.g. a "Live" or "Demo data" badge.
  badge?: ReactNode;
};

export function StatCard({ label, value, description, badge }: StatCardProps) {
  return (
    <article className="card stat-card">
      <div className="stat-card__header">
        <h3 className="stat-card__label">{label}</h3>
        {badge}
      </div>
      <p className="stat-card__value">{value}</p>
      {description && <p className="stat-card__description">{description}</p>}
    </article>
  );
}
