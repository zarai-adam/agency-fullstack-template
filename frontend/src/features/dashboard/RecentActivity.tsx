import { Badge } from "../../components/ui/Badge";
import type { DemoActivity } from "./demoData";

type RecentActivityProps = {
  items: DemoActivity[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <section className="card" aria-labelledby="activity-heading">
      <div className="section-heading">
        <h2 id="activity-heading">Recent activity</h2>
        <Badge tone="demo">Demo data</Badge>
      </div>
      <p className="section-note">
        Example entries to show the layout. These events did not happen.
      </p>

      <ul className="activity-list">
        {items.map((item) => (
          <li key={item.id} className="activity-list__item">
            <div>
              <p className="activity-list__title">{item.title}</p>
              <p className="activity-list__detail">{item.detail}</p>
            </div>
            <span className="activity-list__time">{item.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
