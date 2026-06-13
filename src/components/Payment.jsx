import { money } from "../helpers/format";

import { invoicePaymentStatus, invoicePriceType } from "../helpers/invoice";

export function PaymentStatusControl({
  amountPaid,
  balanceDue,
  onAmountPaidChange,
  paidAmount,
  paymentStatus,
  setPaymentStatus,
  total,
}) {
  return (
    <div className="payment-control" role="group" aria-label="Payment status">
      <span>Payment</span>
      <div>
        {[
          { id: "unpaid", label: "Unpaid" },
          { id: "paid", label: "Paid" },
        ].map((status) => (
          <button
            className={`payment-btn ${
              paymentStatus === status.id ? `active ${status.id}` : ""
            }`}
            key={status.id}
            onClick={() => setPaymentStatus(status.id)}
            type="button"
          >
            {status.label}
          </button>
        ))}
      </div>
      <label className="payment-amount-field">
        <span>ប្រាក់បានបង់</span>
        <input
          className="input"
          inputMode="decimal"
          onChange={(event) => onAmountPaidChange(event.target.value)}
          placeholder="0"
          type="text"
          value={amountPaid}
        />
      </label>
      <div className="payment-totals">
        <div>
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>បានបង់</span>
          <strong>{money(paidAmount)}</strong>
        </div>
        <div>
          <span>ប្រាក់នៅសល់</span>
          <strong>{money(balanceDue)}</strong>
        </div>
      </div>
    </div>
  );
}


export function PaymentStatusBadge({ invoice }) {
  const status = invoicePaymentStatus(invoice);

  return (
    <span className={`payment-badge ${status}`}>
      {status === "paid" ? "Paid" : "Unpaid"}
    </span>
  );
}


export function PriceTypeBadge({ invoice }) {
  const priceType = invoicePriceType(invoice);

  return (
    <span className={`price-type-badge ${priceType}`}>
      {priceType === "wholesale" ? "Wholesale" : "Retail"}
    </span>
  );
}


export function OriginBadge({ invoice }) {
  const isReceived = invoice?.syncOrigin === "received";

  return (
    <span className={`origin-badge ${isReceived ? "received" : "local"}`}>
      {isReceived ? "Received" : "Made here"}
    </span>
  );
}
