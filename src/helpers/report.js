import {
  invoicePaymentStatus,
  invoicePriceType,
  normalizeInvoice,
} from "./invoice";

export function summarizeInvoices(invoices) {
  const summary = invoices.reduce(
    (summary, invoice) => {
      const normalized = normalizeInvoice(invoice);
      const priceType = invoicePriceType(normalized);
      const lines = Array.isArray(normalized.lines) ? normalized.lines : [];

      summary.invoiceCount += 1;
      summary.total += normalized.total;
      summary.paid += normalized.amountPaid;
      summary.balance += normalized.balanceDue;

      if (priceType === "wholesale") {
        summary.wholesale += normalized.total;
      } else {
        summary.retail += normalized.total;
      }

      if (invoicePaymentStatus(normalized) === "paid") {
        summary.paidInvoices += 1;
      } else {
        summary.unpaidInvoices += 1;
      }

      lines.forEach((line) => {
        const quantity = Number(line.q ?? line.quantity ?? 0) || 0;
        const price = Number(line.price) || 0;
        const lineTotal =
          Number(line.line) || +(price * quantity).toFixed(2) || 0;
        const key = line.id || line.name || "unknown-item";

        if (!summary.itemsByKey[key]) {
          summary.itemsByKey[key] = {
            name: line.name || "Item",
            quantity: 0,
            total: 0,
            retailQuantity: 0,
            wholesaleQuantity: 0,
          };
        }

        summary.itemsByKey[key].quantity += quantity;
        summary.itemsByKey[key].total += lineTotal;
        if (priceType === "wholesale") {
          summary.itemsByKey[key].wholesaleQuantity += quantity;
        } else {
          summary.itemsByKey[key].retailQuantity += quantity;
        }
        summary.itemQuantity += quantity;
      });

      return summary;
    },
    {
      invoiceCount: 0,
      total: 0,
      paid: 0,
      balance: 0,
      retail: 0,
      wholesale: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      itemQuantity: 0,
      averageInvoice: 0,
      topItems: [],
      itemsByKey: {},
    }
  );

  summary.averageInvoice = summary.invoiceCount
    ? +(summary.total / summary.invoiceCount).toFixed(2)
    : 0;
  summary.topItems = Object.values(summary.itemsByKey)
    .map((item) => ({
      ...item,
      quantity: Number.isInteger(item.quantity)
        ? item.quantity
        : +item.quantity.toFixed(2),
      total: +item.total.toFixed(2),
      priceTypeLabel:
        item.retailQuantity > 0 && item.wholesaleQuantity > 0
          ? "Mixed"
          : item.wholesaleQuantity > 0
            ? "Wholesale"
            : "Retail",
    }))
    .sort(
      (first, second) =>
        second.quantity - first.quantity ||
        second.total - first.total ||
        first.name.localeCompare(second.name)
    );
  delete summary.itemsByKey;

  return summary;
}
