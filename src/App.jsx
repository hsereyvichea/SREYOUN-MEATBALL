import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  Calculator,
  CalendarDays,
  Download,
  FileDown,
  ImageDown,
  Minus,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingCart,
  Trash2,
  Upload,
  User,
  Utensils,
  Wifi,
  X,
} from "lucide-react";

const STORAGE_KEY = "meatball-pos-v2";
const WIFI_SYNC_PORT = 8787;
const DEFAULT_OWNER_PIN = "1234";
const CUSTOMER_RECENT_LIMIT = 6;
const CUSTOMER_SEARCH_LIMIT = 8;
const PRODUCT_THUMB_SIZE = 360;
const PRODUCT_THUMB_QUALITY = 0.76;
const PRODUCT_ZOOM_SIZE = 1200;
const PRODUCT_ZOOM_QUALITY = 0.88;
const NativePrinter = registerPlugin("SreyounPrint");

const DEFAULT_PRODUCTS = [
  {
    id: "p1",
    emoji: "🧆",
    name: "Classic Meatballs (6 pcs)",
    retailPrice: 8.99,
    wholesalePrice: 7.99,
  },
  {
    id: "p2",
    emoji: "🔥",
    name: "Spicy Meatballs (6 pcs)",
    retailPrice: 10.99,
    wholesalePrice: 9.99,
  },
  {
    id: "p3",
    emoji: "🥖",
    name: "Meatball Sub Sandwich",
    retailPrice: 13.99,
    wholesalePrice: 12.49,
  },
  {
    id: "p4",
    emoji: "📦",
    name: "Family Pack (20 pcs)",
    retailPrice: 26.99,
    wholesalePrice: 24.99,
  },
  {
    id: "p5",
    emoji: "🫙",
    name: "Extra Sauce",
    retailPrice: 1.5,
    wholesalePrice: 1.25,
  },
];

const DEFAULT_SETTINGS = {
  khmerName: "ស្រីអូន លក់ប្រហិតគ្រប់មុខ",
  phoneNumbers: "010 790 913 / 012 913 614",
  bankAccount1: "000 000 000 SREYOUN MEATBALL",
  bankAccount2: "000 000 000 SREYOUN MEATBALL",
  deviceName: "This device",
  ownerPin: DEFAULT_OWNER_PIN,
  autoPrintReceivedInvoices: false,
  syncMenuPricesOnWifi: false,
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function money(value) {
  const num = Number(value || 0);
  const formatted =
    num % 1 === 0
      ? num.toString()
      : num.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return `៛${formatted}`;
}

function normalizeProduct(product) {
  const fallbackPrice = Number(product.price ?? product.retailPrice ?? 0) || 0;
  const retailPrice = Number(product.retailPrice ?? fallbackPrice) || 0;
  const wholesalePrice = Number(product.wholesalePrice ?? fallbackPrice) || 0;

  return {
    ...product,
    photo: typeof product.photo === "string" ? product.photo : "",
    photoZoom:
      typeof product.photoZoom === "string"
        ? product.photoZoom
        : typeof product.photo === "string"
          ? product.photo
          : "",
    retailPrice: +retailPrice.toFixed(2),
    wholesalePrice: +wholesalePrice.toFixed(2),
  };
}

function normalizeProducts(products) {
  return products.map(normalizeProduct);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = src;
  });
}

