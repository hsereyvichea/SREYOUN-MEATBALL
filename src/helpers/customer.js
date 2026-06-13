import { genId } from "./id";
import { parseInvoiceDate } from "./format";
import { normalizeInvoice } from "./invoice";
import { summarizeInvoices } from "./report";

export function normalizeCustomer(customer) {
  const name = String(customer?.name || "").trim();
  const phone = String(customer?.phone || "").trim();
  const key = customerKey({ name, phone });

  return {
    id: customer?.id || key || genId(),
    name,
    phone,
    updatedAt: customer?.updatedAt || new Date().toISOString(),
  };
}

export function customerKey(customer) {
  const phone = String(customer?.phone || "").trim();
  const name = String(customer?.name || "").trim().toLowerCase();

  return phone || name;
}

export function mergeCustomers(...customerLists) {
  const customersByKey = new Map();

  customerLists.flat().forEach((customer) => {
    const normalized = normalizeCustomer(customer);
    if (!normalized.name && !normalized.phone) return;

    const key = customerKey(normalized);
    const current = customersByKey.get(key);

    if (!current || normalized.updatedAt > current.updatedAt) {
      customersByKey.set(key, {
        ...current,
        ...normalized,
        name: normalized.name || current?.name || "",
        phone: normalized.phone || current?.phone || "",
      });
    }
  });

  return Array.from(customersByKey.values()).sort(
    (first, second) => new Date(second.updatedAt) - new Date(first.updatedAt)
  );
}

export function upsertCustomer(customers, customer) {
  return mergeCustomers(
    [
      {
        ...customer,
        updatedAt: new Date().toISOString(),
      },
    ],
    customers
  );
}

export function customersFromInvoices(invoices) {
  return invoices.map((invoice) => ({
    name: invoice.customer,
    phone: invoice.phone,
    updatedAt:
      invoice.createdAtDevice ||
      invoice.receivedAt ||
      parseInvoiceDate(invoice.date)?.toISOString() ||
      new Date(0).toISOString(),
  }));
}

export function customerMatchesInvoice(customer, invoice) {
  const customerPhone = String(customer?.phone || "").trim();
  const customerName = String(customer?.name || "").trim().toLowerCase();
  const invoicePhone = String(invoice?.phone || "").trim();
  const invoiceName = String(invoice?.customer || "").trim().toLowerCase();

  if (customerPhone && invoicePhone) return customerPhone === invoicePhone;
  if (customerName && invoiceName) return customerName === invoiceName;

  return false;
}

export function summarizeCustomerInvoices(customer, invoices) {
  const customerInvoices = invoices
    .filter((invoice) => customerMatchesInvoice(customer, invoice))
    .map(normalizeInvoice);
  const summary = summarizeInvoices(customerInvoices);

  return {
    ...summary,
    invoices: customerInvoices,
  };
}
