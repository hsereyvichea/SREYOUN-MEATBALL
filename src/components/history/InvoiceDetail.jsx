import { useState } from "react";
import { X } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import { normalizeInvoice, invoicePaymentStatus } from "../../helpers/invoice";
import { invoiceOriginLabel } from "../../helpers/sync";
import { PaymentStatusBadge, PriceTypeBadge, OriginBadge } from "../shared/PaymentBadges";
import { Receipt } from "../shared/Receipt";
import InvoiceActionBar from "./InvoiceActionBar";

export default function InvoiceDetail() {
  const { selectedInv, setSelectedInvId, updateInvoicePaymentStatus, settings, receiptRef } = usePosContext();
  const [previewOpen, setPreviewOpen] = useState(false);

  const normalizedInvoice = normalizeInvoice(selectedInv);
  const selectedStatus = invoicePaymentStatus(normalizedInvoice);
  const nextStatus = selectedStatus === "paid" ? "unpaid" : "paid";

  return (
    <section className="section invoice-detail-section">
      <div className="invoice-detail-toolbar no-print">
        <button className="secondary-btn compact-btn" onClick={() => setSelectedInvId(null)} type="button">
          <X size={16} /> Back
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
          <div className="invoice-origin-line">{invoiceOriginLabel(normalizedInvoice)}</div>
        </div>
        <div className="invoice-payment-summary">
          <div><span>Total</span><strong>{money(normalizedInvoice.total)}</strong></div>
          <div><span>ប្រាក់បានបង់</span><strong>{money(normalizedInvoice.amountPaid)}</strong></div>
          <div><span>ប្រាក់នៅសល់</span><strong>{money(normalizedInvoice.balanceDue)}</strong></div>
        </div>
        <button className="secondary-btn" onClick={() => updateInvoicePaymentStatus(selectedInv.id, nextStatus)} type="button">
          Mark {nextStatus === "paid" ? "Paid" : "Unpaid"}
        </button>
      </div>

      <InvoiceActionBar onTogglePreview={() => setPreviewOpen(prev => !prev)} previewOpen={previewOpen} />

      {previewOpen ? (
        <div className="receipt-preview-frame no-print">
          <Receipt invoice={selectedInv} settings={settings} />
        </div>
      ) : null}

      <div className="receipt-capture receipt-export-source" ref={receiptRef}>
        <Receipt invoice={selectedInv} settings={settings} />
      </div>
    </section>
  );
}
