import { usePosContext } from "../../context/PosContext";
import { formatDate, toDateInputValue } from "../../helpers/format";
import ReportPanel from "./ReportPanel";

export default function ReportsTab() {
  const {
    reportDate, setReportDate,
    customReportStartDate, setCustomReportStartDate,
    customReportEndDate, setCustomReportEndDate,
    reportPriceType, setReportPriceType,
    reportDayLabel,
    dailyInvoices, dailySummary,
    weeklyStartDate, weeklyEndDate, weeklyInvoices, weeklySummary,
    customRange, customInvoices, customSummary,
  } = usePosContext();

  return (
    <section className="section">
      <div className="panel report-controls">
        <div>
          <h2 className="section-title">Reports</h2>
          <p>Daily and weekly sales from saved invoices.</p>
        </div>
        <div className="report-control-panel">
          <div className="report-type-row" role="group" aria-label="Report price type">
            {["all", "retail", "wholesale"].map((mode) => (
              <button key={mode} className={`segmented-btn ${reportPriceType === mode ? "active" : ""}`}
                onClick={() => setReportPriceType(mode)} type="button"
              >
                {mode === "all" ? "All" : mode === "retail" ? "Retail" : "Wholesale"}
              </button>
            ))}
          </div>
          <div className="report-date-actions">
            <label className="report-date-field">
              <span>Day / Week</span>
              <input className="input" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </label>
            <button className="secondary-btn" onClick={() => setReportDate(toDateInputValue(new Date()))} type="button">Today</button>
          </div>
          <div className="report-range-actions">
            <label><span>From</span><input className="input" type="date" value={customReportStartDate} onChange={(e) => setCustomReportStartDate(e.target.value)} /></label>
            <label><span>To</span><input className="input" type="date" value={customReportEndDate} onChange={(e) => setCustomReportEndDate(e.target.value)} /></label>
          </div>
        </div>
      </div>

      <div className="report-grid">
        <ReportPanel invoices={dailyInvoices} label={reportDayLabel} summary={dailySummary} title="Daily" />
        <ReportPanel invoices={weeklyInvoices} label={`${formatDate(weeklyStartDate)} - ${formatDate(weeklyEndDate)}`} summary={weeklySummary} title="Weekly" />
        <ReportPanel invoices={customInvoices} label={`${formatDate(customRange.start)} - ${formatDate(customRange.end)}`} summary={customSummary} title="Custom" />
      </div>
    </section>
  );
}
