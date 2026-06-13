import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  Calculator,
  CalendarDays,
  ReceiptText,
  Settings,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { evaluateCalcExpression, sanitizeCalc } from "./helpers/calc";
import {
  customerKey,
  customersFromInvoices,
  mergeCustomers,
  normalizeCustomer,
  summarizeCustomerInvoices,
  upsertCustomer,
} from "./helpers/customer";
import {
  backupFileName,
  dataUrlToBlob,
  downloadDataUrl,
  escapeHtml,
  formatDate,
  formatTime,
  money,
  parseDateInput,
  parseInvoiceDate,
  startOfBusinessWeek,
  endOfBusinessWeek,
  startOfMonth,
  toDateInputValue,
} from "./helpers/format";
import { genId } from "./helpers/id";
import {
  invoiceAmountPaid,
  invoicePaymentStatus,
  invoicePriceType,
  normalizeInvoice,
  normalizeInvoices,
  parseMoneyInput,
} from "./helpers/invoice";
import { resizeProductPhoto } from "./helpers/photo";
import {
  getProductPrice,
  normalizeProduct,
  normalizeProducts,
} from "./helpers/product";
import { summarizeInvoices } from "./helpers/report";
import {
  WIFI_SYNC_PORT,
  buildWifiSyncPayload,
  currentDeviceName,
  invoiceOriginLabel,
  mergeSyncedInvoices,
  nextInvoiceCounter,
  normalizeSyncAddress,
} from "./helpers/sync";
import {
  CalculatorTab,
  HistoryTab,
  MenuTab,
  OrderTab,
  OwnerUnlockModal,
  ReportsTab,
  SettingsTab,
} from "./components";

const STORAGE_KEY = "meatball-pos-v2";
const DEFAULT_OWNER_PIN = "1234";
const CUSTOMER_RECENT_LIMIT = 6;
const CUSTOMER_SEARCH_LIMIT = 8;
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
      "\u232b",
      "\u00f7",
      "\u00d7",
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

    if (value === "\u232b") {
      setCalcInput((current) => current.slice(0, -1));
      return;
    }

    if (value === "=") {
      if (!calcInput) return;
      const parsed = sanitizeCalc(calcInput);
      if (!parsed.trim()) return;

      try {
        const result = evaluateCalcExpression(parsed);
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
