// DEMO DATA ONLY.
// Everything in this file is hard-coded sample content used to build the
// dashboard layout. None of it comes from the backend. Replace it with real
// API calls in a later milestone. (Project numbers are already real: see
// features/projects.)

export type DemoStat = {
  id: string;
  label: string;
  value: string;
  description: string;
};

export const demoStats: DemoStat[] = [
  {
    id: "clients",
    label: "Active Clients",
    value: "12",
    description: "Sample value",
  },
  {
    id: "automations",
    label: "AI Automations",
    value: "8",
    description: "Sample value",
  },
  {
    id: "tasks",
    label: "Tasks Completed",
    value: "156",
    description: "Sample value",
  },
];

export type DemoActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
};

export const demoActivity: DemoActivity[] = [
  {
    id: "a1",
    title: "New project created",
    detail: "Website redesign for Example Client A",
    time: "2 hours ago",
  },
  {
    id: "a2",
    title: "Automation finished",
    detail: "Weekly report draft generated",
    time: "5 hours ago",
  },
  {
    id: "a3",
    title: "Client added",
    detail: "Example Client B joined the workspace",
    time: "Yesterday",
  },
  {
    id: "a4",
    title: "Task completed",
    detail: "Landing page copy approved",
    time: "2 days ago",
  },
];
