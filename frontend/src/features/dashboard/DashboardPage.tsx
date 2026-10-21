import { DashboardHeader } from "../../components/layout/DashboardHeader";
import { Badge } from "../../components/ui/Badge";
import { StatCard } from "../../components/ui/StatCard";
import { HealthCheck } from "../health/HealthCheck";
import { CreateProjectForm } from "../projects/CreateProjectForm";
import { RecentProjects } from "../projects/RecentProjects";
import { useProjects, type ProjectsState } from "../projects/useProjects";
import { demoActivity, demoStats } from "./demoData";
import { RecentActivity } from "./RecentActivity";

// What a live project card shows in each loading state.
function projectStat(state: ProjectsState, count: number) {
  if (state.status === "loading") {
    return { value: "…", description: "Loading from the API" };
  }
  if (state.status === "error") {
    return { value: "—", description: "Unavailable: could not reach the API" };
  }
  return { value: String(count), description: "From the projects API" };
}

export function DashboardPage() {
  const { state: projects, reload } = useProjects();

  const list = projects.status === "success" ? projects.projects : [];
  const activeCount = list.filter((project) => project.status === "active")
    .length;
  const total = projectStat(projects, list.length);
  const active = projectStat(projects, activeCount);

  return (
    // tabIndex={-1} lets the skip link and sidebar link move focus here.
    <main id="main-content" className="dashboard-main" tabIndex={-1}>
      <DashboardHeader
        title="Overview"
        subtitle="A summary of your agency workspace."
        profileName="Demo User"
        profileRole="Demo profile (no sign-in yet)"
      />

      <section aria-labelledby="metrics-heading">
        <div className="section-heading">
          <h2 id="metrics-heading">Key metrics</h2>
        </div>
        <p className="section-note">
          Cards marked Live come from the projects API. Cards marked Demo data
          are sample values for the layout and are not loaded from the backend.
        </p>

        <div className="stat-grid">
          <StatCard
            label="Total Projects"
            value={total.value}
            description={total.description}
            badge={<Badge tone="live">Live</Badge>}
          />
          <StatCard
            label="Active Projects"
            value={active.value}
            description={active.description}
            badge={<Badge tone="live">Live</Badge>}
          />
          {demoStats.map((stat) => (
            <StatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              description={stat.description}
              badge={<Badge tone="demo">Demo data</Badge>}
            />
          ))}
        </div>
      </section>

      <div className="dashboard-columns">
        <RecentProjects state={projects} onRetry={reload} onChanged={reload} />
        <CreateProjectForm onCreated={reload} />
      </div>

      <div className="dashboard-columns">
        <RecentActivity items={demoActivity} />

        <section className="card" aria-labelledby="status-heading">
          <div className="section-heading">
            <h2 id="status-heading">System status</h2>
            <Badge tone="live">Live check</Badge>
          </div>
          <p className="section-note">
            Calls the backend health endpoint when the page loads.
          </p>
          <div className="status-result">
            <HealthCheck />
          </div>
        </section>
      </div>
    </main>
  );
}
