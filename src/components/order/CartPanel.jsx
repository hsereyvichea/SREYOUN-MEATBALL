import { RotateCcw, Save } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import PaymentControl from "./PaymentControl";

export default function CartPanel() {
  const { lines, total, clearOrder, saveInvoice, editingInvoiceId } = usePosContext();

  if (!lines.length) {
    return (
      <aside className="panel order-summary">
        <h2 className="section-title">Cart</h2>
        <div className="empty-state compact">
          <div className="empty-icon">🧾</div>
          <strong>No items selected</strong>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel order-summary">
      <h2 className="section-title">Cart</h2>
      <div className="summary-list">
        {lines.map((line) => (
          <div className="summary-line" key={line.id}>
            <div>
              <div className="summary-name">{line.name}</div>
              <div className="summary-meta">{line.q} × {money(line.price)}</div>
            </div>
            <div className="summary-amount">{money(line.line)}</div>
          </div>
        ))}
      </div>
      <div className="total-row">
        <span>Total</span>
        <span className="total-value">{money(total)}</span>
      </div>
      <PaymentControl />
      <div className="button-row summary-actions">
        <button className="secondary-btn" onClick={clearOrder} type="button">
          <RotateCcw size={18} /> Clear
        </button>
        <button className="primary-btn" onClick={saveInvoice} type="button">
          <Save size={18} /> {editingInvoiceId ? "Update" : "Save"}
        </button>
      </div>
    </aside>
  );
}
