export function invoicePriceType(invoice) {
  return invoice?.priceType === "wholesale" ||
    invoice?.lines?.[0]?.priceType === "wholesale"
    ? "wholesale"
    : "retail";
}

export function parseMoneyInput(value) {
  const digitsAndDots = String(value ?? "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = digitsAndDots.split(".");
  const cleaned = decimalParts.length
    ? `${whole}.${decimalParts.join("")}`
    : whole;
  const number = Number.parseFloat(cleaned);

  return Number.isFinite(number) && number > 0 ? +number.toFixed(2) : 0;
}

export function invoiceAmountPaid(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;
  const amountPaid = Number(invoice?.amountPaid);

  if (Number.isFinite(amountPaid)) {
    return +Math.min(Math.max(amountPaid, 0), total).toFixed(2);
  }

  return invoice?.paymentStatus === "paid" ? +total.toFixed(2) : 0;
}

export function invoiceBalanceDue(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  return +Math.max(total - invoiceAmountPaid(invoice), 0).toFixed(2);
}

export function invoicePaymentStatus(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  if (total <= 0) return invoice?.paymentStatus === "paid" ? "paid" : "unpaid";

  return invoiceBalanceDue(invoice) <= 0 ? "paid" : "unpaid";
}

export function normalizeInvoice(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;
  const amountPaid = invoiceAmountPaid({ ...invoice, total });
  const balanceDue = +Math.max(total - amountPaid, 0).toFixed(2);
  const normalized = {
    ...invoice,
    total: +total.toFixed(2),
    amountPaid,
    balanceDue,
  };

  return {
    ...normalized,
    paymentStatus: invoicePaymentStatus(normalized),
  };
}

export function normalizeInvoices(invoices) {
  return invoices.map(normalizeInvoice);
}
