import { invoicePaymentStatus, invoicePriceType } from "../../helpers/invoice";

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
