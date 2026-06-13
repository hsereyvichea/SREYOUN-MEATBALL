import { money, formatDate } from "../../helpers/format";
import { normalizeInvoice } from "../../helpers/invoice";
import { PaymentStatusBadge, PriceTypeBadge } from "../shared/PaymentBadges";
import ReportMetric from "./ReportMetric";

function ReportTopItems({ items }) {
  if (!items?.length) return null;

  return (
    <div className="report-top-items">
      <div className="report-subhead"><span>Best sellers</span><strong>Qty</strong></div>
      {items.map((item, index) => (
        <div className="report-top-item" key={`${item.name}-${index}`}>
          <div><strong>{item.name}</strong><span>{money(item.total)}</span></div>
          <b>{item.quantity}</b>
        </div>
      ))}
    </div>
  );
}

export default function ReportPanel({ invoices, label, summary, title }) {
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
                  <div className="report-invoice-name">#{invoice.number} · {invoice.customer || "Walk-in"}</div>
                  <div className="invoice-meta">{invoice.date} at {invoice.time}{invoice.phone ? ` · ${invoice.phone}` : ""}</div>
                  <div className="report-badge-row">
                    <PaymentStatusBadge invoice={normalized} />
                    <PriceTypeBadge invoice={normalized} />
                  </div>
                </div>
                <div className="invoice-total-block">
                  <div className="invoice-total">{money(normalized.total)}</div>
                  <div className="invoice-balance">នៅសល់ {money(normalized.balanceDue)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">
          <div className="empty-icon">🧾</div>
          <strong>No invoices</strong>
        </div>
      )}
    </div>
  );
}
