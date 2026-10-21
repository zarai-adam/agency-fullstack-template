import { useEffect, useRef, type MouseEvent } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { navItems } from "./features/dashboard/navigation";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { useHashRoute, type Route } from "./lib/useHashRoute";
import "./App.css";

const pageTitles: Record<Route, string> = {
  overview: "Overview",
  projects: "Projects",
};

function focusMainContent() {
  document.getElementById("main-content")?.focus();
}

function App() {
  const route = useHashRoute();
  const previousRoute = useRef(route);

  useEffect(() => {
    document.title = `${pageTitles[route]} · AI Agency Dashboard`;

    // After switching pages, move focus to the new page's content so
    // keyboard and screen-reader users start at the top of it.
    if (previousRoute.current !== route) {
      previousRoute.current = route;
      focusMainContent();
    }
  }, [route]);

  // The hash is used for pages, so the skip link moves focus directly
  // instead of changing the hash to "#main-content".
  function handleSkipLink(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    focusMainContent();
  }

  return (
    <>
      {/* Lets keyboard users jump past the sidebar straight to the content. */}
      <a className="skip-link" href="#main-content" onClick={handleSkipLink}>
        Skip to main content
      </a>

      <div className="app-shell">
        <Sidebar items={navItems} activeId={route} />
        {route === "projects" ? <ProjectsPage /> : <DashboardPage />}
      </div>
    </>
  );
}

export default App;
