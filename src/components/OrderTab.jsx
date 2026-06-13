import { Minus, Phone, Plus, RotateCcw, Save, Search, User, X } from "lucide-react";

import { money } from "../helpers/format";

import { getProductPrice, normalizeProduct } from "../helpers/product";

import { CustomerPicker } from "./CustomerPicker";

import { PaymentStatusControl } from "./Payment";

import { ZoomableProductVisual } from "./ProductMedia";

export function OrderTab({
  amountPaid,
  bump,
  clearSelectedCustomer,
  clearOrder,
  customer,
  deleteSelectedCustomer,
  editingInvoiceId,
  filteredCustomerCount,
  filteredCustomers,
  filteredProducts,
  handleExactQty,
  invoices,
  isSearchingCustomers,
  lines,
  orderAmountPaid,
  orderBalanceDue,
  orderPriceType,
  orderNote,
  openCustomerInvoice,
  paymentStatus,
  phone,
  qty,
  saveInvoice,
  searchOrder,
  selectCustomer,
  selectedCustomerSummary,
  setCustomer,
  setOrderNote,
  setOrderPaidStatus,
  setOrderPriceType,
  setPhone,
  setSearchOrder,
  total,
  updateAmountPaid,
}) {
  const editingNumber = invoices.find((invoice) => invoice.id === editingInvoiceId)?.number;

  return (
    <section className="section">
      {editingInvoiceId && (
        <div className="status-banner">
          <span>Editing invoice #{editingNumber}</span>
          <button className="ghost-btn" onClick={clearOrder} type="button">
            <X size={18} />
            Cancel
          </button>
        </div>
      )}

      <div className="order-grid">
        <div className="panel">
          <h2 className="section-title">
            {editingInvoiceId ? "Edit Order" : "New Order"}
          </h2>
          <div className="price-mode-row" role="group" aria-label="Price type">
            {[
              { id: "retail", label: "Retail" },
              { id: "wholesale", label: "Wholesale" },
            ].map((mode) => (
              <button
                className={`segmented-btn ${
                  orderPriceType === mode.id ? "active" : ""
                }`}
                key={mode.id}
                onClick={() => setOrderPriceType(mode.id)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="input-icon">
              <User size={18} />
              <input
                className="input with-icon"
                onChange={(event) => setCustomer(event.target.value)}
                placeholder="Customer name"
                value={customer}
              />
            </label>
            <label className="input-icon">
              <Phone size={18} />
              <input
                className="input with-icon"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                value={phone}
              />
            </label>
          </div>
          <CustomerPicker
            clearSelectedCustomer={clearSelectedCustomer}
            deleteSelectedCustomer={deleteSelectedCustomer}
            customers={filteredCustomers}
            isSearchingCustomers={isSearchingCustomers}
            openCustomerInvoice={openCustomerInvoice}
            selectCustomer={selectCustomer}
            selectedCustomerSummary={selectedCustomerSummary}
            totalCustomerCount={filteredCustomerCount}
          />
          <textarea
            className="textarea order-note"
            onChange={(event) => setOrderNote(event.target.value)}
            placeholder="Order note"
            value={orderNote}
          />
          <label className="input-icon search-input">
            <Search size={18} />
            <input
              className="input with-icon"
              onChange={(event) => setSearchOrder(event.target.value)}
              placeholder="Search menu"
              value={searchOrder}
            />
          </label>

          <div className="menu-grid order-products">
            {filteredProducts.map((product) => (
              <ProductOrderCard
                bump={bump}
                handleExactQty={handleExactQty}
                product={product}
                priceType={orderPriceType}
                qty={qty[product.id] || 0}
                key={product.id}
              />
            ))}
          </div>
        </div>

        <aside className="panel order-summary">
          <h2 className="section-title">Cart</h2>
          {lines.length ? (
            <>
              <div className="summary-list">
                {lines.map((line) => (
                  <div className="summary-line" key={line.id}>
                    <div>
                      <div className="summary-name">{line.name}</div>
                      <div className="summary-meta">
                        {line.q} × {money(line.price)}
                      </div>
                    </div>
                    <div className="summary-amount">{money(line.line)}</div>
                  </div>
                ))}
              </div>
              <div className="total-row">
                <span>Total</span>
                <span className="total-value">{money(total)}</span>
              </div>
              <PaymentStatusControl
                amountPaid={amountPaid}
                balanceDue={orderBalanceDue}
                onAmountPaidChange={updateAmountPaid}
                paymentStatus={paymentStatus}
                setPaymentStatus={setOrderPaidStatus}
                paidAmount={orderAmountPaid}
                total={total}
              />
              <div className="button-row summary-actions">
                <button className="secondary-btn" onClick={clearOrder} type="button">
                  <RotateCcw size={18} />
                  Clear
                </button>
                <button className="primary-btn" onClick={saveInvoice} type="button">
                  <Save size={18} />
                  {editingInvoiceId ? "Update" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state compact">
              <div className="empty-icon">🧾</div>
              <strong>No items selected</strong>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ProductOrderCard({ bump, handleExactQty, priceType, product, qty }) {
  const normalized = normalizeProduct(product);
  const activePrice = getProductPrice(normalized, priceType);

  return (
    <article className="product-card">
      <ZoomableProductVisual
        emoji={normalized.emoji}
        label={normalized.name}
        photo={normalized.photo}
        zoomPhoto={normalized.photoZoom}
      />
      <div>
        <div className="product-name">{normalized.name}</div>
        <div className="product-price">{money(activePrice)}</div>
      </div>
      <div className="qty-row">
        <button
          aria-label={`Decrease ${normalized.name}`}
          className="qty-btn decrease"
          onClick={() => bump(normalized.id, -1)}
          type="button"
        >
          <Minus size={20} />
        </button>
        <input
          className="qty-input"
          inputMode="numeric"
          min="0"
          onChange={(event) => handleExactQty(normalized.id, event.target.value)}
          type="number"
          value={qty || ""}
          placeholder="0"
        />
        <button
          aria-label={`Increase ${normalized.name}`}
          className="qty-btn"
          onClick={() => bump(normalized.id, 1)}
          type="button"
        >
          <Plus size={20} />
        </button>
      </div>
    </article>
  );
}
