import type { NavItem } from "../../features/dashboard/navigation";
import { Badge } from "../ui/Badge";

type SidebarProps = {
  items: NavItem[];
  activeId: string;
};

export function Sidebar({ items, activeId }: SidebarProps) {
  return (
    <aside className="sidebar">
      <p className="sidebar__brand">AI Agency</p>

      <nav aria-label="Main navigation">
        <ul className="sidebar__list">
          {items.map((item) => (
            <li key={item.id}>
              {item.available ? (
                <a
                  className="sidebar__link"
                  href="#main-content"
                  aria-current={item.id === activeId ? "page" : undefined}
                >
                  {item.label}
                </a>
              ) : (
                // Not a link or button: this page does not exist yet.
                <span className="sidebar__link sidebar__link--placeholder">
                  {item.label}
                  <Badge>Coming soon</Badge>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <p className="sidebar__note">
        Sections marked “Coming soon” are placeholders and are not built yet.
      </p>
    </aside>
  );
}
