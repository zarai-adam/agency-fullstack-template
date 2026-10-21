export type NavItem = {
  id: string;
  label: string;
  // Only sections with a real page are "available". The rest are shown
  // as placeholders so the sidebar never pretends a page exists.
  available: boolean;
};

export const navItems: NavItem[] = [
  { id: "overview", label: "Overview", available: true },
  { id: "projects", label: "Projects", available: false },
  { id: "clients", label: "Clients", available: false },
  { id: "ai-tools", label: "AI Tools", available: false },
  { id: "automations", label: "Automations", available: false },
  { id: "settings", label: "Settings", available: false },
];
