import { money } from "../helpers/format";

import { normalizeInvoice } from "../helpers/invoice";

export function Receipt({ invoice, settings }) {
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
