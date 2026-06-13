import { genId } from "./id";
import { normalizeInvoice, normalizeInvoices } from "./invoice";
import { normalizeProducts } from "./product";

export const WIFI_SYNC_PORT = 8787;

export function currentDeviceName(settings) {
  return String(settings?.deviceName || "").trim() || "This device";
}

export function invoiceOriginLabel(invoice) {
  if (invoice?.syncOrigin === "received") {
    return `Received from ${
      invoice.receivedFromDeviceName ||
      invoice.createdOnDeviceName ||
      "another device"
    }`;
  }

  return "Made on this device";
}

export function normalizeSyncAddress(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  if (!cleaned) return "";

  return `http://${cleaned.includes(":") ? cleaned : `${cleaned}:${WIFI_SYNC_PORT}`}`;
}

function settingsForSync(settings) {
  const { ownerPin, ...safeSettings } = settings || {};

  return safeSettings;
}

export function buildWifiSyncPayload(invoicesToSend, products, settings) {
  return {
    app: "sreyoun-meatball",
    version: 1,
    sentAt: new Date().toISOString(),
    sourceDevice: {
      name: currentDeviceName(settings),
    },
    invoices: invoicesToSend.map((invoice) => normalizeInvoice(invoice)),
    products: normalizeProducts(products),
    settings: settingsForSync(settings),
  };
}

export function mergeSyncedInvoices(currentInvoices, incomingInvoices, sourceDeviceName) {
  const existingIds = new Set(currentInvoices.map((invoice) => invoice.id));
  const incoming = incomingInvoices
    .filter((invoice) => invoice && Array.isArray(invoice.lines))
    .map((invoice) =>
      normalizeInvoice({
        ...invoice,
        id: invoice.id || genId(),
        syncOrigin: "received",
        createdOnDeviceName:
          invoice.createdOnDeviceName || sourceDeviceName || "another device",
        receivedFromDeviceName:
          sourceDeviceName || invoice.createdOnDeviceName || "another device",
        receivedAt: new Date().toISOString(),
      })
    );
  const incomingById = new Map(incoming.map((invoice) => [invoice.id, invoice]));
  const updatedExisting = currentInvoices.map((invoice) =>
    incomingById.get(invoice.id) || invoice
  );
  const newInvoices = incoming.filter((invoice) => !existingIds.has(invoice.id));

  return normalizeInvoices([...newInvoices, ...updatedExisting]);
}

export function nextInvoiceCounter(invoices, fallback) {
  const highestNumber = invoices.reduce(
    (highest, invoice) => Math.max(highest, Number(invoice.number) || 0),
    0
  );

  return Math.max(fallback, highestNumber + 1);
}
