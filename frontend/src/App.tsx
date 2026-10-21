import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { navItems } from "./features/dashboard/navigation";
import "./App.css";

function App() {
  return (
    <>
      {/* Lets keyboard users jump past the sidebar straight to the content. */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="app-shell">
        <Sidebar items={navItems} activeId="overview" />
        <DashboardPage />
      </div>
    </>
  );
}

export default App;
