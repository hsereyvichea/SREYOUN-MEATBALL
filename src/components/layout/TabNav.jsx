import { Calculator, CalendarDays, ReceiptText, Settings, ShoppingCart, Utensils } from "lucide-react";
import { usePosContext } from "../../context/PosContext";

const TABS = [
  { id: "order", label: "Order", icon: ShoppingCart },
  { id: "menu", label: "Menu", icon: Utensils },
  { id: "history", label: "Invoices", icon: ReceiptText },
  { id: "reports", label: "Reports", icon: CalendarDays },
  { id: "calc", label: "Calc", icon: Calculator },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function TabNav() {
  const { tab, selectTab, lines, invoices } = usePosContext();

  return (
    <nav className="tabs no-print" aria-label="Main sections">
      {TABS.map(({ id, label, icon: Icon }) => {
        const badge = id === "order" ? lines.length : id === "history" ? invoices.length : null;
        return (
          <button
            key={id}
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => selectTab(id)}
            type="button"
          >
            <Icon size={18} />
            <span>{label}</span>
            {badge ? <span className="badge">{badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
