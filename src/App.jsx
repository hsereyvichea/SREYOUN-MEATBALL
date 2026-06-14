import { PosProvider, usePosContext } from "./context/PosContext";
import TopBar from "./components/layout/TopBar";
import TabNav from "./components/layout/TabNav";
import OwnerModeBar from "./components/layout/OwnerModeBar";
import Toast from "./components/layout/Toast";
import OwnerUnlockModal from "./components/shared/OwnerUnlockModal";
import OrderTab from "./components/order/OrderTab";
import MenuTab from "./components/menu/MenuTab";
import HistoryTab from "./components/history/HistoryTab";
import ReportsTab from "./components/reports/ReportsTab";
import CalculatorTab from "./components/calc/CalculatorTab";
import SettingsTab from "./components/settings/SettingsTab";

const TABS = {
  order: OrderTab,
  menu: MenuTab,
  history: HistoryTab,
  reports: ReportsTab,
  calc: CalculatorTab,
  settings: SettingsTab,
};

function AppShell() {
  const { tab, loading } = usePosContext();

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page">
          <div className="empty-state">
            <div className="empty-icon">{"\ud83e\uddc6"}</div>
            <strong>Loading...</strong>
          </div>
        </main>
      </div>
    );
  }

  const ActiveTab = TABS[tab];

  return (
    <div className="app-shell">
      <Toast />
      <TopBar />
      <TabNav />
      <OwnerModeBar />
      <main className="page">
        <ActiveTab />
      </main>
      <OwnerUnlockModal />
    </div>
  );
}

export default function App() {
  return (
    <PosProvider>
      <AppShell />
    </PosProvider>
  );
}
