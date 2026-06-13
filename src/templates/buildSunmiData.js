import { normalizeInvoice } from "../helpers/invoice";
import { invoicePaymentStatus, invoicePriceType } from "../helpers/invoice";

export default function buildSunmiReceiptData(invoice, settings) {
  const normalizedInvoice = normalizeInvoice(invoice);
  const invoiceNumber = String(normalizedInvoice.number).padStart(6, "0");

  return {
    shopName: "SREYOUN MEATBALL",
    khmerName: settings.khmerName,
    shopPhone: settings.phoneNumbers,
    invoiceNo: invoiceNumber,
    date: normalizedInvoice.date,
    time: normalizedInvoice.time,
    customer: normalizedInvoice.customer || "",
    customerPhone: normalizedInvoice.phone || "",
    priceType: invoicePriceType(normalizedInvoice),
    paymentStatus: invoicePaymentStatus(normalizedInvoice),
    items: normalizedInvoice.lines.map((line) => ({
      name: line.name,
      qty: line.q,
      price: line.price,
      amount: line.line,
    })),
    total: normalizedInvoice.total,
    amountPaid: normalizedInvoice.amountPaid,
    balanceDue: normalizedInvoice.balanceDue,
    note: normalizedInvoice.note || "",
    bank1: settings.bankAccount1,
    bank2: settings.bankAccount2,
  };
}