function drawProductImage(image, maxSize, quality) {
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = longestSide > maxSize ? maxSize / longestSide : 1;
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

async function resizeProductPhoto(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  return {
    thumb: drawProductImage(image, PRODUCT_THUMB_SIZE, PRODUCT_THUMB_QUALITY),
    zoom: drawProductImage(image, PRODUCT_ZOOM_SIZE, PRODUCT_ZOOM_QUALITY),
  };
}

function getProductPrice(product, priceType) {
  const normalized = normalizeProduct(product);
  return priceType === "wholesale"
    ? normalized.wholesalePrice
    : normalized.retailPrice;
}

function invoicePriceType(invoice) {
  return invoice?.priceType === "wholesale" ||
    invoice?.lines?.[0]?.priceType === "wholesale"
    ? "wholesale"
    : "retail";
}

function parseMoneyInput(value) {
  const digitsAndDots = String(value ?? "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = digitsAndDots.split(".");
  const cleaned = decimalParts.length
    ? `${whole}.${decimalParts.join("")}`
    : whole;
  const number = Number.parseFloat(cleaned);

  return Number.isFinite(number) && number > 0 ? +number.toFixed(2) : 0;
}

function invoiceAmountPaid(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;
  const amountPaid = Number(invoice?.amountPaid);

  if (Number.isFinite(amountPaid)) {
    return +Math.min(Math.max(amountPaid, 0), total).toFixed(2);
  }

  return invoice?.paymentStatus === "paid" ? +total.toFixed(2) : 0;
}

function invoiceBalanceDue(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  return +Math.max(total - invoiceAmountPaid(invoice), 0).toFixed(2);
}

function invoicePaymentStatus(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  if (total <= 0) return invoice?.paymentStatus === "paid" ? "paid" : "unpaid";

  return invoiceBalanceDue(invoice) <= 0 ? "paid" : "unpaid";
}

function normalizeInvoice(invoice) {
  const parsedTotal = Number(invoice?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;
  const amountPaid = invoiceAmountPaid({ ...invoice, total });
  const balanceDue = +Math.max(total - amountPaid, 0).toFixed(2);

  return {
    ...invoice,
    total: +total.toFixed(2),
    amountPaid,
    balanceDue,
    paymentStatus: balanceDue <= 0 && total > 0 ? "paid" : "unpaid",
  };
}

function normalizeInvoices(invoices) {
  return invoices.map(normalizeInvoice);
}

function normalizeCustomer(customer) {
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

function customerKey(customer) {
  const phone = String(customer?.phone || "").trim();
  const name = String(customer?.name || "").trim().toLowerCase();

  return phone || name;
}

function mergeCustomers(...customerLists) {
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

function upsertCustomer(customers, customer) {
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

function customersFromInvoices(invoices) {
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

function customerMatchesInvoice(customer, invoice) {
  const customerPhone = String(customer?.phone || "").trim();
  const customerName = String(customer?.name || "").trim().toLowerCase();
  const invoicePhone = String(invoice?.phone || "").trim();
  const invoiceName = String(invoice?.customer || "").trim().toLowerCase();

  if (customerPhone && invoicePhone) return customerPhone === invoicePhone;
  if (customerName && invoiceName) return customerName === invoiceName;

  return false;
}

function summarizeCustomerInvoices(customer, invoices) {
  const customerInvoices = invoices
    .filter((invoice) => customerMatchesInvoice(customer, invoice))
    .map(normalizeInvoice);
  const summary = summarizeInvoices(customerInvoices);

  return {
    ...summary,
    invoices: customerInvoices,
  };
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function parseInvoiceDate(value) {
  const [day, month, year] = String(value || "")
    .split("/")
    .map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function startOfBusinessWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);

  return start;
}

function endOfBusinessWeek(date) {
  const end = addDays(startOfBusinessWeek(date), 6);
  end.setHours(23, 59, 59, 999);

  return end;
}

function startOfMonth(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  return start;
}

function summarizeInvoices(invoices) {
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
          };
        }

        summary.itemsByKey[key].quantity += quantity;
        summary.itemsByKey[key].total += lineTotal;
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
    }))
    .sort(
      (first, second) =>
        second.quantity - first.quantity ||
        second.total - first.total ||
        first.name.localeCompare(second.name)
    )
    .slice(0, 5);
  delete summary.itemsByKey;

  return summary;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function backupFileName() {
  return `sreyoun-backup-${formatDate(new Date()).replace(/\//g, "-")}.json`;
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildInvoiceHtml(invoice, settings) {
  const normalizedInvoice = normalizeInvoice(invoice);
  const invoiceNumber = String(invoice.number).padStart(6, "0");
  const rows = invoice.lines
    .map(
      (line, index) => `
        <tr>
          <td class="num-cell">${index + 1}</td>
          <td>${escapeHtml(line.name)}</td>
          <td class="num-cell">${escapeHtml(line.q)}</td>
          <td class="money-cell">${escapeHtml(money(line.price))}</td>
          <td class="money-cell strong-cell">${escapeHtml(money(line.line))}</td>
        </tr>`
    )
    .join("");
  const note = invoice.note
    ? `<div class="invoice-note"><strong>ចំណាំ / Note:</strong> ${escapeHtml(invoice.note)}</div>`
    : "";
  const secondBank = settings.bankAccount2
    ? `<div>${escapeHtml(settings.bankAccount2)}</div>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0a308f;
        font-family: Arial, "Noto Sans Khmer", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice-print-area {
        width: 100%;
        max-width: 760px;
        margin: 0 auto;
        background: #ffffff;
        padding: 30px 40px;
        color: #0a308f;
      }
      .invoice-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 15px;
      }
      .khmer-name {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 4px;
      }
      .shop-name {
        margin: 0 0 5px 0;
        color: #0a308f;
        font-size: 24px;
        line-height: 1.1;
        text-transform: uppercase;
      }
      .shop-phone {
        font-size: 13px;
      }
      .invoice-number {
        color: #d81b1b;
        font-size: 24px;
        font-weight: bold;
        letter-spacing: 1px;
        text-align: right;
        white-space: nowrap;
      }
      .invoice-number span {
        text-decoration: underline;
      }
      .invoice-date {
        margin-top: 5px;
        font-size: 12px;
        text-align: right;
      }
      .invoice-info-row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      .customer-info {
        flex: 1;
      }
      .customer-info div + div {
        margin-top: 6px;
      }
      .bank-box {
        min-width: 200px;
        border: 1.5px solid #0a308f;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        text-align: left;
      }
      .bank-title {
        border-bottom: 1px solid #0a308f;
        padding-bottom: 4px;
        margin-bottom: 4px;
        font-weight: bold;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 2px solid #0a308f;
        margin-top: 10px;
      }
      th, td {
        border: 1.5px solid #0a308f;
        padding: 8px;
        font-size: 13px;
        vertical-align: top;
      }
      th {
        background: #f8f9fc;
        text-align: center;
        font-weight: bold;
      }
      .num-cell {
        text-align: center;
        font-weight: bold;
      }
      .money-cell {
        text-align: right;
      }
      .strong-cell {
        font-weight: bold;
      }
      .total-label {
        text-align: right;
        font-size: 16px;
        font-weight: bold;
        padding: 12px 8px;
      }
      .total-value {
        color: #d81b1b;
        text-align: right;
        font-size: 18px;
        font-weight: bold;
        padding: 12px 8px;
      }
      .invoice-note {
        margin-top: 15px;
        padding: 10px;
        border: 1px dashed #0a308f;
        font-size: 13px;
      }
      @media (max-width: 640px) {
        .invoice-print-area { padding: 20px 16px; }
        .invoice-top, .invoice-info-row { flex-direction: column; }
        .invoice-number, .invoice-date { text-align: left; }
        .bank-box { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="invoice-print-area">
      <div class="invoice-top">
        <div>
          <div class="khmer-name">${escapeHtml(settings.khmerName)}</div>
          <h1 class="shop-name">SREYOUN MEATBALL</h1>
          <div class="shop-phone">${escapeHtml(settings.phoneNumbers)}</div>
        </div>
        <div>
          <div class="invoice-number">Nº <span>${invoiceNumber}</span></div>
          <div class="invoice-date">Date: ${escapeHtml(invoice.date)} ${escapeHtml(invoice.time)}</div>
        </div>
      </div>
      <div class="invoice-info-row">
        <div class="customer-info">
          <div><strong>ឈ្មោះអតិថិជន / Customer:</strong> ${escapeHtml(invoice.customer || ".....................................................")}</div>
          <div><strong>លេខទូរស័ព្ទ / Phone:</strong> ${escapeHtml(invoice.phone || ".....................................................")}</div>
        </div>
        <div class="bank-box">
          <div class="bank-title">ABA Bank</div>
          <div>${escapeHtml(settings.bankAccount1)}</div>
          ${secondBank}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">ល.រ<br />Nº</th>
            <th style="width: 45%;">បរិយាយ<br />Description</th>
            <th style="width: 15%;">បរិមាណ<br />Quantity</th>
            <th style="width: 15%;">តម្លៃរាយ<br />Unit Price</th>
            <th style="width: 20%;">តម្លៃសរុប<br />Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td class="total-label" colspan="4">សរុបទឹកប្រាក់ / Total:</td>
            <td class="total-value">${escapeHtml(money(normalizedInvoice.total))}</td>
          </tr>
          <tr>
            <td class="total-label" colspan="4">ប្រាក់បានបង់:</td>
            <td class="total-value">${escapeHtml(money(normalizedInvoice.amountPaid))}</td>
          </tr>
          <tr>
            <td class="total-label" colspan="4">ប្រាក់នៅសល់:</td>
            <td class="total-value">${escapeHtml(money(normalizedInvoice.balanceDue))}</td>
          </tr>
        </tbody>
      </table>
      ${note}
    </div>
  </body>
</html>`;
}

function buildSunmiReceiptData(invoice, settings) {
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

function sanitizeCalc(input) {
  return String(input)
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9+\-*/().\s]/g, "");
}

function currentDeviceName(settings) {
  return String(settings?.deviceName || "").trim() || "This device";
}

function invoiceOriginLabel(invoice) {
  if (invoice?.syncOrigin === "received") {
    return `Received from ${
      invoice.receivedFromDeviceName ||
      invoice.createdOnDeviceName ||
      "another device"
    }`;
  }

  return "Made on this device";
}

function normalizeSyncAddress(value) {
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

function buildWifiSyncPayload(invoicesToSend, products, settings) {
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

function mergeSyncedInvoices(currentInvoices, incomingInvoices, sourceDeviceName) {
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

function nextInvoiceCounter(invoices, fallback) {
  const highestNumber = invoices.reduce(
    (highest, invoice) => Math.max(highest, Number(invoice.number) || 0),
    0
  );

  return Math.max(fallback, highestNumber + 1);
}

export default function App() {
  const [tab, setTab] = useState("order");
  const [products, setProducts] = useState(normalizeProducts(DEFAULT_PRODUCTS));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [orderPriceType, setOrderPriceType] = useState("retail");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [amountPaid, setAmountPaid] = useState("");
  const [qty, setQty] = useState({});
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderNote, setOrderNote] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [hiddenCustomerKeys, setHiddenCustomerKeys] = useState([]);
  const [invCounter, setInvCounter] = useState(1001);
  const [selectedInvId, setSelectedInvId] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [searchOrder, setSearchOrder] = useState("");
  const [searchMenu, setSearchMenu] = useState("");
  const [searchInvoices, setSearchInvoices] = useState("");
  const [reportDate, setReportDate] = useState(() => toDateInputValue(new Date()));
  const [customReportStartDate, setCustomReportStartDate] = useState(() =>
    toDateInputValue(startOfMonth(new Date()))
  );
  const [customReportEndDate, setCustomReportEndDate] = useState(() =>
    toDateInputValue(new Date())
  );
  const [reportPriceType, setReportPriceType] = useState("all");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🧆");
  const [newPhoto, setNewPhoto] = useState("");
  const [newPhotoZoom, setNewPhotoZoom] = useState("");
  const [newRetailPrice, setNewRetailPrice] = useState("");
  const [newWholesalePrice, setNewWholesalePrice] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editPhotoZoom, setEditPhotoZoom] = useState("");
  const [editRetailPrice, setEditRetailPrice] = useState("");
  const [editWholesalePrice, setEditWholesalePrice] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calcInput, setCalcInput] = useState("");
  const [syncPeerAddress, setSyncPeerAddress] = useState("");
  const [syncStatus, setSyncStatus] = useState({
    ip: "",
    port: WIFI_SYNC_PORT,
    running: false,
    url: "",
  });
  const [syncBusy, setSyncBusy] = useState(false);
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState("");
  const [ownerUnlockRequest, setOwnerUnlockRequest] = useState(null);

  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const receiptRef = useRef(null);
  const receiveWifiSyncPayloadRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.products) && data.products.length) {
            setProducts(normalizeProducts(data.products));
          }
        if (Array.isArray(data.invoices)) {
          setInvoices(normalizeInvoices(data.invoices));
        }
        if (Array.isArray(data.customers)) {
          setCustomers(mergeCustomers(data.customers));
        }
        if (Array.isArray(data.hiddenCustomerKeys)) {
          setHiddenCustomerKeys(data.hiddenCustomerKeys.filter(Boolean));
        }
        if (Number.isFinite(data.invCounter)) setInvCounter(data.invCounter);
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
        if (data.syncPeerAddress) {
          setSyncPeerAddress(data.syncPeerAddress);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products,
        invoices,
        customers,
        hiddenCustomerKeys,
        invCounter,
        settings,
        syncPeerAddress,
      })
    );
  }, [
    products,
    invoices,
    customers,
    hiddenCustomerKeys,
    invCounter,
    settings,
    syncPeerAddress,
    loading,
  ]);

  useEffect(() => {
    if (selectedInvId && !invoices.some((inv) => inv.id === selectedInvId)) {
      setSelectedInvId(null);
    }
  }, [invoices, selectedInvId]);

  const lines = useMemo(
    () =>
      products
        .filter((product) => (qty[product.id] || 0) > 0)
        .map((product) => {
          const price = getProductPrice(product, orderPriceType);

          return {
            ...normalizeProduct(product),
            price,
            priceType: orderPriceType,
            q: qty[product.id],
            line: +(price * qty[product.id]).toFixed(2),
          };
        }),
    [orderPriceType, products, qty]
  );

  const total = useMemo(
    () => +lines.reduce((sum, line) => sum + line.line, 0).toFixed(2),
    [lines]
  );
  const orderAmountPaid = useMemo(
    () => Math.min(parseMoneyInput(amountPaid), total),
    [amountPaid, total]
  );
  const orderBalanceDue = useMemo(
    () => +Math.max(total - orderAmountPaid, 0).toFixed(2),
    [orderAmountPaid, total]
  );
  const orderPaymentStatus =
    total > 0 && orderBalanceDue <= 0 ? "paid" : "unpaid";

  useEffect(() => {
    if (paymentStatus === "paid" && total > 0) {
      setAmountPaid(String(total));
    }
  }, [paymentStatus, total]);

  const todayStr = formatDate(new Date());
  const todayInvoices = invoices.filter((invoice) => invoice.date === todayStr);
  const todaySales = +todayInvoices
    .reduce((sum, invoice) => sum + invoice.total, 0)
    .toFixed(2);

  const filteredOrderProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchOrder.toLowerCase())
  );
  const knownCustomers = useMemo(
    () => {
      const hiddenKeys = new Set(hiddenCustomerKeys);

      return mergeCustomers(customers, customersFromInvoices(invoices)).filter(
        (savedCustomer) => !hiddenKeys.has(customerKey(savedCustomer))
      );
    },
    [customers, hiddenCustomerKeys, invoices]
  );
  const customerLookupText = `${customer} ${phone}`.trim().toLowerCase();
  const isSearchingCustomers = customerLookupText.length > 0;
  const customerPickerData = useMemo(() => {
    const matches = isSearchingCustomers
      ? knownCustomers.filter((savedCustomer) =>
          [savedCustomer.name, savedCustomer.phone]
            .join(" ")
            .toLowerCase()
            .includes(customerLookupText)
        )
      : knownCustomers;
    const limit = isSearchingCustomers
      ? CUSTOMER_SEARCH_LIMIT
      : CUSTOMER_RECENT_LIMIT;

    return {
      customers: matches.slice(0, limit),
      total: matches.length,
    };
  }, [customerLookupText, isSearchingCustomers, knownCustomers]);
  const filteredCustomers = customerPickerData.customers;
  const filteredCustomerCount = customerPickerData.total;
  const selectedCustomerSummary = useMemo(
    () =>
      selectedCustomer
        ? summarizeCustomerInvoices(selectedCustomer, invoices)
        : null,
    [invoices, selectedCustomer]
  );
  const filteredMenuProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchMenu.toLowerCase())
  );
  const filteredInvoices = useMemo(() => {
    const terms = searchInvoices
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!terms.length) return invoices;

    return invoices.filter((invoice) => {
      const normalized = normalizeInvoice(invoice);
      const invoiceNumber = String(normalized.number).padStart(6, "0");
      const searchable = [
        String(normalized.number),
        invoiceNumber,
        normalized.customer,
        normalized.phone,
        normalized.date,
        normalized.time,
        normalized.priceType || "retail",
        invoicePaymentStatus(normalized),
        invoiceOriginLabel(normalized),
        normalized.createdOnDeviceName,
        normalized.receivedFromDeviceName,
        money(normalized.total),
        money(normalized.amountPaid),
        money(normalized.balanceDue),
      ]
        .join(" ")
        .toLowerCase();

      return terms.every((term) => searchable.includes(term));
    });
  }, [invoices, searchInvoices]);
  const selectedInv = invoices.find((invoice) => invoice.id === selectedInvId);
  const selectedReportDate = useMemo(() => parseDateInput(reportDate), [reportDate]);
  const reportDayLabel = formatDate(selectedReportDate);
  const weeklyStartDate = useMemo(
    () => startOfBusinessWeek(selectedReportDate),
    [selectedReportDate]
  );
  const weeklyEndDate = useMemo(
    () => endOfBusinessWeek(selectedReportDate),
    [selectedReportDate]
  );
  const customReportRange = useMemo(() => {
    const first = parseDateInput(customReportStartDate);
    const second = parseDateInput(customReportEndDate);
    const start = first <= second ? first : second;
    const end = first <= second ? second : first;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [customReportEndDate, customReportStartDate]);
  const dailyReportInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const invoiceDate = parseInvoiceDate(invoice.date);

        return (
          invoiceDate &&
          formatDate(invoiceDate) === reportDayLabel &&
          (reportPriceType === "all" ||
            invoicePriceType(invoice) === reportPriceType)
        );
      }),
    [invoices, reportDayLabel, reportPriceType]
  );
  const weeklyReportInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const invoiceDate = parseInvoiceDate(invoice.date);

        return (
          invoiceDate &&
          invoiceDate >= weeklyStartDate &&
          invoiceDate <= weeklyEndDate &&
          (reportPriceType === "all" ||
            invoicePriceType(invoice) === reportPriceType)
        );
      }),
    [invoices, reportPriceType, weeklyEndDate, weeklyStartDate]
  );
  const customReportInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const invoiceDate = parseInvoiceDate(invoice.date);

        return (
          invoiceDate &&
          invoiceDate >= customReportRange.start &&
          invoiceDate <= customReportRange.end &&
          (reportPriceType === "all" ||
            invoicePriceType(invoice) === reportPriceType)
        );
      }),
    [customReportRange, invoices, reportPriceType]
  );
  const dailyReportSummary = useMemo(
    () => summarizeInvoices(dailyReportInvoices),
    [dailyReportInvoices]
  );
  const weeklyReportSummary = useMemo(
    () => summarizeInvoices(weeklyReportInvoices),
    [weeklyReportInvoices]
  );
  const customReportSummary = useMemo(
    () => summarizeInvoices(customReportInvoices),
    [customReportInvoices]
  );

  const showToast = (msg, type = "ok") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  };

  const requestOwnerUnlock = ({ title, message, onUnlock }) => {
    if (ownerUnlocked) {
      onUnlock?.();
      return;
    }

    setOwnerPinInput("");
    setOwnerUnlockRequest({
      title: title || "Owner PIN",
      message: message || "Enter owner PIN to continue.",
      onUnlock,
    });
  };

  const closeOwnerUnlock = () => {
    setOwnerPinInput("");
    setOwnerUnlockRequest(null);
  };

  const submitOwnerUnlock = () => {
    const expectedPin = String(settings.ownerPin || DEFAULT_OWNER_PIN);

    if (String(ownerPinInput).trim() !== expectedPin) {
      showToast("Wrong owner PIN.", "err");
      return;
    }

    const nextAction = ownerUnlockRequest?.onUnlock;
    setOwnerUnlocked(true);
    closeOwnerUnlock();
    showToast("Owner mode unlocked.");
    nextAction?.();
  };

  const lockOwnerMode = () => {
    setOwnerUnlocked(false);
    setEditId(null);
    if (tab === "menu" || tab === "settings") {
      setTab("order");
    }
    showToast("Owner mode locked.");
  };

  const selectTab = (nextTab) => {
    const openTab = () => {
      setTab(nextTab);
      if (nextTab !== "history") setSelectedInvId(null);
    };

    if ((nextTab === "menu" || nextTab === "settings") && !ownerUnlocked) {
      requestOwnerUnlock({
        title: nextTab === "menu" ? "Unlock Menu" : "Unlock Settings",
        message:
          nextTab === "menu"
            ? "Owner PIN is required to add, edit, or delete menu prices."
            : "Owner PIN is required to change app settings.",
        onUnlock: openTab,
      });
      return;
    }

    openTab();
  };

  const receiveWifiSyncPayload = (rawPayload) => {
    try {
      const payload =
        typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
      const incomingInvoices = Array.isArray(payload?.invoices)
        ? payload.invoices
        : [];
      const incomingProducts = Array.isArray(payload?.products)
        ? payload.products
        : [];
      const sourceDeviceName =
        String(payload?.sourceDevice?.name || "").trim() || "another device";

      if (!incomingInvoices.length) {
        showToast("WiFi sync did not include invoices.", "err");
        return;
      }

      const receivedInvoices = incomingInvoices.map((invoice) =>
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

      if (settings.syncMenuPricesOnWifi && incomingProducts.length) {
        setProducts(normalizeProducts(incomingProducts));
      }

      setCustomers((current) =>
        mergeCustomers(current, customersFromInvoices(receivedInvoices)).filter(
          (savedCustomer) => !hiddenCustomerKeys.includes(customerKey(savedCustomer))
        )
      );
      setInvoices((current) => {
        const mergedInvoices = mergeSyncedInvoices(
          current,
          receivedInvoices,
          sourceDeviceName
        );
        setInvCounter((currentCounter) =>
          nextInvoiceCounter(mergedInvoices, currentCounter)
        );
        return mergedInvoices;
      });
      setSelectedInvId(receivedInvoices[0]?.id || null);
      setTab("history");
      showToast(
        `Received ${incomingInvoices.length} invoice${
          incomingInvoices.length === 1 ? "" : "s"
        }${settings.syncMenuPricesOnWifi && incomingProducts.length ? " and menu" : ""} by WiFi.`
      );

      if (settings.autoPrintReceivedInvoices && Capacitor.isNativePlatform()) {
        (async () => {
          for (const invoice of receivedInvoices) {
            await NativePrinter.printSunmiReceipt({
              json: JSON.stringify(buildSunmiReceiptData(invoice, settings)),
            });
          }
        })().catch((error) => {
            console.error(error);
            showToast("Received invoice, but auto-print failed.", "err");
        });
      }
    } catch (error) {
      console.error(error);
      showToast("Could not receive WiFi sync.", "err");
    }
  };

  receiveWifiSyncPayloadRef.current = receiveWifiSyncPayload;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listenerHandle;
    let mounted = true;

    NativePrinter.addListener("wifiSyncReceived", (event) => {
      receiveWifiSyncPayloadRef.current?.(event?.json);
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch((error) => {
        console.warn("Could not listen for WiFi sync", error);
      });

    NativePrinter.startWifiSyncReceiver({ port: WIFI_SYNC_PORT })
      .then((status) => {
        if (mounted) setSyncStatus((current) => ({ ...current, ...status }));
      })
      .catch(() => {});

    return () => {
      mounted = false;
      listenerHandle?.remove();
    };
  }, []);

  const startWifiSyncReceiver = async () => {
    if (!Capacitor.isNativePlatform()) {
      showToast("WiFi receive works in the Android app.", "err");
      return;
    }

    try {
      const status = await NativePrinter.startWifiSyncReceiver({
        port: WIFI_SYNC_PORT,
      });
      setSyncStatus((current) => ({ ...current, ...status }));
      showToast(status?.url ? "WiFi receiver started." : "Receiver started.");
    } catch (error) {
      console.error(error);
      showToast("Could not start WiFi receiver.", "err");
    }
  };

  const stopWifiSyncReceiver = async () => {
    if (!Capacitor.isNativePlatform()) {
      showToast("WiFi receive works in the Android app.", "err");
      return;
    }

    try {
      const status = await NativePrinter.stopWifiSyncReceiver();
      setSyncStatus((current) => ({ ...current, ...status }));
      showToast("WiFi receiver stopped.");
    } catch (error) {
      console.error(error);
      showToast("Could not stop WiFi receiver.", "err");
    }
  };

  const testWifiSyncConnection = async () => {
    const receiverUrl = normalizeSyncAddress(syncPeerAddress);
    if (!receiverUrl) {
      showToast("Enter the receiving device WiFi address.", "err");
      return;
    }

    setSyncBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await NativePrinter.testWifiSync({ url: receiverUrl });
      } else {
        const response = await fetch(`${receiverUrl}/ping`);
        if (!response.ok) {
          throw new Error(`Receiver returned ${response.status}`);
        }
      }

      showToast("WiFi receiver found.");
    } catch (error) {
      console.error(error);
      showToast("Cannot reach receiver. Check address and WiFi.", "err");
    } finally {
      setSyncBusy(false);
    }
  };

  const sendInvoicesOverWifi = async (invoicesToSend) => {
    if (!invoicesToSend.length) {
      showToast("No invoices to send.", "err");
      return;
    }

    const receiverUrl = normalizeSyncAddress(syncPeerAddress);
    if (!receiverUrl) {
      showToast("Enter the receiving device WiFi address.", "err");
      return;
    }

    setSyncBusy(true);
    try {
      const json = JSON.stringify(
        buildWifiSyncPayload(invoicesToSend, products, settings)
      );

      if (Capacitor.isNativePlatform()) {
        await NativePrinter.sendWifiSync({
          json,
          url: receiverUrl,
        });
      } else {
        const response = await fetch(`${receiverUrl}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: json,
        });

        if (!response.ok) {
          throw new Error(`WiFi sync failed: ${response.status}`);
        }
      }

      showToast(
        `Sent ${invoicesToSend.length} invoice${
          invoicesToSend.length === 1 ? "" : "s"
        } by WiFi.`
      );
    } catch (error) {
      console.error(error);
      showToast("Could not send by WiFi. Check both devices are on same WiFi.", "err");
    } finally {
      setSyncBusy(false);
    }
  };

  const sendLatestInvoiceOverWifi = () => sendInvoicesOverWifi(invoices.slice(0, 1));
  const sendAllInvoicesOverWifi = () => sendInvoicesOverWifi(invoices);
  const sendSelectedInvoiceOverWifi = () => {
    if (!selectedInv) {
      showToast("Open an invoice first.", "err");
      return;
    }

    sendInvoicesOverWifi([selectedInv]);
  };

  const bump = (id, delta) => {
    setQty((current) => {
      const nextValue = Math.max(0, (current[id] || 0) + delta);
      const next = { ...current };

      if (nextValue === 0) delete next[id];
      else next[id] = nextValue;

      return next;
    });
  };

  const handleExactQty = (id, value) => {
    if (value === "") {
      setQty((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    const number = Number.parseInt(value, 10);
    if (!Number.isNaN(number) && number >= 0) {
      setQty((current) => {
        const next = { ...current };
        if (number === 0) delete next[id];
        else next[id] = number;
        return next;
      });
    }
  };

  const updateAmountPaid = (value) => {
    const parsed = Math.min(parseMoneyInput(value), total);

    setAmountPaid(value);
    setPaymentStatus(total > 0 && parsed >= total ? "paid" : "unpaid");
  };

  const setOrderPaidStatus = (nextStatus) => {
    const normalizedStatus = nextStatus === "paid" ? "paid" : "unpaid";

    setPaymentStatus(normalizedStatus);
    setAmountPaid(normalizedStatus === "paid" ? String(total) : "");
  };

  const updateCustomerName = (value) => {
    setCustomer(value);
    setSelectedCustomer(null);
  };

  const updateCustomerPhone = (value) => {
    setPhone(value);
    setSelectedCustomer(null);
  };

  const rememberCustomer = (customerName, customerPhone) => {
    if (!customerName.trim() && !customerPhone.trim()) return;

    const nextKey = customerKey({ name: customerName, phone: customerPhone });

    setHiddenCustomerKeys((current) =>
      current.filter((hiddenKey) => hiddenKey !== nextKey)
    );
    setCustomers((current) =>
      upsertCustomer(current, {
        name: customerName,
        phone: customerPhone,
      })
    );
  };

  const selectCustomer = (savedCustomer) => {
    const normalized = normalizeCustomer(savedCustomer);

    setSelectedCustomer(normalized);
    setCustomer(normalized.name || "");
    setPhone(normalized.phone || "");
    showToast("Customer selected.");
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomer("");
    setPhone("");
    showToast("Customer cleared.");
  };

  const deleteSelectedCustomer = () => {
    if (!selectedCustomer) return;

    const key = customerKey(selectedCustomer);

    setHiddenCustomerKeys((current) =>
      current.includes(key) ? current : [...current, key]
    );
    setCustomers((current) =>
      current.filter((savedCustomer) => customerKey(savedCustomer) !== key)
    );
    setSelectedCustomer(null);
    setCustomer("");
    setPhone("");
    showToast("Customer removed. Invoices kept.", "err");
  };

  const openCustomerInvoice = (invoiceId) => {
    setSelectedInvId(invoiceId);
    setTab("history");
  };

  const clearOrder = () => {
    setQty({});
    setCustomer("");
    setPhone("");
    setSelectedCustomer(null);
    setOrderNote("");
    setPaymentStatus("unpaid");
    setAmountPaid("");
    setEditingInvoiceId(null);
  };

  const startEditInvoice = (invoice) => {
    const nextQty = {};
    invoice.lines.forEach((line) => {
      nextQty[line.id] = line.q;
    });
    setOrderPriceType(invoice.priceType || invoice.lines[0]?.priceType || "retail");
    setPaymentStatus(invoicePaymentStatus(invoice));
    setAmountPaid(
      invoiceAmountPaid(invoice) > 0 ? String(invoiceAmountPaid(invoice)) : ""
    );
    setQty(nextQty);
    setCustomer(invoice.customer || "");
    setPhone(invoice.phone || "");
    setOrderNote(invoice.note || "");
    setEditingInvoiceId(invoice.id);
    setTab("order");
    showToast(`Editing invoice #${invoice.number}`);
  };

  const saveInvoice = () => {
    if (!lines.length) {
      showToast("Add at least one item first.", "err");
      return;
    }

    const finalCustomer = customer.trim();
    const finalPhone = phone.trim();
    const parsedAmountPaid = Math.min(parseMoneyInput(amountPaid), total);
    const finalAmountPaid =
      paymentStatus === "paid" && parsedAmountPaid <= 0
        ? total
        : parsedAmountPaid;
    const finalBalanceDue = +Math.max(total - finalAmountPaid, 0).toFixed(2);
    const finalPaymentStatus = finalBalanceDue <= 0 ? "paid" : "unpaid";

    if (editingInvoiceId) {
      let updatedInvoice = null;
      const updatedInvoices = invoices.map((invoice) => {
        if (invoice.id !== editingInvoiceId) return invoice;

        updatedInvoice = {
          ...invoice,
          customer: finalCustomer,
          phone: finalPhone,
          note: orderNote.trim(),
          lines,
          priceType: orderPriceType,
          amountPaid: finalAmountPaid,
          balanceDue: finalBalanceDue,
          paymentStatus: finalPaymentStatus,
          total,
          time: formatTime(new Date()),
        };
        return updatedInvoice;
      });

      setInvoices(updatedInvoices);
      rememberCustomer(finalCustomer, finalPhone);
      if (updatedInvoice) setSelectedInvId(updatedInvoice.id);
      clearOrder();
      setTab("history");
      showToast(`Invoice #${updatedInvoice?.number} updated.`);
      return;
    }

    const invoice = {
      id: genId(),
      number: invCounter,
      date: formatDate(new Date()),
      time: formatTime(new Date()),
      customer: finalCustomer,
      phone: finalPhone,
      note: orderNote.trim(),
      lines,
      priceType: orderPriceType,
      amountPaid: finalAmountPaid,
      balanceDue: finalBalanceDue,
      paymentStatus: finalPaymentStatus,
      total,
      syncOrigin: "local",
      createdOnDeviceName: currentDeviceName(settings),
      createdAtDevice: new Date().toISOString(),
    };

    setInvoices((current) => [invoice, ...current]);
    rememberCustomer(finalCustomer, finalPhone);
    setInvCounter((current) => current + 1);
    setSelectedInvId(invoice.id);
    clearOrder();
    setTab("history");
    showToast(`Invoice #${invoice.number} created.`);
  };

  const deleteInvoice = (id) => {
    const deleteInvoiceNow = () => {
      setInvoices((current) => current.filter((invoice) => invoice.id !== id));
      setSelectedInvId(null);
      showToast("Invoice deleted.", "err");
    };

    if (!ownerUnlocked) {
      requestOwnerUnlock({
        title: "Delete Invoice",
        message: "Owner PIN is required to delete invoices.",
        onUnlock: deleteInvoiceNow,
      });
      return;
    }

    deleteInvoiceNow();
  };

  const updateInvoicePaymentStatus = (id, nextStatus) => {
    const normalizedStatus = nextStatus === "paid" ? "paid" : "unpaid";
    setInvoices((current) =>
      current.map((invoice) => {
        if (invoice.id !== id) return invoice;

        const totalDue = Number(invoice.total || 0);
        const nextAmountPaid = normalizedStatus === "paid" ? totalDue : 0;

        return {
          ...invoice,
          amountPaid: +nextAmountPaid.toFixed(2),
          balanceDue: normalizedStatus === "paid" ? 0 : +totalDue.toFixed(2),
          paymentStatus: normalizedStatus,
        };
      })
    );
    showToast(`Invoice marked ${normalizedStatus}.`);
  };

  const chooseNewProductPhoto = async (file) => {
    if (!file) return;

    try {
      const resized = await resizeProductPhoto(file);

      setNewPhoto(resized.thumb);
      setNewPhotoZoom(resized.zoom);
      showToast("Photo added.");
    } catch {
      showToast("Could not use that photo.", "err");
    }
  };

  const chooseEditProductPhoto = async (file) => {
    if (!file) return;

    try {
      const resized = await resizeProductPhoto(file);

      setEditPhoto(resized.thumb);
      setEditPhotoZoom(resized.zoom);
      showToast("Photo updated.");
    } catch {
      showToast("Could not use that photo.", "err");
    }
  };

  const addProduct = () => {
    const retailPrice = Number.parseFloat(newRetailPrice);
    const wholesalePrice = Number.parseFloat(newWholesalePrice);
    if (
      !newName.trim() ||
      Number.isNaN(retailPrice) ||
      Number.isNaN(wholesalePrice) ||
      retailPrice < 0 ||
      wholesalePrice < 0
    ) {
      showToast("Enter product name, retail price, and wholesale price.", "err");
      return;
    }

    setProducts((current) => [
      ...current,
      {
        id: genId(),
        emoji: newEmoji.trim() || "🧆",
        photo: newPhoto,
        photoZoom: newPhotoZoom,
        name: newName.trim(),
        retailPrice: +retailPrice.toFixed(2),
        wholesalePrice: +wholesalePrice.toFixed(2),
      },
    ]);
    setNewName("");
    setNewEmoji("🧆");
    setNewPhoto("");
    setNewPhotoZoom("");
    setNewRetailPrice("");
    setNewWholesalePrice("");
    showToast("Item added.");
  };

  const deleteProduct = (id) => {
    setProducts((current) => current.filter((product) => product.id !== id));
    setQty((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    showToast("Item removed.", "err");
  };

  const startEditProduct = (product) => {
    const normalized = normalizeProduct(product);
    setEditId(product.id);
    setEditName(normalized.name);
    setEditEmoji(normalized.emoji);
    setEditPhoto(normalized.photo || "");
    setEditPhotoZoom(normalized.photoZoom || normalized.photo || "");
    setEditRetailPrice(String(normalized.retailPrice));
    setEditWholesalePrice(String(normalized.wholesalePrice));
  };

  const saveProductEdit = () => {
    const retailPrice = Number.parseFloat(editRetailPrice);
    const wholesalePrice = Number.parseFloat(editWholesalePrice);
    if (
      !editName.trim() ||
      Number.isNaN(retailPrice) ||
      Number.isNaN(wholesalePrice) ||
      retailPrice < 0 ||
      wholesalePrice < 0
    ) {
      showToast("Enter product name, retail price, and wholesale price.", "err");
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === editId
          ? {
              ...product,
              emoji: editEmoji.trim() || "🧆",
              photo: editPhoto,
              photoZoom: editPhotoZoom || editPhoto,
              name: editName.trim(),
              retailPrice: +retailPrice.toFixed(2),
              wholesalePrice: +wholesalePrice.toFixed(2),
            }
          : product
      )
    );
    setEditId(null);
    showToast("Item updated.");
  };

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const downloadBackup = async () => {
    const payload = JSON.stringify(
      {
        products,
        invoices,
        customers,
        hiddenCustomerKeys,
        invCounter,
        settings,
      },
      null,
      2
    );
    const fileName = backupFileName();

    if (Capacitor.isNativePlatform()) {
      try {
        const shareFile = await Filesystem.writeFile({
          path: fileName,
          data: payload,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        let savedToDocuments = false;

        try {
          await Filesystem.writeFile({
            path: fileName,
            data: payload,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          savedToDocuments = true;
        } catch (error) {
          console.warn("Could not write backup to Documents", error);
        }

        await Share.share({
          title: "SREYOUN MEATBALL backup",
          text: `Backup file: ${fileName}`,
          url: shareFile.uri,
          dialogTitle: "Save or send backup",
        });

        showToast(
          savedToDocuments
            ? "Backup saved in Documents."
            : "Choose where to save or send backup."
        );
      } catch (error) {
        console.error(error);
        showToast("Could not save backup.", "err");
      }
      return;
    }

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded.");
  };

  const uploadBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      try {
        const data = JSON.parse(readerEvent.target.result);
        if (!Array.isArray(data.products) || !Array.isArray(data.invoices)) {
          throw new Error("Invalid backup");
        }

        setProducts(normalizeProducts(data.products));
        setInvoices(normalizeInvoices(data.invoices));
        setCustomers(
          mergeCustomers(data.customers || [], customersFromInvoices(data.invoices))
        );
        setHiddenCustomerKeys(
          Array.isArray(data.hiddenCustomerKeys)
            ? data.hiddenCustomerKeys.filter(Boolean)
            : []
        );
        setInvCounter(Number.isFinite(data.invCounter) ? data.invCounter : 1001);
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
        setSelectedInvId(null);
        clearOrder();
        showToast("Backup restored.");
      } catch {
        showToast("Invalid backup file.", "err");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const receiptFileBase = () =>
    `invoice-${String(selectedInv?.number || "receipt").padStart(6, "0")}`;

  const getReceiptCanvas = async () => {
    if (!receiptRef.current || !selectedInv) {
      showToast("Open an invoice first.", "err");
      return null;
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const captureTarget = receiptRef.current.cloneNode(true);
    captureTarget.classList.add("receipt-export-host");
    captureTarget.setAttribute("aria-hidden", "true");
    document.body.appendChild(captureTarget);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const width = Math.ceil(
      Math.max(captureTarget.scrollWidth, captureTarget.offsetWidth, 760)
    );
    const height = Math.ceil(
      Math.max(captureTarget.scrollHeight, captureTarget.offsetHeight)
    );

    try {
      return await html2canvas(captureTarget, {
        scale: 2,
        backgroundColor: "#ffffff",
        height,
        ignoreElements: (element) => element.classList?.contains("no-print"),
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        width,
        windowHeight: Math.max(height, 1000),
        windowWidth: width,
      });
    } finally {
      captureTarget.remove();
    }
  };

  const createReceiptPdf = (canvas) => {
    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    let imageWidth = maxWidth;
    let imageHeight = (canvas.height * imageWidth) / canvas.width;

    if (imageHeight > maxHeight) {
      imageHeight = maxHeight;
      imageWidth = (canvas.width * imageHeight) / canvas.height;
    }

    pdf.addImage(
      imageData,
      "PNG",
      (pageWidth - imageWidth) / 2,
      margin,
      imageWidth,
      imageHeight
    );

    return pdf;
  };

  const writeAndShareNativeFile = async ({
    base64,
    dialogTitle,
    fileName,
    saveToDocuments = false,
    text,
    title,
  }) => {
    const sharedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    let savedToDocuments = false;

    if (saveToDocuments) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });
        savedToDocuments = true;
      } catch (error) {
        console.warn("Could not write receipt to Documents", error);
      }
    }

    await Share.share({
      title,
      text,
      url: sharedFile.uri,
      dialogTitle,
    });

    return savedToDocuments;
  };

  const saveReceiptPhoto = async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;

      const imageData = canvas.toDataURL("image/png");
      const fileName = `${receiptFileBase()}.png`;

      if (Capacitor.isNativePlatform()) {
        await NativePrinter.saveImageToPictures({
          base64: imageData.split(",")[1],
          fileName,
        });
        showToast("Receipt photo saved in Pictures.");
        return;
      }

      downloadDataUrl(imageData, fileName);
      showToast("Receipt photo downloaded.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        showToast("Could not save receipt photo.", "err");
      }
    }
  };

  const saveReceiptPdf = async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;

      const pdf = createReceiptPdf(canvas);
      const fileName = `${receiptFileBase()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const savedToDocuments = await writeAndShareNativeFile({
          base64: pdf.output("datauristring").split(",")[1],
          dialogTitle: "Save or send receipt PDF",
          fileName,
          saveToDocuments: true,
          text: `Invoice #${selectedInv.number} - Total ${money(selectedInv.total)}`,
          title: `Invoice #${selectedInv.number}`,
        });

        showToast(
          savedToDocuments
            ? "Receipt PDF saved in Documents."
            : "Choose where to save receipt PDF."
        );
        return;
      }

      pdf.save(fileName);
      showToast("Receipt PDF downloaded.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        showToast("Could not save receipt PDF.", "err");
      }
    }
  };

  const shareReceipt = async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;

      const imageData = canvas.toDataURL("image/png");
      const fileName = `${receiptFileBase()}.png`;
      const text = `Invoice #${selectedInv.number} - Total ${money(selectedInv.total)}`;

      if (Capacitor.isNativePlatform()) {
        await writeAndShareNativeFile({
          base64: imageData.split(",")[1],
          dialogTitle: "Share receipt",
          fileName,
          text,
          title: `Invoice #${selectedInv.number}`,
        });
        showToast("Receipt shared.");
        return;
      }

      const file = new File([dataUrlToBlob(imageData)], fileName, {
        type: "image/png",
      });
      const shareData = {
        title: `Invoice #${selectedInv.number}`,
        text,
        files: [file],
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        showToast("Receipt shared.");
        return;
      }

      downloadDataUrl(imageData, fileName);
      showToast("Sharing is unavailable here. Photo downloaded.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        showToast("Could not share receipt.", "err");
      }
    }
  };

  const printReceipt = async () => {
    if (!selectedInv) {
      showToast("Open an invoice first.", "err");
      return;
    }

    if (Capacitor.isNativePlatform()) {
      const title = `Invoice #${String(selectedInv.number).padStart(6, "0")}`;

      try {
        await NativePrinter.printSunmiReceipt({
          json: JSON.stringify(buildSunmiReceiptData(selectedInv, settings)),
        });
        showToast("Receipt sent to SUNMI printer.");
        return;
      } catch (error) {
        console.warn("Could not print on SUNMI.", error);
      }

      try {
        await NativePrinter.printHtml({
          html: buildInvoiceHtml(selectedInv, settings),
          title,
        });
        showToast("Choose a printer on your phone.");
      } catch (error) {
        console.error(error);
        showToast("Could not print from phone.", "err");
      }
      return;
    }

    window.print();
  };

  const handleCalcBtn = (value) => {
    const allowedButtons = new Set([
      "C",
      "⌫",
      "÷",
      "×",
      "/",
      "*",
      "7",
      "8",
      "9",
      "-",
      "4",
      "5",
      "6",
      "+",
      "1",
      "2",
      "3",
      ".",
      "0",
      "00",
      "(",
      ")",
      "=",
    ]);

    if (!allowedButtons.has(value)) return;

    if (value === "C") {
      setCalcInput("");
      return;
    }

    if (value === "⌫") {
      setCalcInput((current) => current.slice(0, -1));
      return;
    }

    if (value === "=") {
      if (!calcInput) return;
      const parsed = sanitizeCalc(calcInput);
      if (!parsed.trim()) return;

      try {
        const result = Function(`"use strict"; return (${parsed})`)();
        if (!Number.isFinite(result)) throw new Error("Invalid result");
        setCalcInput(String(Math.round(result * 10000) / 10000));
      } catch {
        setCalcInput((current) => sanitizeCalc(current));
      }
      return;
    }

    setCalcInput((current) => current + value);
  };

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page">
          <div className="empty-state">
            <div className="empty-icon">🧆</div>
            <strong>Loading...</strong>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {toast && (
        <div className={`toast ${toast.type === "err" ? "error" : ""}`}>
          {toast.msg}
        </div>
      )}

      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">🧆</div>
            <div>
              <div className="brand-title">SREYOUN MEATBALL</div>
              <div className="brand-subtitle">{settings.khmerName}</div>
            </div>
          </div>
          <div className="sales-chip" aria-label="Today sales">
            <div className="sales-chip-label">Today</div>
            <div className="sales-chip-value">{money(todaySales)}</div>
            <div className="sales-chip-meta">
              {todayInvoices.length} {todayInvoices.length === 1 ? "order" : "orders"}
            </div>
          </div>
        </div>
      </header>

      <nav className="tabs no-print" aria-label="Main sections">
        {[
          { id: "order", label: "Order", icon: ShoppingCart, badge: lines.length },
          { id: "menu", label: "Menu", icon: Utensils },
          { id: "history", label: "Invoices", icon: ReceiptText, badge: invoices.length },
          { id: "reports", label: "Reports", icon: CalendarDays },
          { id: "calc", label: "Calc", icon: Calculator },
          { id: "settings", label: "Settings", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`tab ${tab === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => selectTab(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? <span className="badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      {ownerUnlocked ? (
        <div className="owner-mode-bar no-print">
          <span>Owner mode unlocked</span>
          <button className="secondary-btn compact-btn" onClick={lockOwnerMode} type="button">
            Lock
          </button>
        </div>
      ) : null}

      <main className="page">
        {tab === "order" && (
          <OrderTab
            amountPaid={amountPaid}
            bump={bump}
            clearOrder={clearOrder}
            customer={customer}
            editingInvoiceId={editingInvoiceId}
            filteredCustomerCount={filteredCustomerCount}
            filteredCustomers={filteredCustomers}
            filteredProducts={filteredOrderProducts}
            handleExactQty={handleExactQty}
            invoices={invoices}
            isSearchingCustomers={isSearchingCustomers}
            lines={lines}
            orderAmountPaid={orderAmountPaid}
            orderBalanceDue={orderBalanceDue}
            orderPriceType={orderPriceType}
            orderNote={orderNote}
            openCustomerInvoice={openCustomerInvoice}
            paymentStatus={orderPaymentStatus}
            phone={phone}
            products={products}
            qty={qty}
            saveInvoice={saveInvoice}
            searchOrder={searchOrder}
            selectCustomer={selectCustomer}
            selectedCustomerSummary={selectedCustomerSummary}
            clearSelectedCustomer={clearSelectedCustomer}
            deleteSelectedCustomer={deleteSelectedCustomer}
            setCustomer={updateCustomerName}
            setOrderNote={setOrderNote}
            setOrderPaidStatus={setOrderPaidStatus}
            setOrderPriceType={setOrderPriceType}
            setPhone={updateCustomerPhone}
            setSearchOrder={setSearchOrder}
            total={total}
            updateAmountPaid={updateAmountPaid}
          />
        )}

        {tab === "menu" && (
          <MenuTab
            addProduct={addProduct}
            chooseEditProductPhoto={chooseEditProductPhoto}
            chooseNewProductPhoto={chooseNewProductPhoto}
            deleteProduct={deleteProduct}
            editEmoji={editEmoji}
            editId={editId}
            editName={editName}
            editPhoto={editPhoto}
            editPhotoZoom={editPhotoZoom}
            editRetailPrice={editRetailPrice}
            editWholesalePrice={editWholesalePrice}
            filteredProducts={filteredMenuProducts}
            newEmoji={newEmoji}
            newName={newName}
            newPhoto={newPhoto}
            newPhotoZoom={newPhotoZoom}
            newRetailPrice={newRetailPrice}
            newWholesalePrice={newWholesalePrice}
            saveProductEdit={saveProductEdit}
            searchMenu={searchMenu}
            setEditEmoji={setEditEmoji}
            setEditId={setEditId}
            setEditName={setEditName}
            setEditPhoto={setEditPhoto}
            setEditPhotoZoom={setEditPhotoZoom}
            setEditRetailPrice={setEditRetailPrice}
            setEditWholesalePrice={setEditWholesalePrice}
            setNewEmoji={setNewEmoji}
            setNewName={setNewName}
            setNewPhoto={setNewPhoto}
            setNewPhotoZoom={setNewPhotoZoom}
            setNewRetailPrice={setNewRetailPrice}
            setNewWholesalePrice={setNewWholesalePrice}
            setSearchMenu={setSearchMenu}
            startEditProduct={startEditProduct}
          />
        )}

        {tab === "history" && (
          <HistoryTab
            deleteInvoice={deleteInvoice}
            invoiceCount={invoices.length}
            invoices={filteredInvoices}
            printReceipt={printReceipt}
            receiptRef={receiptRef}
            saveReceiptPdf={saveReceiptPdf}
            saveReceiptPhoto={saveReceiptPhoto}
            searchInvoices={searchInvoices}
            sendSelectedInvoiceOverWifi={sendSelectedInvoiceOverWifi}
            selectedInv={selectedInv}
            setSelectedInvId={setSelectedInvId}
            setSearchInvoices={setSearchInvoices}
            shareReceipt={shareReceipt}
            settings={settings}
            startEditInvoice={startEditInvoice}
            updateInvoicePaymentStatus={updateInvoicePaymentStatus}
          />
        )}

        {tab === "reports" && (
          <ReportsTab
            customEndDate={customReportEndDate}
            customInvoices={customReportInvoices}
            customRange={customReportRange}
            customStartDate={customReportStartDate}
            customSummary={customReportSummary}
            dailyInvoices={dailyReportInvoices}
            dailySummary={dailyReportSummary}
            reportDate={reportDate}
            reportDayLabel={reportDayLabel}
            reportPriceType={reportPriceType}
            setCustomEndDate={setCustomReportEndDate}
            setCustomStartDate={setCustomReportStartDate}
            setReportDate={setReportDate}
            setReportPriceType={setReportPriceType}
            weeklyEndDate={weeklyEndDate}
            weeklyInvoices={weeklyReportInvoices}
            weeklyStartDate={weeklyStartDate}
            weeklySummary={weeklyReportSummary}
          />
        )}

        {tab === "calc" && (
          <CalculatorTab calcInput={calcInput} handleCalcBtn={handleCalcBtn} />
        )}

        {tab === "settings" && (
          <SettingsTab
            downloadBackup={downloadBackup}
            fileInputRef={fileInputRef}
            invoices={invoices}
            sendAllInvoicesOverWifi={sendAllInvoicesOverWifi}
            sendLatestInvoiceOverWifi={sendLatestInvoiceOverWifi}
            settings={settings}
            showToast={showToast}
            startWifiSyncReceiver={startWifiSyncReceiver}
            stopWifiSyncReceiver={stopWifiSyncReceiver}
            syncBusy={syncBusy}
            syncPeerAddress={syncPeerAddress}
            syncStatus={syncStatus}
            setSyncPeerAddress={setSyncPeerAddress}
            testWifiSyncConnection={testWifiSyncConnection}
            updateSetting={updateSetting}
            uploadBackup={uploadBackup}
          />
        )}
      </main>

      <OwnerUnlockModal
        closeOwnerUnlock={closeOwnerUnlock}
        ownerPinInput={ownerPinInput}
        ownerUnlockRequest={ownerUnlockRequest}
        setOwnerPinInput={setOwnerPinInput}
        submitOwnerUnlock={submitOwnerUnlock}
      />
    </div>
  );
}

function OwnerUnlockModal({
  closeOwnerUnlock,
  ownerPinInput,
  ownerUnlockRequest,
  setOwnerPinInput,
  submitOwnerUnlock,
}) {
  if (!ownerUnlockRequest) return null;

  return (
    <div className="modal-backdrop no-print" role="presentation">
      <div className="pin-modal" role="dialog" aria-modal="true">
        <div className="pin-modal-head">
          <div>
            <span>Owner Access</span>
            <h2>{ownerUnlockRequest.title}</h2>
          </div>
          <button className="icon-btn" onClick={closeOwnerUnlock} type="button">
            <X size={18} />
          </button>
        </div>
        <p>{ownerUnlockRequest.message}</p>
        <input
          autoFocus
          className="input pin-input"
          inputMode="numeric"
          onChange={(event) => setOwnerPinInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitOwnerUnlock();
          }}
          placeholder="Enter PIN"
          type="password"
          value={ownerPinInput}
        />
        <div className="button-row">
          <button className="secondary-btn" onClick={closeOwnerUnlock} type="button">
            Cancel
          </button>
          <button className="primary-btn" onClick={submitOwnerUnlock} type="button">
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerPicker({
  clearSelectedCustomer,
  deleteSelectedCustomer,
  customers,
  isSearchingCustomers,
  openCustomerInvoice,
  selectCustomer,
  selectedCustomerSummary,
  totalCustomerCount,
}) {
  if (!customers.length) return null;

  const countLabel =
    totalCustomerCount > customers.length
      ? `${customers.length}/${totalCustomerCount}`
      : String(customers.length);

  return (
    <div className="customer-picker">
      <div className="customer-picker-head">
        <span>{isSearchingCustomers ? "Matching customers" : "Recent customers"}</span>
        <strong>{countLabel}</strong>
      </div>
      <div className="customer-chip-row">
        {customers.map((savedCustomer) => (
          <button
            className="customer-chip"
            key={savedCustomer.id}
            onClick={() => selectCustomer(savedCustomer)}
            type="button"
          >
            <User size={16} />
            <span>
              <strong>{savedCustomer.name || "No name"}</strong>
              {savedCustomer.phone ? <em>{savedCustomer.phone}</em> : null}
            </span>
          </button>
        ))}
      </div>
      <CustomerHistoryPanel
        clearSelectedCustomer={clearSelectedCustomer}
        deleteSelectedCustomer={deleteSelectedCustomer}
        openCustomerInvoice={openCustomerInvoice}
        summary={selectedCustomerSummary}
      />
    </div>
  );
}

function CustomerHistoryPanel({
  clearSelectedCustomer,
  deleteSelectedCustomer,
  openCustomerInvoice,
  summary,
}) {
  if (!summary) return null;

  const recentInvoices = summary.invoices.slice(0, 8);

  return (
    <div className="customer-history">
      <div className="customer-history-head">
        <div>
          <span>Customer history</span>
          <strong>{summary.invoiceCount} invoices</strong>
        </div>
        <button
          className="secondary-btn compact-btn"
          onClick={clearSelectedCustomer}
          type="button"
        >
          <X size={16} />
          Clear
        </button>
        <button
          className="danger-btn compact-btn"
          onClick={deleteSelectedCustomer}
          type="button"
        >
          <Trash2 size={16} />
          Delete
        </button>
        <div className="customer-history-balance">
          <span>Unpaid</span>
          <strong>{money(summary.balance)}</strong>
        </div>
      </div>
      <div className="customer-history-metrics">
        <div>
          <span>Total spent</span>
          <strong>{money(summary.total)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>{money(summary.paid)}</strong>
        </div>
      </div>
      {recentInvoices.length ? (
        <div className="customer-invoice-list">
          {recentInvoices.map((invoice) => {
            const normalized = normalizeInvoice(invoice);

            return (
              <button
                className="customer-invoice-row"
                key={invoice.id}
                onClick={() => openCustomerInvoice(invoice.id)}
                type="button"
              >
                <div>
                  <strong>#{invoice.number}</strong>
                  <span>
                    {invoice.date} at {invoice.time}
                  </span>
                </div>
                <div>
                  <strong>{money(normalized.total)}</strong>
                  <span>នៅសល់ {money(normalized.balanceDue)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">
          <strong>No invoices yet</strong>
        </div>
      )}
    </div>
  );
}

function OrderTab({
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

function ProductVisual({ emoji, photo }) {
  return (
    <div className={`product-emoji ${photo ? "has-photo" : ""}`} aria-hidden="true">
      {photo ? <img alt="" src={photo} /> : emoji || "🧆"}
    </div>
  );
}

function ZoomableProductVisual({
  emoji,
  label = "Product photo",
  photo,
  zoomPhoto,
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const largePhoto = zoomPhoto || photo;

  return (
    <>
      <button
        aria-label={`View ${label}`}
        className={`product-emoji ${photo ? "has-photo" : ""} product-photo-thumb`}
        onClick={() => setZoomOpen(true)}
        type="button"
      >
        {photo ? <img alt="" src={photo} /> : emoji || "🧆"}
      </button>
      {zoomOpen ? (
        <ProductPhotoZoom
          emoji={emoji}
          label={label}
          onClose={() => setZoomOpen(false)}
          photo={largePhoto}
        />
      ) : null}
    </>
  );
}

function ProductPhotoZoom({ emoji, label, onClose, photo }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-label={label}
      aria-modal="true"
      className="product-photo-zoom"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="product-photo-zoom-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close photo"
          className="icon-btn product-photo-close"
          onClick={onClose}
          type="button"
        >
          <X size={22} />
        </button>
        {photo ? (
          <img alt={label} src={photo} />
        ) : (
          <div className="product-photo-zoom-emoji" aria-hidden="true">
            {emoji || "🧆"}
          </div>
        )}
        <strong>{label}</strong>
      </div>
    </div>
  );
}

function ProductPhotoPicker({ emoji, onClear, onPick, photo, zoomPhoto }) {
  return (
    <div className="product-photo-picker">
      <ZoomableProductVisual
        emoji={emoji}
        label="Product photo preview"
        photo={photo}
        zoomPhoto={zoomPhoto}
      />
      <label className="secondary-btn photo-upload-btn">
        <ImageDown size={18} />
        Photo
        <input
          accept="image/*"
          className="file-input"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {photo ? (
        <button className="ghost-btn compact-btn" onClick={onClear} type="button">
          <X size={16} />
          Remove
        </button>
      ) : null}
    </div>
  );
}

function PaymentStatusControl({
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

function PaymentStatusBadge({ invoice }) {
  const status = invoicePaymentStatus(invoice);

  return (
    <span className={`payment-badge ${status}`}>
      {status === "paid" ? "Paid" : "Unpaid"}
    </span>
  );
}

function PriceTypeBadge({ invoice }) {
  const priceType = invoicePriceType(invoice);

  return (
    <span className={`price-type-badge ${priceType}`}>
      {priceType === "wholesale" ? "Wholesale" : "Retail"}
    </span>
  );
}

function OriginBadge({ invoice }) {
  const isReceived = invoice?.syncOrigin === "received";

  return (
    <span className={`origin-badge ${isReceived ? "received" : "local"}`}>
      {isReceived ? "Received" : "Made here"}
    </span>
  );
}

function MenuTab({
  addProduct,
  chooseEditProductPhoto,
  chooseNewProductPhoto,
  deleteProduct,
  editEmoji,
  editId,
  editName,
  editPhoto,
  editPhotoZoom,
  editRetailPrice,
  editWholesalePrice,
  filteredProducts,
  newEmoji,
  newName,
  newPhoto,
  newPhotoZoom,
  newRetailPrice,
  newWholesalePrice,
  saveProductEdit,
  searchMenu,
  setEditEmoji,
  setEditId,
  setEditName,
  setEditPhoto,
  setEditPhotoZoom,
  setEditRetailPrice,
  setEditWholesalePrice,
  setNewEmoji,
  setNewName,
  setNewPhoto,
  setNewPhotoZoom,
  setNewRetailPrice,
  setNewWholesalePrice,
  setSearchMenu,
  startEditProduct,
}) {
  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Menu</h2>
        <div className="menu-form">
          <input
            className="input"
            onChange={(event) => setNewEmoji(event.target.value)}
            placeholder="Icon"
            value={newEmoji}
          />
          <ProductPhotoPicker
            emoji={newEmoji}
            onClear={() => {
              setNewPhoto("");
              setNewPhotoZoom("");
            }}
            onPick={chooseNewProductPhoto}
            photo={newPhoto}
            zoomPhoto={newPhotoZoom}
          />
          <input
            className="input"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Item name"
            value={newName}
          />
          <input
            className="input"
            min="0"
            onChange={(event) => setNewRetailPrice(event.target.value)}
            placeholder="Retail price"
            step="0.01"
            type="number"
            value={newRetailPrice}
          />
          <input
            className="input"
            min="0"
            onChange={(event) => setNewWholesalePrice(event.target.value)}
            placeholder="Wholesale price"
            step="0.01"
            type="number"
            value={newWholesalePrice}
          />
          <button className="primary-btn" onClick={addProduct} type="button">
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      <div className="panel">
        <label className="input-icon">
          <Search size={18} />
          <input
            className="input with-icon"
            onChange={(event) => setSearchMenu(event.target.value)}
            placeholder="Search menu"
            value={searchMenu}
          />
        </label>
        <div className="menu-grid menu-products">
          {filteredProducts.map((product) => (
            <article
              className={`product-card menu-product-card ${
                editId === product.id ? "is-editing" : ""
              }`}
              key={product.id}
            >
              {editId === product.id ? (
                <div className="menu-edit-panel">
                  <div className="menu-edit-head">
                    <div className="product-emoji">{editEmoji || "🧆"}</div>
                    <input
                      className="input"
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Item name"
                      value={editName}
                    />
                  </div>
                  <div className="menu-edit-fields">
                    <input
                      className="input"
                      onChange={(event) => setEditEmoji(event.target.value)}
                      placeholder="Icon"
                      value={editEmoji}
                    />
                    <input
                      className="input"
                      min="0"
                      onChange={(event) => setEditRetailPrice(event.target.value)}
                      placeholder="Retail"
                      step="0.01"
                      type="number"
                      value={editRetailPrice}
                    />
                    <input
                      className="input"
                      min="0"
                      onChange={(event) => setEditWholesalePrice(event.target.value)}
                      placeholder="Wholesale"
                      step="0.01"
                      type="number"
                      value={editWholesalePrice}
                    />
                  </div>
                  <ProductPhotoPicker
                    emoji={editEmoji}
                    onClear={() => {
                      setEditPhoto("");
                      setEditPhotoZoom("");
                    }}
                    onPick={chooseEditProductPhoto}
                    photo={editPhoto}
                    zoomPhoto={editPhotoZoom}
                  />
                  <div className="product-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => setEditId(null)}
                      type="button"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                    <button className="primary-btn" onClick={saveProductEdit} type="button">
                      <Save size={18} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <MenuProductView
                  deleteProduct={deleteProduct}
                  product={product}
                  startEditProduct={startEditProduct}
                />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuProductView({ deleteProduct, product, startEditProduct }) {
  const normalized = normalizeProduct(product);

  return (
    <>
      <div className="menu-product-head">
        <ZoomableProductVisual
          emoji={normalized.emoji}
          label={normalized.name}
          photo={normalized.photo}
          zoomPhoto={normalized.photoZoom}
        />
        <div className="product-name">{normalized.name}</div>
      </div>
      <div className="price-pair">
        <div>
          <span>Retail</span>
          <strong>{money(normalized.retailPrice)}</strong>
        </div>
        <div>
          <span>Wholesale</span>
          <strong>{money(normalized.wholesalePrice)}</strong>
        </div>
      </div>
                  <div className="product-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => startEditProduct(normalized)}
                      type="button"
                    >
                      <Pencil size={18} />
                      Edit
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => deleteProduct(normalized.id)}
                      type="button"
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  </div>
    </>
  );
}

function HistoryTab({
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

function ReportsTab({
  customEndDate,
  customInvoices,
  customRange,
  customStartDate,
  customSummary,
  dailyInvoices,
  dailySummary,
  reportDate,
  reportDayLabel,
  reportPriceType,
  setCustomEndDate,
  setCustomStartDate,
  setReportDate,
  setReportPriceType,
  weeklyEndDate,
  weeklyInvoices,
  weeklyStartDate,
  weeklySummary,
}) {
  return (
    <section className="section">
      <div className="panel report-controls">
        <div>
          <h2 className="section-title">Reports</h2>
          <p>Daily and weekly sales from saved invoices.</p>
        </div>
        <div className="report-control-panel">
          <div className="report-type-row" role="group" aria-label="Report price type">
            {[
              { id: "all", label: "All" },
              { id: "retail", label: "Retail" },
              { id: "wholesale", label: "Wholesale" },
            ].map((mode) => (
              <button
                className={`segmented-btn ${
                  reportPriceType === mode.id ? "active" : ""
                }`}
                key={mode.id}
                onClick={() => setReportPriceType(mode.id)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="report-date-actions">
            <label className="report-date-field">
              <span>Day / Week</span>
              <input
                className="input"
                onChange={(event) => setReportDate(event.target.value)}
                type="date"
                value={reportDate}
              />
            </label>
            <button
              className="secondary-btn"
              onClick={() => setReportDate(toDateInputValue(new Date()))}
              type="button"
            >
              Today
            </button>
          </div>
          <div className="report-range-actions">
            <label>
              <span>From</span>
              <input
                className="input"
                onChange={(event) => setCustomStartDate(event.target.value)}
                type="date"
                value={customStartDate}
              />
            </label>
            <label>
              <span>To</span>
              <input
                className="input"
                onChange={(event) => setCustomEndDate(event.target.value)}
                type="date"
                value={customEndDate}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="report-grid">
        <ReportSummaryPanel
          invoices={dailyInvoices}
          label={reportDayLabel}
          summary={dailySummary}
          title="Daily"
        />
        <ReportSummaryPanel
          invoices={weeklyInvoices}
          label={`${formatDate(weeklyStartDate)} - ${formatDate(weeklyEndDate)}`}
          summary={weeklySummary}
          title="Weekly"
        />
        <ReportSummaryPanel
          invoices={customInvoices}
          label={`${formatDate(customRange.start)} - ${formatDate(customRange.end)}`}
          summary={customSummary}
          title="Custom"
        />
      </div>
    </section>
  );
}

function ReportSummaryPanel({ invoices, label, summary, title }) {
  return (
    <div className="panel report-panel">
      <div className="report-panel-head">
        <div>
          <span>{title} Report</span>
          <h3>{label}</h3>
        </div>
        <strong>{summary.invoiceCount}</strong>
      </div>

      <div className="report-total">
        <span>Total Sales</span>
        <strong>{money(summary.total)}</strong>
      </div>

      <div className="report-metrics">
        <ReportMetric label="ប្រាក់បានបង់" value={money(summary.paid)} />
        <ReportMetric label="ប្រាក់នៅសល់" value={money(summary.balance)} />
        <ReportMetric label="Items sold" value={summary.itemQuantity} />
        <ReportMetric label="Average sale" value={money(summary.averageInvoice)} />
        <ReportMetric label="Retail" value={money(summary.retail)} />
        <ReportMetric label="Wholesale" value={money(summary.wholesale)} />
        <ReportMetric label="Paid invoices" value={summary.paidInvoices} />
        <ReportMetric label="Unpaid invoices" value={summary.unpaidInvoices} />
      </div>

      <ReportTopItems items={summary.topItems} />

      {invoices.length ? (
        <div className="report-invoice-list">
          {invoices.map((invoice) => {
            const normalized = normalizeInvoice(invoice);

            return (
              <div className="report-invoice-row" key={invoice.id}>
                <div>
                  <div className="report-invoice-name">
                    #{invoice.number} · {invoice.customer || "Walk-in"}
                  </div>
                  <div className="invoice-meta">
                    {invoice.date} at {invoice.time}
                    {invoice.phone ? ` · ${invoice.phone}` : ""}
                  </div>
                  <div className="report-badge-row">
                    <PaymentStatusBadge invoice={normalized} />
                    <PriceTypeBadge invoice={normalized} />
                  </div>
                </div>
                <div className="invoice-total-block">
                  <div className="invoice-total">{money(normalized.total)}</div>
                  <div className="invoice-balance">
                    នៅសល់ {money(normalized.balanceDue)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">
          <div className="empty-icon">ðŸ§¾</div>
          <strong>No invoices</strong>
        </div>
      )}
    </div>
  );
}

function ReportTopItems({ items }) {
  if (!items?.length) return null;

  return (
    <div className="report-top-items">
      <div className="report-subhead">
        <span>Best sellers</span>
        <strong>Qty</strong>
      </div>
      {items.map((item, index) => (
        <div className="report-top-item" key={`${item.name}-${index}`}>
          <div>
            <strong>{item.name}</strong>
            <span>{money(item.total)}</span>
          </div>
          <b>{item.quantity}</b>
        </div>
      ))}
    </div>
  );
}

function ReportMetric({ label, value }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Receipt({ invoice, settings }) {
  const normalizedInvoice = normalizeInvoice(invoice);
  const invoiceNumber = String(invoice.number).padStart(6, "0");

  return (
    <article className="receipt invoice-print-area">
      <div className="invoice-top">
        <div>
          <div className="khmer-name">{settings.khmerName}</div>
          <h1 className="shop-name">SREYOUN MEATBALL</h1>
          <div className="shop-phone">{settings.phoneNumbers}</div>
        </div>
        <div>
          <div className="receipt-number">
            Nº <span>{invoiceNumber}</span>
          </div>
          <div className="receipt-date">Date: {invoice.date} {invoice.time}</div>
        </div>
      </div>

      <div className="invoice-info-row">
        <div className="customer-info">
          <div>
            <strong>ឈ្មោះអតិថិជន / Customer:</strong>{" "}
            {invoice.customer || "....................................................."}
          </div>
          <div>
            <strong>លេខទូរស័ព្ទ / Phone:</strong>{" "}
            {invoice.phone || "....................................................."}
          </div>
        </div>
        <div className="bank-box">
          <div className="bank-title">ABA Bank</div>
          <div>{settings.bankAccount1}</div>
          {settings.bankAccount2 ? <div>{settings.bankAccount2}</div> : null}
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: "5%" }}>
              ល.រ
              <br />
              Nº
            </th>
            <th style={{ width: "45%" }}>
              បរិយាយ
              <br />
              Description
            </th>
            <th style={{ width: "15%" }}>
              បរិមាណ
              <br />
              Quantity
            </th>
            <th style={{ width: "15%" }}>
              តម្លៃរាយ
              <br />
              Unit Price
            </th>
            <th style={{ width: "20%" }}>
              តម្លៃសរុប
              <br />
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={`${line.id}-${index}`}>
              <td className="num-cell">{index + 1}</td>
              <td>{line.name}</td>
              <td className="num-cell">{line.q}</td>
              <td className="money-cell">{money(line.price)}</td>
              <td className="money-cell strong-cell">{money(line.line)}</td>
            </tr>
          ))}
          <tr>
            <td className="invoice-total-label" colSpan="4">
              សរុបទឹកប្រាក់ / Total:
            </td>
            <td className="invoice-total-value">
              {money(normalizedInvoice.total)}
            </td>
          </tr>
          <tr>
            <td className="invoice-total-label" colSpan="4">
              ប្រាក់បានបង់:
            </td>
            <td className="invoice-total-value">
              {money(normalizedInvoice.amountPaid)}
            </td>
          </tr>
          <tr>
            <td className="invoice-total-label" colSpan="4">
              ប្រាក់នៅសល់:
            </td>
            <td className="invoice-total-value">
              {money(normalizedInvoice.balanceDue)}
            </td>
          </tr>
        </tbody>
      </table>

      {invoice.note ? (
        <div className="invoice-note">
          <strong>ចំណាំ / Note:</strong> {invoice.note}
        </div>
      ) : null}
    </article>
  );
}

function CalculatorTab({ calcInput, handleCalcBtn }) {
  const buttons = [
    { label: "C", type: "action" },
    { label: "⌫", type: "action" },
    { label: "÷", val: "/", type: "op" },
    { label: "×", val: "*", type: "op" },
    { label: "7" },
    { label: "8" },
    { label: "9" },
    { label: "-", type: "op" },
    { label: "4" },
    { label: "5" },
    { label: "6" },
    { label: "+", type: "op" },
    { label: "1" },
    { label: "2" },
    { label: "3" },
    { label: "=", type: "equal", rowSpan: 2 },
    { label: "0" },
    { label: "00" },
    { label: "." },
  ];

  return (
    <section className="section calc-section">
      <div className="panel calc-shell">
        <div className="calc-display">
          <div>{calcInput || "0"}</div>
        </div>
        <div className="calc-grid">
          {buttons.map((button, index) => (
            <button
              className={`calc-btn ${
                button.type === "op" ? "operator" : ""
              } ${button.type === "action" ? "action" : ""} ${
                button.type === "equal" ? "equals" : ""
              }`}
              key={`${button.label}-${index}`}
              onClick={() => handleCalcBtn(button.val || button.label)}
              style={{
                gridRow: button.rowSpan ? `span ${button.rowSpan}` : "auto",
              }}
              type="button"
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SettingsTab({
  downloadBackup,
  fileInputRef,
  invoices,
  sendAllInvoicesOverWifi,
  sendLatestInvoiceOverWifi,
  settings,
  showToast,
  startWifiSyncReceiver,
  stopWifiSyncReceiver,
  syncBusy,
  syncPeerAddress,
  syncStatus,
  setSyncPeerAddress,
  testWifiSyncConnection,
  updateSetting,
  uploadBackup,
}) {
  const receiverAddress = syncStatus.url || "Not running";
  const hasInvoices = invoices.length > 0;

  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Invoice Settings</h2>
        <div className="settings-grid">
          <input
            className="input"
            onChange={(event) => updateSetting("khmerName", event.target.value)}
            placeholder="Shop name in Khmer"
            value={settings.khmerName}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("phoneNumbers", event.target.value)}
            placeholder="Phone numbers"
            value={settings.phoneNumbers}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("bankAccount1", event.target.value)}
            placeholder="ABA Bank account 1"
            value={settings.bankAccount1}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("bankAccount2", event.target.value)}
            placeholder="ABA Bank account 2"
            value={settings.bankAccount2}
          />
          <input
            className="input"
            inputMode="numeric"
            onChange={(event) => updateSetting("ownerPin", event.target.value)}
            placeholder="Owner PIN"
            type="password"
            value={settings.ownerPin || ""}
          />
          <button
            className="primary-btn settings-save"
            onClick={() => showToast("Settings saved.")}
            type="button"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title">WiFi Sync</h2>
        <div className="sync-grid">
          <div className={`sync-card ${syncStatus.running ? "active" : ""}`}>
            <div className="sync-card-head">
              <span>This Device</span>
              <strong>{syncStatus.running ? "Receiving" : "Stopped"}</strong>
            </div>
            <input
              className="input"
              onChange={(event) => updateSetting("deviceName", event.target.value)}
              placeholder="Device name, example Tablet or Sunmi"
              value={settings.deviceName || ""}
            />
            <div className="sync-options">
              <label className="toggle-row">
                <input
                  checked={Boolean(settings.autoPrintReceivedInvoices)}
                  onChange={(event) =>
                    updateSetting("autoPrintReceivedInvoices", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Auto-print received invoices</span>
              </label>
              <label className="toggle-row">
                <input
                  checked={Boolean(settings.syncMenuPricesOnWifi)}
                  onChange={(event) =>
                    updateSetting("syncMenuPricesOnWifi", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Sync menu/prices when receiving</span>
              </label>
            </div>
            <div className="sync-address">{receiverAddress}</div>
            <div className="button-row">
              <button
                className="primary-btn"
                onClick={startWifiSyncReceiver}
                type="button"
              >
                <Wifi size={18} />
                Start Receive
              </button>
              <button
                className="secondary-btn"
                onClick={stopWifiSyncReceiver}
                type="button"
              >
                Stop
              </button>
            </div>
          </div>

          <div className="sync-card">
            <div className="sync-card-head">
              <span>Send To Device</span>
              <strong>{syncBusy ? "Sending" : "Ready"}</strong>
            </div>
            <input
              className="input"
              onChange={(event) => setSyncPeerAddress(event.target.value)}
              placeholder="192.168.1.20:8787"
              value={syncPeerAddress}
            />
            <div className="button-row">
              <button
                className="secondary-btn"
                disabled={syncBusy}
                onClick={testWifiSyncConnection}
                type="button"
              >
                <Wifi size={18} />
                Test
              </button>
              <button
                className="secondary-btn"
                disabled={syncBusy || !hasInvoices}
                onClick={sendLatestInvoiceOverWifi}
                type="button"
              >
                <Send size={18} />
                Latest
              </button>
              <button
                className="primary-btn"
                disabled={syncBusy || !hasInvoices}
                onClick={sendAllInvoicesOverWifi}
                type="button"
              >
                <Upload size={18} />
                All Invoices
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title">Backup</h2>
        <div className="button-row">
          <button className="secondary-btn" onClick={downloadBackup} type="button">
            <Download size={18} />
            Download
          </button>
          <input
            accept=".json,application/json"
            onChange={uploadBackup}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
          />
          <button
            className="primary-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload size={18} />
            Upload
          </button>
        </div>
      </div>
    </section>
  );
}
