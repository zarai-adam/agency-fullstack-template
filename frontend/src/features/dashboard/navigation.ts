import { routeHrefs, type Route } from "../../lib/useHashRoute";

export type NavItem =
  // A section with a real page: rendered as a link.
  | { id: Route; label: string; available: true; href: string }
  // A placeholder, shown so the sidebar never pretends a page exists.
  | { id: string; label: string; available: false };

export const navItems: NavItem[] = [
  { id: "overview", label: "Overview", available: true, href: routeHrefs.overview },
  { id: "projects", label: "Projects", available: true, href: routeHrefs.projects },
  { id: "clients", label: "Clients", available: false },
  { id: "ai-tools", label: "AI Tools", available: false },
  { id: "automations", label: "Automations", available: false },
  { id: "settings", label: "Settings", available: false },
];
