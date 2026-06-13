import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";

export default function TopBar() {
  const { settings, todaySales, todayInvoices } = usePosContext();

  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark">🧆</div>
          <div>
            <div className="brand-title">SREYOUN MEATBALL</div>
            <div className="brand-subtitle">{settings.khmerName}</div>
          </div>
        </div>
        <div className="sales-chip" aria-label="Today sales">
          <div className="sales-chip-label">Today</div>
          <div className="sales-chip-value">{money(todaySales)}</div>
          <div className="sales-chip-meta">
            {todayInvoices.length} {todayInvoices.length === 1 ? "order" : "orders"}
          </div>
        </div>
      </div>
    </header>
  );
}
