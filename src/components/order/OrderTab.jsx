import { Search, Phone, User, X } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import CustomerPicker from "../shared/CustomerPicker";
import ProductOrderCard from "./ProductOrderCard";
import CartPanel from "./CartPanel";

export default function OrderTab() {
  const {
    editingInvoiceId, clearOrder, invoices,
    customer, setCustomer, phone, setPhone,
    orderNote, setOrderNote,
    searchOrder, setSearchOrder,
    filteredOrderProducts, orderPriceType, setOrderPriceType,
  } = usePosContext();

  const editingNumber = invoices.find((i) => i.id === editingInvoiceId)?.number;

  return (
    <section className="section">
      {editingInvoiceId && (
        <div className="status-banner">
          <span>Editing invoice #{editingNumber}</span>
          <button className="ghost-btn" onClick={clearOrder} type="button">
            <X size={18} /> Cancel
          </button>
        </div>
      )}

      <div className="order-grid">
        <div className="panel">
          <h2 className="section-title">{editingInvoiceId ? "Edit Order" : "New Order"}</h2>

          <div className="price-mode-row" role="group" aria-label="Price type">
            {["retail", "wholesale"].map((mode) => (
              <button
                key={mode}
                className={`segmented-btn ${orderPriceType === mode ? "active" : ""}`}
                onClick={() => setOrderPriceType(mode)}
                type="button"
              >
                {mode === "retail" ? "Retail" : "Wholesale"}
              </button>
            ))}
          </div>

          <div className="field-grid">
            <label className="input-icon">
              <User size={18} />
              <input className="input with-icon" onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" value={customer} />
            </label>
            <label className="input-icon">
              <Phone size={18} />
              <input className="input with-icon" onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" value={phone} />
            </label>
          </div>

          <CustomerPicker />

          <textarea className="textarea order-note" onChange={(e) => setOrderNote(e.target.value)} placeholder="Order note" value={orderNote} />

          <label className="input-icon search-input">
            <Search size={18} />
            <input className="input with-icon" onChange={(e) => setSearchOrder(e.target.value)} placeholder="Search menu" value={searchOrder} />
          </label>

          <div className="menu-grid order-products">
            {filteredOrderProducts.map((product) => (
              <ProductOrderCard key={product.id} product={product} priceType={orderPriceType} />
            ))}
          </div>
        </div>

        <CartPanel />
      </div>
    </section>
  );
}
