import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, MessageSquareText, Phone, RotateCcw, ShoppingCart, Trash2, User, X } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import CustomerPicker from "../shared/CustomerPicker";
import PaymentControl from "./PaymentControl";

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

export default function CartPanel({ placement = "side" }) {
  const {
    lines, total, clearOrder, saveInvoice, editingInvoiceId,
    customer, setCustomer, phone, setPhone, orderNote, setOrderNote,
    cartLineEdits, updateCartLineName, updateCartLinePrice,
    handleExactQty,
  } = usePosContext();
  const [cartOpen, setCartOpen] = useState(false);
  const [qtyDrafts, setQtyDrafts] = useState({});
  const itemCount = lines.reduce((sum, line) => sum + Number(line.q || 0), 0);

  useEffect(() => {
    setQtyDrafts(prev => {
      const activeIds = new Set(lines.map(line => line.id));
      let changed = false;
      const next = {};

      Object.entries(prev).forEach(([id, value]) => {
        if (activeIds.has(id)) next[id] = value;
        else changed = true;
      });

      return changed ? next : prev;
    });
  }, [lines]);

  useEffect(() => {
    if (!cartOpen || typeof document === "undefined") return undefined;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previous = {
      bodyLeft: bodyStyle.left,
      bodyOverflow: bodyStyle.overflow,
      bodyPosition: bodyStyle.position,
      bodyRight: bodyStyle.right,
      bodyTop: bodyStyle.top,
      bodyWidth: bodyStyle.width,
      htmlOverflow: htmlStyle.overflow,
    };

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";

    return () => {
      htmlStyle.overflow = previous.htmlOverflow;
      bodyStyle.overflow = previous.bodyOverflow;
      bodyStyle.position = previous.bodyPosition;
      bodyStyle.top = previous.bodyTop;
      bodyStyle.left = previous.bodyLeft;
      bodyStyle.right = previous.bodyRight;
      bodyStyle.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [cartOpen]);

  const updateCartQty = (id, value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    setQtyDrafts(prev => ({ ...prev, [id]: digits }));

    if (digits === "") return;
    handleExactQty(id, digits);
  };

  const finishCartQtyEdit = (id) => {
    setQtyDrafts(prev => {
      if (!hasOwn(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cartTitle = editingInvoiceId ? "Edit Cart" : "Cart";
  const cartOverlay = (
    <>
      <button
        aria-label="Close cart"
        className={`cart-scrim no-print ${cartOpen ? "is-open" : ""}`}
        onClick={() => setCartOpen(false)}
        tabIndex={cartOpen ? 0 : -1}
        type="button"
      />

      <aside className={`panel order-summary cart-sheet ${cartOpen ? "is-open" : ""}`}>
        <div className="cart-sheet-head">
          <h2 className="section-title">{cartTitle}</h2>
          <button className="icon-btn cart-close no-print" onClick={() => setCartOpen(false)} type="button" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {lines.length ? (
          <>
            <div className="cart-customer-fields">
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

              <label className="input-icon order-note-field">
                <MessageSquareText size={18} />
                <textarea className="textarea with-icon order-note" onChange={(e) => setOrderNote(e.target.value)} placeholder="Order note" value={orderNote} />
              </label>
            </div>

            <div className="summary-list">
              {lines.map((line) => {
                const edit = cartLineEdits[line.id] || {};
                const nameValue = hasOwn(edit, "name") ? edit.name : line.name;
                const priceValue = hasOwn(edit, "price") ? edit.price : String(line.price);

                return (
                  <div className="summary-line cart-line-editor" key={line.id}>
                    <div className="cart-line-fields">
                      <label className="cart-line-field">
                        <span>Name</span>
                        <input
                          aria-label={`Edit name for ${line.name}`}
                          className="input cart-line-input"
                          onChange={(e) => updateCartLineName(line.id, e.target.value)}
                          type="text"
                          value={nameValue}
                        />
                      </label>
                      <label className="cart-line-field cart-line-qty-field">
                        <span>Qty</span>
                        <input
                          aria-label={`Edit quantity for ${line.name}`}
                          className="input cart-line-input"
                          inputMode="numeric"
                          min="0"
                          onBlur={() => finishCartQtyEdit(line.id)}
                          onChange={(e) => updateCartQty(line.id, e.target.value)}
                          type="text"
                          value={hasOwn(qtyDrafts, line.id) ? qtyDrafts[line.id] : String(line.q || "")}
                        />
                      </label>
                      <label className="cart-line-field cart-line-price-field">
                        <span>Price</span>
                        <input
                          aria-label={`Edit price for ${line.name}`}
                          className="input cart-line-input"
                          inputMode="decimal"
                          onChange={(e) => updateCartLinePrice(line.id, e.target.value)}
                          type="text"
                          value={priceValue}
                        />
                      </label>
                      <button
                        aria-label={`Clear ${line.name} from cart`}
                        className="icon-btn cart-line-remove no-print"
                        onClick={() => handleExactQty(line.id, "0")}
                        title="Clear item"
                        type="button"
                      >
                        <Trash2 size={17} />
                      </button>
                      <div className="summary-meta">{line.q} {"\u00d7"} {money(line.price)} each</div>
                    </div>
                    <div className="summary-amount">{money(line.line)}</div>
                  </div>
                );
              })}
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
                <ArrowRight size={18} /> {editingInvoiceId ? "Update" : "Proceed"}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state compact">
            <div className="empty-icon">{"\ud83e\uddfe"}</div>
            <strong>No items selected</strong>
            <span>Add products from the order screen.</span>
          </div>
        )}
      </aside>
    </>
  );
  const shouldPortalOverlay = placement === "topbar" && typeof document !== "undefined";

  return (
    <div className={`cart-host cart-host-${placement}`}>
      <button className="cart-fab no-print" onClick={() => setCartOpen(true)} type="button">
        <span className="cart-fab-icon">
          <ShoppingCart size={20} />
          <b>{itemCount}</b>
        </span>
        <span className="cart-fab-label">
          <strong>{cartTitle}</strong>
          <em>{itemCount} {itemCount === 1 ? "item" : "items"}</em>
        </span>
      </button>

      {shouldPortalOverlay ? createPortal(cartOverlay, document.body) : cartOverlay}
    </div>
  );
}
