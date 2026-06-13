import { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { evaluateCalcExpression, sanitizeCalc } from "../helpers/calc";
import {
  customerKey, customersFromInvoices, mergeCustomers, normalizeCustomer, summarizeCustomerInvoices, upsertCustomer,
} from "../helpers/customer";
import {
  backupFileName, dataUrlToBlob, downloadDataUrl, escapeHtml, formatDate, formatTime, money, parseDateInput, parseInvoiceDate,
  startOfBusinessWeek, endOfBusinessWeek, startOfMonth, toDateInputValue,
} from "../helpers/format";
import { genId } from "../helpers/id";
import { invoiceAmountPaid, invoicePaymentStatus, invoicePriceType, normalizeInvoice, normalizeInvoices, parseMoneyInput } from "../helpers/invoice";
import { resizeProductPhoto } from "../helpers/photo";
import { getProductPrice, normalizeProduct, normalizeProducts } from "../helpers/product";
import { summarizeInvoices } from "../helpers/report";
import {
  WIFI_SYNC_PORT, buildWifiSyncPayload, currentDeviceName, invoiceOriginLabel, mergeSyncedInvoices, nextInvoiceCounter, normalizeSyncAddress,
} from "../helpers/sync";
import buildInvoiceHtml from "../templates/buildInvoiceHtml";
import buildSunmiReceiptData from "../templates/buildSunmiData";

const NativePrinter = registerPlugin("SreyounPrint");
const DEFAULT_OWNER_PIN = "1234";
const CUSTOMER_RECENT_LIMIT = 6;
const CUSTOMER_SEARCH_LIMIT = 8;

const DEFAULT_PRODUCTS = [
  { id: "p1", emoji: "🧆", name: "Classic Meatballs (6 pcs)", retailPrice: 8.99, wholesalePrice: 7.99 },
  { id: "p2", emoji: "🔥", name: "Spicy Meatballs (6 pcs)", retailPrice: 10.99, wholesalePrice: 9.99 },
  { id: "p3", emoji: "🥖", name: "Meatball Sub Sandwich", retailPrice: 13.99, wholesalePrice: 12.49 },
  { id: "p4", emoji: "📦", name: "Family Pack (20 pcs)", retailPrice: 26.99, wholesalePrice: 24.99 },
  { id: "p5", emoji: "🫙", name: "Extra Sauce", retailPrice: 1.5, wholesalePrice: 1.25 },
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

const PosContext = createContext(null);

export function usePosContext() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePosContext must be used inside PosProvider");
  return ctx;
}

export function PosProvider({ children }) {
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
  const [customReportStartDate, setCustomReportStartDate] = useState(() => toDateInputValue(startOfMonth(new Date())));
  const [customReportEndDate, setCustomReportEndDate] = useState(() => toDateInputValue(new Date()));
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
  const [syncStatus, setSyncStatus] = useState({ ip: "", port: WIFI_SYNC_PORT, running: false, url: "" });
  const [syncBusy, setSyncBusy] = useState(false);
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState("");
  const [ownerUnlockRequest, setOwnerUnlockRequest] = useState(null);

  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const receiptRef = useRef(null);
  const receiveWifiSyncPayloadRef = useRef(null);

  // --- Load from localStorage ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem("meatball-pos-v2");
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.products) && data.products.length) setProducts(normalizeProducts(data.products));
        if (Array.isArray(data.invoices)) setInvoices(normalizeInvoices(data.invoices));
        if (Array.isArray(data.customers)) setCustomers(mergeCustomers(data.customers));
        if (Array.isArray(data.hiddenCustomerKeys)) setHiddenCustomerKeys(data.hiddenCustomerKeys.filter(Boolean));
        if (Number.isFinite(data.invCounter)) setInvCounter(data.invCounter);
        if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
        if (data.syncPeerAddress) setSyncPeerAddress(data.syncPeerAddress);
      }
    } catch {
      localStorage.removeItem("meatball-pos-v2");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Save to localStorage ---
  useEffect(() => {
    if (loading) return;
    localStorage.setItem("meatball-pos-v2", JSON.stringify({
      products, invoices, customers, hiddenCustomerKeys, invCounter, settings, syncPeerAddress,
    }));
  }, [products, invoices, customers, hiddenCustomerKeys, invCounter, settings, syncPeerAddress, loading]);

  // --- Auto-deselect deleted invoice ---
  useEffect(() => {
    if (selectedInvId && !invoices.some(inv => inv.id === selectedInvId)) {
      setSelectedInvId(null);
    }
  }, [invoices, selectedInvId]);

  // --- Derived state ---
  const lines = useMemo(() =>
    products.filter(p => (qty[p.id] || 0) > 0).map(product => {
      const price = getProductPrice(product, orderPriceType);
      return { ...normalizeProduct(product), price, priceType: orderPriceType, q: qty[product.id], line: +(price * qty[product.id]).toFixed(2) };
    }), [orderPriceType, products, qty]);

  const total = useMemo(() => +lines.reduce((s, l) => s + l.line, 0).toFixed(2), [lines]);
  const orderAmountPaid = useMemo(() => Math.min(parseMoneyInput(amountPaid), total), [amountPaid, total]);
  const orderBalanceDue = useMemo(() => +Math.max(total - orderAmountPaid, 0).toFixed(2), [orderAmountPaid, total]);
  const orderPaymentStatus = total > 0 && orderBalanceDue <= 0 ? "paid" : "unpaid";

  const todayStr = formatDate(new Date());
  const todayInvoices = invoices.filter(inv => inv.date === todayStr);
  const todaySales = +todayInvoices.reduce((s, inv) => s + inv.total, 0).toFixed(2);

  const filteredOrderProducts = products.filter(p => p.name.toLowerCase().includes(searchOrder.toLowerCase()));
  const knownCustomers = useMemo(() => {
    const hiddenKeys = new Set(hiddenCustomerKeys);
    return mergeCustomers(customers, customersFromInvoices(invoices)).filter(c => !hiddenKeys.has(customerKey(c)));
  }, [customers, hiddenCustomerKeys, invoices]);
  const customerLookupText = `${customer} ${phone}`.trim().toLowerCase();
  const isSearchingCustomers = customerLookupText.length > 0;
  const customerPickerData = useMemo(() => {
    const matches = isSearchingCustomers ? knownCustomers.filter(c => [c.name, c.phone].join(" ").toLowerCase().includes(customerLookupText)) : knownCustomers;
    const limit = isSearchingCustomers ? CUSTOMER_SEARCH_LIMIT : CUSTOMER_RECENT_LIMIT;
    return { customers: matches.slice(0, limit), total: matches.length };
  }, [customerLookupText, isSearchingCustomers, knownCustomers]);
  const filteredCustomers = customerPickerData.customers;
  const filteredCustomerCount = customerPickerData.total;
  const selectedCustomerSummary = useMemo(() => selectedCustomer ? summarizeCustomerInvoices(selectedCustomer, invoices) : null, [invoices, selectedCustomer]);
  const filteredMenuProducts = products.filter(p => p.name.toLowerCase().includes(searchMenu.toLowerCase()));
  const filteredInvoices = useMemo(() => {
    const terms = searchInvoices.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return invoices;
    return invoices.filter(inv => {
      const norm = normalizeInvoice(inv);
      const invNum = String(norm.number).padStart(6, "0");
      const searchable = [String(norm.number), invNum, norm.customer, norm.phone, norm.date, norm.time, norm.priceType || "retail", invoicePaymentStatus(norm), invoiceOriginLabel(norm), norm.createdOnDeviceName, norm.receivedFromDeviceName, money(norm.total), money(norm.amountPaid), money(norm.balanceDue)].join(" ").toLowerCase();
      return terms.every(t => searchable.includes(t));
    });
  }, [invoices, searchInvoices]);
  const invoiceCount = invoices.length;
  const selectedInv = invoices.find(inv => inv.id === selectedInvId);
  const selectedReportDate = useMemo(() => parseDateInput(reportDate), [reportDate]);
  const reportDayLabel = formatDate(selectedReportDate);
  const weeklyStartDate = useMemo(() => startOfBusinessWeek(selectedReportDate), [selectedReportDate]);
  const weeklyEndDate = useMemo(() => endOfBusinessWeek(selectedReportDate), [selectedReportDate]);
  const customReportRange = useMemo(() => {
    const first = parseDateInput(customReportStartDate);
    const second = parseDateInput(customReportEndDate);
    const start = first <= second ? first : second;
    const end = first <= second ? second : first;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [customReportEndDate, customReportStartDate]);
  const dailyReportInvoices = useMemo(() => invoices.filter(inv => {
    const d = parseInvoiceDate(inv.date);
    return d && formatDate(d) === reportDayLabel && (reportPriceType === "all" || invoicePriceType(inv) === reportPriceType);
  }), [invoices, reportDayLabel, reportPriceType]);
  const weeklyReportInvoices = useMemo(() => invoices.filter(inv => {
    const d = parseInvoiceDate(inv.date);
    return d && d >= weeklyStartDate && d <= weeklyEndDate && (reportPriceType === "all" || invoicePriceType(inv) === reportPriceType);
  }), [invoices, reportPriceType, weeklyEndDate, weeklyStartDate]);
  const customReportInvoices = useMemo(() => invoices.filter(inv => {
    const d = parseInvoiceDate(inv.date);
    return d && d >= customReportRange.start && d <= customReportRange.end && (reportPriceType === "all" || invoicePriceType(inv) === reportPriceType);
  }), [customReportRange, invoices, reportPriceType]);
  const dailyReportSummary = useMemo(() => summarizeInvoices(dailyReportInvoices), [dailyReportInvoices]);
  const weeklyReportSummary = useMemo(() => summarizeInvoices(weeklyReportInvoices), [weeklyReportInvoices]);
  const customReportSummary = useMemo(() => summarizeInvoices(customReportInvoices), [customReportInvoices]);

  // --- Handlers ---
  const showToast = useCallback((msg, type = "ok") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const requestOwnerUnlock = useCallback(({ title, message, onUnlock }) => {
    if (ownerUnlocked) { onUnlock?.(); return; }
    setOwnerPinInput("");
    setOwnerUnlockRequest({ title: title || "Owner PIN", message: message || "Enter owner PIN to continue.", onUnlock });
  }, [ownerUnlocked]);

  const closeOwnerUnlock = useCallback(() => {
    setOwnerPinInput("");
    setOwnerUnlockRequest(null);
  }, []);

  const submitOwnerUnlock = useCallback(() => {
    const expectedPin = String(settings.ownerPin || DEFAULT_OWNER_PIN);
    if (String(ownerPinInput).trim() !== expectedPin) { showToast("Wrong owner PIN.", "err"); return; }
    const nextAction = ownerUnlockRequest?.onUnlock;
    setOwnerUnlocked(true);
    closeOwnerUnlock();
    showToast("Owner mode unlocked.");
    nextAction?.();
  }, [settings.ownerPin, ownerPinInput, ownerUnlockRequest, closeOwnerUnlock, showToast]);

  const lockOwnerMode = useCallback(() => {
    setOwnerUnlocked(false);
    setEditId(null);
    if (tab === "menu" || tab === "settings") setTab("order");
    showToast("Owner mode locked.");
  }, [tab, showToast]);

  const selectTab = useCallback((nextTab) => {
    const openTab = () => { setTab(nextTab); if (nextTab !== "history") setSelectedInvId(null); };
    if ((nextTab === "menu" || nextTab === "settings") && !ownerUnlocked) {
      requestOwnerUnlock({
        title: nextTab === "menu" ? "Unlock Menu" : "Unlock Settings",
        message: nextTab === "menu" ? "Owner PIN is required to add, edit, or delete menu prices." : "Owner PIN is required to change app settings.",
        onUnlock: openTab,
      });
      return;
    }
    openTab();
  }, [ownerUnlocked, requestOwnerUnlock]);

  const bump = useCallback((id, delta) => {
    setQty(prev => {
      const nextValue = Math.max(0, (prev[id] || 0) + delta);
      const next = { ...prev };
      if (nextValue === 0) delete next[id];
      else next[id] = nextValue;
      return next;
    });
  }, []);

  const handleExactQty = useCallback((id, value) => {
    if (value === "") { setQty(prev => { const n = { ...prev }; delete n[id]; return n; }); return; }
    const number = Number.parseInt(value, 10);
    if (!Number.isNaN(number) && number >= 0) {
      setQty(prev => { const n = { ...prev }; if (number === 0) delete n[id]; else n[id] = number; return n; });
    }
  }, []);

  const updateAmountPaid = useCallback((value) => {
    const parsed = Math.min(parseMoneyInput(value), total);
    setAmountPaid(value);
    setPaymentStatus(total > 0 && parsed >= total ? "paid" : "unpaid");
  }, [total]);

  const setOrderPaidStatus = useCallback((nextStatus) => {
    const normalized = nextStatus === "paid" ? "paid" : "unpaid";
    setPaymentStatus(normalized);
    setAmountPaid(normalized === "paid" ? String(total) : "");
  }, [total]);

  const updateCustomerName = useCallback((value) => { setCustomer(value); setSelectedCustomer(null); }, []);
  const updateCustomerPhone = useCallback((value) => { setPhone(value); setSelectedCustomer(null); }, []);

  const rememberCustomer = useCallback((customerName, customerPhone) => {
    if (!customerName.trim() && !customerPhone.trim()) return;
    const key = customerKey({ name: customerName, phone: customerPhone });
    setHiddenCustomerKeys(prev => prev.filter(hk => hk !== key));
    setCustomers(prev => upsertCustomer(prev, { name: customerName, phone: customerPhone }));
  }, []);

  const selectCustomer = useCallback((savedCustomer) => {
    const normalized = normalizeCustomer(savedCustomer);
    setSelectedCustomer(normalized);
    setCustomer(normalized.name || "");
    setPhone(normalized.phone || "");
    showToast("Customer selected.");
  }, [showToast]);

  const clearSelectedCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomer("");
    setPhone("");
    showToast("Customer cleared.");
  }, [showToast]);

  const deleteSelectedCustomer = useCallback(() => {
    if (!selectedCustomer) return;
    const key = customerKey(selectedCustomer);
    setHiddenCustomerKeys(prev => prev.includes(key) ? prev : [...prev, key]);
    setCustomers(prev => prev.filter(c => customerKey(c) !== key));
    setSelectedCustomer(null);
    setCustomer("");
    setPhone("");
    showToast("Customer removed. Invoices kept.", "err");
  }, [selectedCustomer, showToast]);

  const openCustomerInvoice = useCallback((invoiceId) => {
    setSelectedInvId(invoiceId);
    setTab("history");
  }, []);

  const clearOrder = useCallback(() => {
    setQty({});
    setCustomer("");
    setPhone("");
    setSelectedCustomer(null);
    setOrderNote("");
    setPaymentStatus("unpaid");
    setAmountPaid("");
    setEditingInvoiceId(null);
  }, []);

  const startEditInvoice = useCallback((invoice) => {
    const nextQty = {};
    invoice.lines.forEach(line => { nextQty[line.id] = line.q; });
    setOrderPriceType(invoice.priceType || invoice.lines[0]?.priceType || "retail");
    setPaymentStatus(invoicePaymentStatus(invoice));
    setAmountPaid(invoiceAmountPaid(invoice) > 0 ? String(invoiceAmountPaid(invoice)) : "");
    setQty(nextQty);
    setCustomer(invoice.customer || "");
    setPhone(invoice.phone || "");
    setOrderNote(invoice.note || "");
    setEditingInvoiceId(invoice.id);
    setTab("order");
    showToast(`Editing invoice #${invoice.number}`);
  }, [showToast]);

  const saveInvoice = useCallback(() => {
    if (!lines.length) { showToast("Add at least one item first.", "err"); return; }
    const finalCustomer = customer.trim();
    const finalPhone = phone.trim();
    const parsedAmountPaid = Math.min(parseMoneyInput(amountPaid), total);
    const finalAmountPaid = paymentStatus === "paid" && parsedAmountPaid <= 0 ? total : parsedAmountPaid;
    const finalBalanceDue = +Math.max(total - finalAmountPaid, 0).toFixed(2);
    const finalPaymentStatus = finalBalanceDue <= 0 ? "paid" : "unpaid";

    if (editingInvoiceId) {
      let updatedInvoice = null;
      setInvoices(prev => prev.map(inv => {
        if (inv.id !== editingInvoiceId) return inv;
        updatedInvoice = { ...inv, customer: finalCustomer, phone: finalPhone, note: orderNote.trim(), lines, priceType: orderPriceType, amountPaid: finalAmountPaid, balanceDue: finalBalanceDue, paymentStatus: finalPaymentStatus, total, time: formatTime(new Date()) };
        return updatedInvoice;
      }));
      rememberCustomer(finalCustomer, finalPhone);
      if (updatedInvoice) setSelectedInvId(updatedInvoice.id);
      clearOrder();
      setTab("history");
      showToast(`Invoice #${updatedInvoice?.number} updated.`);
      return;
    }

    const invoice = {
      id: genId(), number: invCounter, date: formatDate(new Date()), time: formatTime(new Date()),
      customer: finalCustomer, phone: finalPhone, note: orderNote.trim(), lines, priceType: orderPriceType,
      amountPaid: finalAmountPaid, balanceDue: finalBalanceDue, paymentStatus: finalPaymentStatus, total,
      syncOrigin: "local", createdOnDeviceName: currentDeviceName(settings), createdAtDevice: new Date().toISOString(),
    };
    setInvoices(prev => [invoice, ...prev]);
    rememberCustomer(finalCustomer, finalPhone);
    setInvCounter(prev => prev + 1);
    setSelectedInvId(invoice.id);
    clearOrder();
    setTab("history");
    showToast(`Invoice #${invoice.number} created.`);
  }, [lines, customer, phone, amountPaid, paymentStatus, total, editingInvoiceId, orderPriceType, orderNote, invCounter, settings, rememberCustomer, clearOrder, showToast]);

  const deleteInvoice = useCallback((id) => {
    const doDelete = () => { setInvoices(prev => prev.filter(inv => inv.id !== id)); setSelectedInvId(null); showToast("Invoice deleted.", "err"); };
    if (!ownerUnlocked) { requestOwnerUnlock({ title: "Delete Invoice", message: "Owner PIN is required to delete invoices.", onUnlock: doDelete }); return; }
    doDelete();
  }, [ownerUnlocked, requestOwnerUnlock, showToast]);

  const updateInvoicePaymentStatus = useCallback((id, nextStatus) => {
    const normalized = nextStatus === "paid" ? "paid" : "unpaid";
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== id) return inv;
      const totalDue = Number(inv.total || 0);
      const amt = normalized === "paid" ? totalDue : 0;
      return { ...inv, amountPaid: +amt.toFixed(2), balanceDue: normalized === "paid" ? 0 : +totalDue.toFixed(2), paymentStatus: normalized };
    }));
    showToast(`Invoice marked ${normalized}.`);
  }, [showToast]);

  const chooseNewProductPhoto = useCallback(async (file) => {
    if (!file) return;
    try { const resized = await resizeProductPhoto(file); setNewPhoto(resized.thumb); setNewPhotoZoom(resized.zoom); showToast("Photo added."); }
    catch { showToast("Could not use that photo.", "err"); }
  }, [showToast]);

  const chooseEditProductPhoto = useCallback(async (file) => {
    if (!file) return;
    try { const resized = await resizeProductPhoto(file); setEditPhoto(resized.thumb); setEditPhotoZoom(resized.zoom); showToast("Photo updated."); }
    catch { showToast("Could not use that photo.", "err"); }
  }, [showToast]);

  const addProduct = useCallback(() => {
    const retailPrice = Number.parseFloat(newRetailPrice);
    const wholesalePrice = Number.parseFloat(newWholesalePrice);
    if (!newName.trim() || Number.isNaN(retailPrice) || Number.isNaN(wholesalePrice) || retailPrice < 0 || wholesalePrice < 0) {
      showToast("Enter product name, retail price, and wholesale price.", "err"); return;
    }
    setProducts(prev => [...prev, { id: genId(), emoji: newEmoji.trim() || "🧆", photo: newPhoto, photoZoom: newPhotoZoom, name: newName.trim(), retailPrice: +retailPrice.toFixed(2), wholesalePrice: +wholesalePrice.toFixed(2) }]);
    setNewName(""); setNewEmoji("🧆"); setNewPhoto(""); setNewPhotoZoom(""); setNewRetailPrice(""); setNewWholesalePrice("");
    showToast("Item added.");
  }, [newName, newEmoji, newPhoto, newPhotoZoom, newRetailPrice, newWholesalePrice, showToast]);

  const deleteProduct = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setQty(prev => { const n = { ...prev }; delete n[id]; return n; });
    showToast("Item removed.", "err");
  }, [showToast]);

  const startEditProduct = useCallback((product) => {
    const norm = normalizeProduct(product);
    setEditId(product.id); setEditName(norm.name); setEditEmoji(norm.emoji);
    setEditPhoto(norm.photo || ""); setEditPhotoZoom(norm.photoZoom || norm.photo || "");
    setEditRetailPrice(String(norm.retailPrice)); setEditWholesalePrice(String(norm.wholesalePrice));
  }, []);

  const saveProductEdit = useCallback(() => {
    const retailPrice = Number.parseFloat(editRetailPrice);
    const wholesalePrice = Number.parseFloat(editWholesalePrice);
    if (!editName.trim() || Number.isNaN(retailPrice) || Number.isNaN(wholesalePrice) || retailPrice < 0 || wholesalePrice < 0) {
      showToast("Enter product name, retail price, and wholesale price.", "err"); return;
    }
    setProducts(prev => prev.map(p => p.id === editId ? { ...p, emoji: editEmoji.trim() || "🧆", photo: editPhoto, photoZoom: editPhotoZoom || editPhoto, name: editName.trim(), retailPrice: +retailPrice.toFixed(2), wholesalePrice: +wholesalePrice.toFixed(2) } : p));
    setEditId(null);
    showToast("Item updated.");
  }, [editId, editName, editEmoji, editPhoto, editPhotoZoom, editRetailPrice, editWholesalePrice, showToast]);

  const updateSetting = useCallback((key, value) => { setSettings(prev => ({ ...prev, [key]: value })); }, []);

  const downloadBackup = useCallback(async () => {
    const payload = JSON.stringify({ products, invoices, customers, hiddenCustomerKeys, invCounter, settings }, null, 2);
    const fileName = backupFileName();
    if (Capacitor.isNativePlatform()) {
      try {
        const shareFile = await Filesystem.writeFile({ path: fileName, data: payload, directory: Directory.Cache, encoding: Encoding.UTF8 });
        let savedToDocuments = false;
        try { await Filesystem.writeFile({ path: fileName, data: payload, directory: Directory.Documents, encoding: Encoding.UTF8 }); savedToDocuments = true; }
        catch (e) { console.warn("Could not write backup to Documents", e); }
        await Share.share({ title: "SREYOUN MEATBALL backup", text: `Backup file: ${fileName}`, url: shareFile.uri, dialogTitle: "Save or send backup" });
        showToast(savedToDocuments ? "Backup saved in Documents." : "Choose where to save or send backup.");
      } catch (e) { console.error(e); showToast("Could not save backup.", "err"); }
      return;
    }
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = fileName; link.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded.");
  }, [products, invoices, customers, hiddenCustomerKeys, invCounter, settings, showToast]);

  const uploadBackup = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const data = JSON.parse(re.target.result);
        if (!Array.isArray(data.products) || !Array.isArray(data.invoices)) throw new Error("Invalid backup");
        setProducts(normalizeProducts(data.products));
        setInvoices(normalizeInvoices(data.invoices));
        setCustomers(mergeCustomers(data.customers || [], customersFromInvoices(data.invoices)));
        setHiddenCustomerKeys(Array.isArray(data.hiddenCustomerKeys) ? data.hiddenCustomerKeys.filter(Boolean) : []);
        setInvCounter(Number.isFinite(data.invCounter) ? data.invCounter : 1001);
        setSettings(prev => ({ ...prev, ...(data.settings || {}) }));
        setSelectedInvId(null);
        clearOrder();
        showToast("Backup restored.");
      } catch { showToast("Invalid backup file.", "err"); }
      finally { event.target.value = ""; }
    };
    reader.readAsText(file);
  }, [clearOrder, showToast]);

  const receiptFileBase = useCallback(() => `invoice-${String(selectedInv?.number || "receipt").padStart(6, "0")}`, [selectedInv]);

  const getReceiptCanvas = useCallback(async () => {
    if (!receiptRef.current || !selectedInv) { showToast("Open an invoice first.", "err"); return null; }
    if (document.fonts?.ready) await document.fonts.ready;
    const clone = receiptRef.current.cloneNode(true);
    clone.classList.add("receipt-export-host");
    clone.setAttribute("aria-hidden", "true");
    document.body.appendChild(clone);
    await new Promise(r => requestAnimationFrame(r));
    const width = Math.ceil(Math.max(clone.scrollWidth, clone.offsetWidth, 760));
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight));
    try {
      return await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", height, ignoreElements: el => el.classList?.contains("no-print"), scrollX: 0, scrollY: 0, useCORS: true, width, windowHeight: Math.max(height, 1000), windowWidth: width });
    } finally { clone.remove(); }
  }, [selectedInv, showToast]);

  const createReceiptPdf = useCallback((canvas) => {
    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    let imageWidth = maxWidth;
    let imageHeight = (canvas.height * imageWidth) / canvas.width;
    if (imageHeight > maxHeight) { imageHeight = maxHeight; imageWidth = (canvas.width * imageHeight) / canvas.height; }
    pdf.addImage(imageData, "PNG", (pageWidth - imageWidth) / 2, margin, imageWidth, imageHeight);
    return pdf;
  }, []);

  const writeAndShareNativeFile = useCallback(async ({ base64, dialogTitle, fileName, saveToDocuments = false, text, title }) => {
    const sharedFile = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    let savedToDocuments = false;
    if (saveToDocuments) {
      try { await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents }); savedToDocuments = true; }
      catch (e) { console.warn("Could not write receipt to Documents", e); }
    }
    await Share.share({ title, text, url: sharedFile.uri, dialogTitle });
    return savedToDocuments;
  }, []);

  const saveReceiptPhoto = useCallback(async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;
      const imageData = canvas.toDataURL("image/png");
      const fileName = `${receiptFileBase()}.png`;
      if (Capacitor.isNativePlatform()) { await NativePrinter.saveImageToPictures({ base64: imageData.split(",")[1], fileName }); showToast("Receipt photo saved in Pictures."); return; }
      downloadDataUrl(imageData, fileName);
      showToast("Receipt photo downloaded.");
    } catch (e) { if (e?.name !== "AbortError") { console.error(e); showToast("Could not save receipt photo.", "err"); } }
  }, [getReceiptCanvas, receiptFileBase, showToast]);

  const saveReceiptPdf = useCallback(async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;
      const pdf = createReceiptPdf(canvas);
      const fileName = `${receiptFileBase()}.pdf`;
      if (Capacitor.isNativePlatform()) {
        const saved = await writeAndShareNativeFile({ base64: pdf.output("datauristring").split(",")[1], dialogTitle: "Save or send receipt PDF", fileName, saveToDocuments: true, text: `Invoice #${selectedInv.number} - Total ${money(selectedInv.total)}`, title: `Invoice #${selectedInv.number}` });
        showToast(saved ? "Receipt PDF saved in Documents." : "Choose where to save receipt PDF.");
        return;
      }
      pdf.save(fileName);
      showToast("Receipt PDF downloaded.");
    } catch (e) { if (e?.name !== "AbortError") { console.error(e); showToast("Could not save receipt PDF.", "err"); } }
  }, [getReceiptCanvas, createReceiptPdf, receiptFileBase, selectedInv, writeAndShareNativeFile, showToast]);

  const shareReceipt = useCallback(async () => {
    try {
      const canvas = await getReceiptCanvas();
      if (!canvas) return;
      const imageData = canvas.toDataURL("image/png");
      const fileName = `${receiptFileBase()}.png`;
      const text = `Invoice #${selectedInv.number} - Total ${money(selectedInv.total)}`;
      if (Capacitor.isNativePlatform()) { await writeAndShareNativeFile({ base64: imageData.split(",")[1], dialogTitle: "Share receipt", fileName, text, title: `Invoice #${selectedInv.number}` }); showToast("Receipt shared."); return; }
      const file = new File([dataUrlToBlob(imageData)], fileName, { type: "image/png" });
      if (navigator.canShare?.({ title: `Invoice #${selectedInv.number}`, text, files: [file] })) { await navigator.share({ title: `Invoice #${selectedInv.number}`, text, files: [file] }); showToast("Receipt shared."); return; }
      downloadDataUrl(imageData, fileName);
      showToast("Sharing is unavailable here. Photo downloaded.");
    } catch (e) { if (e?.name !== "AbortError") { console.error(e); showToast("Could not share receipt.", "err"); } }
  }, [getReceiptCanvas, receiptFileBase, selectedInv, writeAndShareNativeFile, showToast]);

  const printReceipt = useCallback(async () => {
    if (!selectedInv) { showToast("Open an invoice first.", "err"); return; }
    if (Capacitor.isNativePlatform()) {
      const title = `Invoice #${String(selectedInv.number).padStart(6, "0")}`;
      try { await NativePrinter.printSunmiReceipt({ json: JSON.stringify(buildSunmiReceiptData(selectedInv, settings)) }); showToast("Receipt sent to SUNMI printer."); return; }
      catch (e) { console.warn("Could not print on SUNMI.", e); }
      try { await NativePrinter.printHtml({ html: buildInvoiceHtml(selectedInv, settings), title }); showToast("Choose a printer on your phone."); }
      catch (e) { console.error(e); showToast("Could not print from phone.", "err"); }
      return;
    }
    window.print();
  }, [selectedInv, settings, showToast]);

  const handleCalcBtn = useCallback((value) => {
    const allowed = new Set(["C", "\u232b", "\u00f7", "\u00d7", "/", "*", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", ".", "0", "00", "(", ")", "="]);
    if (!allowed.has(value)) return;
    if (value === "C") { setCalcInput(""); return; }
    if (value === "\u232b") { setCalcInput(prev => prev.slice(0, -1)); return; }
    if (value === "=") {
      if (!calcInput) return;
      const parsed = sanitizeCalc(calcInput);
      if (!parsed.trim()) return;
      try { const result = evaluateCalcExpression(parsed); if (!Number.isFinite(result)) throw new Error(); setCalcInput(String(Math.round(result * 10000) / 10000)); }
      catch { setCalcInput(prev => sanitizeCalc(prev)); }
      return;
    }
    setCalcInput(prev => prev + value);
  }, [calcInput]);

  // --- Wifi Sync ---
  const receiveWifiSyncPayload = useCallback((rawPayload) => {
    try {
      const payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
      const incomingInvoices = Array.isArray(payload?.invoices) ? payload.invoices : [];
      const incomingProducts = Array.isArray(payload?.products) ? payload.products : [];
      const sourceDeviceName = String(payload?.sourceDevice?.name || "").trim() || "another device";
      if (!incomingInvoices.length) { showToast("WiFi sync did not include invoices.", "err"); return; }
      const receivedInvoices = incomingInvoices.map(inv => normalizeInvoice({ ...inv, id: inv.id || genId(), createdOnDeviceName: inv.createdOnDeviceName || sourceDeviceName || "another device", receivedFromDeviceName: sourceDeviceName || inv.createdOnDeviceName || "another device", receivedAt: new Date().toISOString() }));
      if (settings.syncMenuPricesOnWifi && incomingProducts.length) setProducts(normalizeProducts(incomingProducts));
      setCustomers(prev => mergeCustomers(prev, customersFromInvoices(receivedInvoices)).filter(c => !hiddenCustomerKeys.includes(customerKey(c))));
      setInvoices(prev => { const merged = mergeSyncedInvoices(prev, receivedInvoices, sourceDeviceName); setInvCounter(curr => nextInvoiceCounter(merged, curr)); return merged; });
      setSelectedInvId(receivedInvoices[0]?.id || null);
      setTab("history");
      showToast(`Received ${incomingInvoices.length} invoice${incomingInvoices.length === 1 ? "" : "s"}${settings.syncMenuPricesOnWifi && incomingProducts.length ? " and menu" : ""} by WiFi.`);
      if (settings.autoPrintReceivedInvoices && Capacitor.isNativePlatform()) {
        (async () => { for (const inv of receivedInvoices) await NativePrinter.printSunmiReceipt({ json: JSON.stringify(buildSunmiReceiptData(inv, settings)) }); })()
          .catch(e => { console.error(e); showToast("Received invoice, but auto-print failed.", "err"); });
      }
    } catch (e) { console.error(e); showToast("Could not receive WiFi sync.", "err"); }
  }, [settings, hiddenCustomerKeys, showToast, setProducts, setCustomers, setInvoices, setInvCounter, setSelectedInvId, setTab]);

  receiveWifiSyncPayloadRef.current = receiveWifiSyncPayload;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle;
    let mounted = true;
    NativePrinter.addListener("wifiSyncReceived", event => receiveWifiSyncPayloadRef.current?.(event?.json))
      .then(h => { listenerHandle = h; }).catch(e => console.warn("Could not listen for WiFi sync", e));
    NativePrinter.startWifiSyncReceiver({ port: WIFI_SYNC_PORT })
      .then(status => { if (mounted) setSyncStatus(prev => ({ ...prev, ...status })); }).catch(() => {});
    return () => { mounted = false; listenerHandle?.remove(); };
  }, []);

  const startWifiSyncReceiver = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) { showToast("WiFi receive works in the Android app.", "err"); return; }
    try { const status = await NativePrinter.startWifiSyncReceiver({ port: WIFI_SYNC_PORT }); setSyncStatus(prev => ({ ...prev, ...status })); showToast(status?.url ? "WiFi receiver started." : "Receiver started."); }
    catch (e) { console.error(e); showToast("Could not start WiFi receiver.", "err"); }
  }, [showToast]);

  const stopWifiSyncReceiver = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) { showToast("WiFi receive works in the Android app.", "err"); return; }
    try { const status = await NativePrinter.stopWifiSyncReceiver(); setSyncStatus(prev => ({ ...prev, ...status })); showToast("WiFi receiver stopped."); }
    catch (e) { console.error(e); showToast("Could not stop WiFi receiver.", "err"); }
  }, [showToast]);

  const testWifiSyncConnection = useCallback(async () => {
    const receiverUrl = normalizeSyncAddress(syncPeerAddress);
    if (!receiverUrl) { showToast("Enter the receiving device WiFi address.", "err"); return; }
    setSyncBusy(true);
    try {
      if (Capacitor.isNativePlatform()) { await NativePrinter.testWifiSync({ url: receiverUrl }); }
      else { const res = await fetch(`${receiverUrl}/ping`); if (!res.ok) throw new Error(`Receiver returned ${res.status}`); }
      showToast("WiFi receiver found.");
    } catch (e) { console.error(e); showToast("Cannot reach receiver. Check address and WiFi.", "err"); }
    finally { setSyncBusy(false); }
  }, [syncPeerAddress, showToast]);

  const sendInvoicesOverWifi = useCallback(async (invoicesToSend) => {
    if (!invoicesToSend.length) { showToast("No invoices to send.", "err"); return; }
    const receiverUrl = normalizeSyncAddress(syncPeerAddress);
    if (!receiverUrl) { showToast("Enter the receiving device WiFi address.", "err"); return; }
    setSyncBusy(true);
    try {
      const json = JSON.stringify(buildWifiSyncPayload(invoicesToSend, products, settings));
      if (Capacitor.isNativePlatform()) { await NativePrinter.sendWifiSync({ json, url: receiverUrl }); }
      else { const res = await fetch(`${receiverUrl}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: json }); if (!res.ok) throw new Error(`WiFi sync failed: ${res.status}`); }
      showToast(`Sent ${invoicesToSend.length} invoice${invoicesToSend.length === 1 ? "" : "s"} by WiFi.`);
    } catch (e) { console.error(e); showToast("Could not send by WiFi. Check both devices are on same WiFi.", "err"); }
    finally { setSyncBusy(false); }
  }, [syncPeerAddress, products, settings, showToast]);

  const sendLatestInvoiceOverWifi = useCallback(() => sendInvoicesOverWifi(invoices.slice(0, 1)), [invoices, sendInvoicesOverWifi]);
  const sendAllInvoicesOverWifi = useCallback(() => sendInvoicesOverWifi(invoices), [invoices, sendInvoicesOverWifi]);
  const sendSelectedInvoiceOverWifi = useCallback(() => {
    if (!selectedInv) { showToast("Open an invoice first.", "err"); return; }
    sendInvoicesOverWifi([selectedInv]);
  }, [selectedInv, sendInvoicesOverWifi, showToast]);

  const value = useMemo(() => ({
    tab, setTab, loading,
    products, setProducts,
    settings, setSettings, updateSetting,
    invoices, setInvoices, invoiceCount,
    customers, setCustomers,
    hiddenCustomerKeys, setHiddenCustomerKeys,
    invCounter, setInvCounter,
    syncPeerAddress, setSyncPeerAddress,
    syncStatus, setSyncStatus,
    syncBusy, setSyncBusy,
    calcInput, setCalcInput,
    fileInputRef, receiptRef,
    toast, showToast,
    ownerUnlocked, setOwnerUnlocked,
    ownerPinInput, setOwnerPinInput,
    ownerUnlockRequest, setOwnerUnlockRequest,
    requestOwnerUnlock, closeOwnerUnlock, submitOwnerUnlock, lockOwnerMode,
    selectTab,

    // order
    qty, orderPriceType, setOrderPriceType,
    customer, setCustomer: updateCustomerName,
    phone, setPhone: updateCustomerPhone,
    selectedCustomer, setSelectedCustomer,
    orderNote, setOrderNote,
    paymentStatus, amountPaid,
    editingInvoiceId, setEditingInvoiceId,
    lines, total, orderAmountPaid, orderBalanceDue, orderPaymentStatus,
    bump, handleExactQty,
    updateAmountPaid, setOrderPaidStatus,
    saveInvoice, clearOrder,
    startEditInvoice, deleteInvoice,
    updateInvoicePaymentStatus,
    selectCustomer, clearSelectedCustomer, deleteSelectedCustomer,
    openCustomerInvoice, rememberCustomer,

    // filters
    searchOrder, setSearchOrder,
    searchMenu, setSearchMenu,
    searchInvoices, setSearchInvoices,
    filteredOrderProducts,
    filteredCustomers, filteredCustomerCount,
    isSearchingCustomers,
    selectedCustomerSummary,
    filteredMenuProducts,
    filteredInvoices,
    selectedInvId, setSelectedInvId,
    selectedInv,

    // reports
    reportDate, setReportDate,
    customReportStartDate, setCustomReportStartDate,
    customReportEndDate, setCustomReportEndDate,
    reportPriceType, setReportPriceType,
    reportDayLabel,
    weeklyStartDate, weeklyEndDate,
    customReportRange,
    dailyInvoices: dailyReportInvoices,
    dailySummary: dailyReportSummary,
    weeklyInvoices: weeklyReportInvoices,
    weeklySummary: weeklyReportSummary,
    customInvoices: customReportInvoices,
    customSummary: customReportSummary,

    // today
    todaySales, todayInvoices,

    // menu
    newName, setNewName, newEmoji, setNewEmoji,
    newPhoto, setNewPhoto, newPhotoZoom, setNewPhotoZoom,
    newRetailPrice, setNewRetailPrice, newWholesalePrice, setNewWholesalePrice,
    editId, setEditId,
    editName, setEditName, editEmoji, setEditEmoji,
    editPhoto, setEditPhoto, editPhotoZoom, setEditPhotoZoom,
    editRetailPrice, setEditRetailPrice, editWholesalePrice, setEditWholesalePrice,
    addProduct, deleteProduct, startEditProduct, saveProductEdit,
    chooseNewProductPhoto, chooseEditProductPhoto,

    // receipt actions
    getReceiptCanvas, saveReceiptPhoto, saveReceiptPdf, shareReceipt, printReceipt,

    // backup
    downloadBackup, uploadBackup,

    // calc
    handleCalcBtn,

    // wifi sync
    startWifiSyncReceiver, stopWifiSyncReceiver,
    testWifiSyncConnection,
    sendLatestInvoiceOverWifi, sendAllInvoicesOverWifi,
    sendSelectedInvoiceOverWifi,
  }), [
    tab, loading, products, settings, invoices, invoiceCount, customers, hiddenCustomerKeys,
    invCounter, syncPeerAddress, syncStatus, syncBusy, calcInput, toast,
    ownerUnlocked, ownerPinInput, ownerUnlockRequest,
    qty, orderPriceType, customer, phone, selectedCustomer, orderNote,
    paymentStatus, amountPaid, editingInvoiceId,
    lines, total, orderAmountPaid, orderBalanceDue, orderPaymentStatus,
    searchOrder, searchMenu, searchInvoices,
    filteredOrderProducts, filteredCustomers, filteredCustomerCount,
    isSearchingCustomers, selectedCustomerSummary,
    filteredMenuProducts, filteredInvoices, selectedInvId, selectedInv,
    reportDate, customReportStartDate, customReportEndDate, reportPriceType,
    reportDayLabel, weeklyStartDate, weeklyEndDate, customReportRange,
    dailyReportInvoices, dailyReportSummary, weeklyReportInvoices, weeklyReportSummary,
    customReportInvoices, customReportSummary,
    todaySales, todayInvoices,
    newName, newEmoji, newPhoto, newPhotoZoom, newRetailPrice, newWholesalePrice,
    editId, editName, editEmoji, editPhoto, editPhotoZoom, editRetailPrice, editWholesalePrice,
    showToast, requestOwnerUnlock, closeOwnerUnlock, submitOwnerUnlock, lockOwnerMode,
    selectTab, bump, handleExactQty, updateAmountPaid, setOrderPaidStatus,
    saveInvoice, clearOrder, startEditInvoice, deleteInvoice,
    updateInvoicePaymentStatus, selectCustomer, clearSelectedCustomer,
    deleteSelectedCustomer, openCustomerInvoice,
    addProduct, deleteProduct, startEditProduct, saveProductEdit,
    chooseNewProductPhoto, chooseEditProductPhoto, updateSetting,
    downloadBackup, uploadBackup, getReceiptCanvas, saveReceiptPhoto,
    saveReceiptPdf, shareReceipt, printReceipt, handleCalcBtn,
    startWifiSyncReceiver, stopWifiSyncReceiver, testWifiSyncConnection,
    sendLatestInvoiceOverWifi, sendAllInvoicesOverWifi, sendSelectedInvoiceOverWifi,
    receiveWifiSyncPayload, setSelectedInvId, setEditId, setEditName, setEditEmoji,
    setEditPhoto, setEditPhotoZoom, setEditRetailPrice, setEditWholesalePrice,
    setNewName, setNewEmoji, setNewPhoto, setNewPhotoZoom,
    setNewRetailPrice, setNewWholesalePrice,
    setSearchOrder, setSearchMenu, setSearchInvoices,
    setReportDate, setCustomReportStartDate, setCustomReportEndDate,
    setReportPriceType, setSyncPeerAddress, setInvCounter,
    setHiddenCustomerKeys, setCustomers, setProducts, setInvoices,
    setOrderPriceType, setOrderNote, setTab, setOwnerUnlocked,
    setOwnerPinInput, setOwnerUnlockRequest, setSyncStatus,
    setSyncBusy, setCalcInput, setEditingInvoiceId, setSelectedCustomer,
    rememberCustomer, updateCustomerName, updateCustomerPhone,
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
