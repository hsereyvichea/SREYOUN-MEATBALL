import { normalizeInvoice } from "../helpers/invoice";
import { escapeHtml, money } from "../helpers/format";

export default function buildInvoiceHtml(invoice, settings) {
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
      body { margin: 0; background: #ffffff; color: #0a308f; font-family: Arial, "Noto Sans Khmer", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-print-area { width: 100%; max-width: 760px; margin: 0 auto; background: #ffffff; padding: 30px 40px; color: #0a308f; }
      .invoice-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 15px; }
      .khmer-name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
      .shop-name { margin: 0 0 5px 0; color: #0a308f; font-size: 24px; line-height: 1.1; text-transform: uppercase; }
      .shop-phone { font-size: 13px; }
      .invoice-number { color: #d81b1b; font-size: 24px; font-weight: bold; letter-spacing: 1px; text-align: right; white-space: nowrap; }
      .invoice-number span { text-decoration: underline; }
      .invoice-date { margin-top: 5px; font-size: 12px; text-align: right; }
      .invoice-info-row { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 15px; font-size: 14px; }
      .customer-info { flex: 1; }
      .customer-info div + div { margin-top: 6px; }
      .bank-box { min-width: 200px; border: 1.5px solid #0a308f; border-radius: 4px; padding: 6px 12px; font-size: 12px; text-align: left; }
      .bank-title { border-bottom: 1px solid #0a308f; padding-bottom: 4px; margin-bottom: 4px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; border: 2px solid #0a308f; margin-top: 10px; }
      th, td { border: 1.5px solid #0a308f; padding: 8px; font-size: 13px; vertical-align: top; }
      th { background: #f8f9fc; text-align: center; font-weight: bold; }
      .num-cell { text-align: center; font-weight: bold; }
      .money-cell { text-align: right; }
      .strong-cell { font-weight: bold; }
      .total-label { text-align: right; font-size: 16px; font-weight: bold; padding: 12px 8px; }
      .total-value { color: #d81b1b; text-align: right; font-size: 18px; font-weight: bold; padding: 12px 8px; }
      .invoice-note { margin-top: 15px; padding: 10px; border: 1px dashed #0a308f; font-size: 13px; }
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
