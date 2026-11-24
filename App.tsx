import type { ReactNode } from "react";
import { HashRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { StoreProvider, useStore } from "@/lib/store";
import { DialogsProvider } from "@/components/forms/DialogsProvider";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/Login";
import OverviewPage from "@/pages/Overview";
import AnimalsPage from "@/pages/Animals";
import AnimalProfilePage from "@/pages/AnimalProfile";
import CasesPage from "@/pages/Cases";
import CaseDetailPage from "@/pages/CaseDetail";
import HandoversPage from "@/pages/Handovers";
import TasksPage from "@/pages/Tasks";
import StaffPage from "@/pages/Staff";
import StaffProfilePage from "@/pages/StaffProfile";
import SchedulePage from "@/pages/Schedule";
import ActivityPage from "@/pages/Activity";
import SettingsPage from "@/pages/Settings";
import NotFoundPage from "@/pages/NotFound";

// Hosted previews run inside a sandboxed frame where the URL hash is reserved,
// so they use an in-memory router that remembers the last route for the tab.
function Router({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_ROUTER === "memory") {
    let initial = "/";
    try {
      initial = window.sessionStorage.getItem("carebase:route") || "/";
    } catch {
      /* ignore */
    }
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  }
  return <HashRouter>{children}</HashRouter>;
}

function Gate() {
  const { user } = useStore();
  if (!user) return <LoginPage />;
  return (
    <DialogsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="animals" element={<AnimalsPage />} />
          <Route path="animals/:id" element={<AnimalProfilePage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="handovers" element={<HandoversPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="staff/:id" element={<StaffProfilePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </DialogsProvider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Router>
        <Gate />
      </Router>
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: "Inter, system-ui, sans-serif" } }} />
    </StoreProvider>
  );
}
