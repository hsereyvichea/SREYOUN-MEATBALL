import { formatDate, money, toDateInputValue } from "../helpers/format";

import { normalizeInvoice } from "../helpers/invoice";

import { PaymentStatusBadge, PriceTypeBadge } from "./Payment";

export function ReportsTab({
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
          <div className="empty-icon">{"\ud83e\uddfe"}</div>
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
