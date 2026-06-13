import { FileDown, ImageDown, Pencil, Printer, Search, Share2, Trash2, Wifi, X } from "lucide-react";

import { money } from "../helpers/format";

import { invoicePaymentStatus, normalizeInvoice } from "../helpers/invoice";

import { invoiceOriginLabel } from "../helpers/sync";

import { OriginBadge, PaymentStatusBadge, PriceTypeBadge } from "./Payment";

import { Receipt } from "./Receipt";

export function HistoryTab({
  deleteInvoice,
  invoiceCount,
  invoices,
  printReceipt,
  receiptRef,
  saveReceiptPdf,
  saveReceiptPhoto,
  searchInvoices,
  sendSelectedInvoiceOverWifi,
  selectedInv,
  setSelectedInvId,
  setSearchInvoices,
  shareReceipt,
  settings,
  startEditInvoice,
  updateInvoicePaymentStatus,
}) {
  if (selectedInv) {
    const normalizedInvoice = normalizeInvoice(selectedInv);
    const selectedStatus = invoicePaymentStatus(normalizedInvoice);
    const nextStatus = selectedStatus === "paid" ? "unpaid" : "paid";

    return (
      <section className="section invoice-detail-section">
        <div className="invoice-detail-toolbar no-print">
          <button
            className="secondary-btn compact-btn"
            onClick={() => setSelectedInvId(null)}
            type="button"
          >
            <X size={16} />
            Back
          </button>
          <div className="invoice-detail-title">
            <span>Invoice #{selectedInv.number}</span>
            <strong>{selectedInv.customer || "Walk-in"}</strong>
            <em>{selectedInv.date}</em>
          </div>
          <div className="invoice-detail-badges">
            <PaymentStatusBadge invoice={normalizedInvoice} />
            <PriceTypeBadge invoice={normalizedInvoice} />
            <OriginBadge invoice={normalizedInvoice} />
          </div>
        </div>
        <div className={`invoice-status-panel ${selectedStatus} no-print`}>
          <div>
            <span>Payment Status</span>
            <strong>{selectedStatus === "paid" ? "Paid" : "Unpaid"}</strong>
            <div className="invoice-origin-line">
              {invoiceOriginLabel(normalizedInvoice)}
            </div>
          </div>
          <div className="invoice-payment-summary">
            <div>
              <span>Total</span>
              <strong>{money(normalizedInvoice.total)}</strong>
            </div>
            <div>
              <span>ប្រាក់បានបង់</span>
              <strong>{money(normalizedInvoice.amountPaid)}</strong>
            </div>
            <div>
              <span>ប្រាក់នៅសល់</span>
              <strong>{money(normalizedInvoice.balanceDue)}</strong>
            </div>
          </div>
          <button
            className="secondary-btn"
            onClick={() => updateInvoicePaymentStatus(selectedInv.id, nextStatus)}
            type="button"
          >
            Mark {nextStatus === "paid" ? "Paid" : "Unpaid"}
          </button>
        </div>
        <div className="invoice-action-grid no-print history-actions">
          <button
            className="danger-btn compact-btn"
            onClick={() => deleteInvoice(selectedInv.id)}
            type="button"
          >
            <Trash2 size={18} />
            Delete
          </button>
          <button
            className="secondary-btn compact-btn"
            onClick={() => startEditInvoice(selectedInv)}
            type="button"
          >
            <Pencil size={18} />
            Edit
          </button>
          <button className="primary-btn compact-btn" onClick={shareReceipt} type="button">
            <Share2 size={18} />
            Share
          </button>
          <button
            className="secondary-btn compact-btn"
            onClick={sendSelectedInvoiceOverWifi}
            type="button"
          >
            <Wifi size={18} />
            WiFi
          </button>
          <button className="secondary-btn compact-btn" onClick={saveReceiptPhoto} type="button">
            <ImageDown size={18} />
            Photo
          </button>
          <button className="secondary-btn compact-btn" onClick={saveReceiptPdf} type="button">
            <FileDown size={18} />
            PDF
          </button>
          <button className="primary-btn compact-btn" onClick={printReceipt} type="button">
            <Printer size={18} />
            Print
          </button>
        </div>
        <div className="receipt-capture" ref={receiptRef}>
          <Receipt invoice={selectedInv} settings={settings} />
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Recent Invoices</h2>
        <label className="input-icon search-input invoice-search">
          <Search size={18} />
          <input
            className="input with-icon"
            onChange={(event) => setSearchInvoices(event.target.value)}
            placeholder="Search #, customer, phone, date, paid, unpaid, retail, wholesale"
            value={searchInvoices}
          />
        </label>
        {invoiceCount ? (
          <div className="history-results-meta">
            Showing {invoices.length} of {invoiceCount} invoices
          </div>
        ) : null}
        {invoices.length ? (
          <div className="invoice-list">
            {invoices.map((invoice) => (
              <button
                className="invoice-row"
                key={invoice.id}
                onClick={() => setSelectedInvId(invoice.id)}
                type="button"
              >
                <div>
                  <div className="invoice-number">
                    #{invoice.number} · {invoice.customer || "Walk-in"}{" "}
                    <PaymentStatusBadge invoice={invoice} />
                    <PriceTypeBadge invoice={invoice} />
                    <OriginBadge invoice={invoice} />
                  </div>
                  <div className="invoice-meta">
                    {invoice.date} at {invoice.time}
                    {invoice.phone ? ` · ${invoice.phone}` : ""}
                  </div>
                </div>
                <div className="invoice-total-block">
                  <div className="invoice-total">{money(invoice.total)}</div>
                  <div className="invoice-balance">
                    នៅសល់ {money(normalizeInvoice(invoice).balanceDue)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <strong>{invoiceCount ? "No matching invoices" : "No invoices yet"}</strong>
          </div>
        )}
      </div>
    </section>
  );
}
