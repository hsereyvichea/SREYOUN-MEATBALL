import { useMemo, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { addDays, formatDate, money, toDateInputValue } from "../../helpers/format";
import { usePosContext } from "../../context/PosContext";

const priceFilters = [
  { id: "all", label: "All" },
  { id: "retail", label: "Retail" },
  { id: "wholesale", label: "Wholesale" },
];

function ReportKpi({ accent = false, children, label, value }) {
  return (
    <article className="report-kpi-card">
      <span>{label}</span>
      {children || <strong className={accent ? "accent" : ""}>{value}</strong>}
    </article>
  );
}

function bestSellerKey(item, index) {
  return `${item.name || "item"}-${item.priceTypeLabel || "type"}-${index}`;
}

export default function ReportsTab() {
  const {
    reportDate, setReportDate,
    customReportStartDate, setCustomReportStartDate,
    customReportEndDate, setCustomReportEndDate,
    reportPriceType, setReportPriceType,
    reportDayLabel,
    dailyInvoices, dailySummary,
    weeklyStartDate, weeklyEndDate, weeklyInvoices, weeklySummary,
    customReportRange: customRange, customInvoices, customSummary,
  } = usePosContext();
  const [reportRange, setReportRange] = useState("today");
  const [showAllBestSellers, setShowAllBestSellers] = useState(false);

  const activeReport = useMemo(() => {
    if (reportRange === "week") {
      return {
        invoices: weeklyInvoices,
        label: `${formatDate(weeklyStartDate)} - ${formatDate(weeklyEndDate)}`,
        summary: weeklySummary,
      };
    }

    if (reportRange === "custom") {
      return {
        invoices: customInvoices,
        label: `${formatDate(customRange.start)} - ${formatDate(customRange.end)}`,
        summary: customSummary,
      };
    }

    return {
      invoices: dailyInvoices,
      label: reportDayLabel,
      summary: dailySummary,
    };
  }, [
    customInvoices, customRange.end, customRange.start, customSummary,
    dailyInvoices, dailySummary, reportDayLabel, reportRange,
    weeklyEndDate, weeklyInvoices, weeklyStartDate, weeklySummary,
  ]);

  const selectRange = (nextRange) => {
    setReportRange(nextRange);
    setShowAllBestSellers(false);

    if (nextRange === "today" || nextRange === "week") {
      setReportDate(toDateInputValue(new Date()));
    }

    if (nextRange === "yesterday") {
      setReportDate(toDateInputValue(addDays(new Date(), -1)));
    }
  };

  const topItems = activeReport.summary.topItems || [];
  const visibleTopItems = showAllBestSellers ? topItems : topItems.slice(0, 3);

  return (
    <section className="section reports-dashboard">
      <div className="reports-header">
        <div>
          <h2 className="section-title">Reports</h2>
          <p>{activeReport.label} · {activeReport.invoices.length} invoice{activeReport.invoices.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="report-type-row reports-price-tabs" role="group" aria-label="Report price type">
        {priceFilters.map((filter) => (
          <button
            key={filter.id}
            className={`segmented-btn ${reportPriceType === filter.id ? "active" : ""}`}
            onClick={() => setReportPriceType(filter.id)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="report-range-chips" role="group" aria-label="Report range">
        <button className={`report-range-chip ${reportRange === "today" ? "active" : ""}`} onClick={() => selectRange("today")} type="button">
          Today
        </button>
        <button className={`report-range-chip ${reportRange === "yesterday" ? "active" : ""}`} onClick={() => selectRange("yesterday")} type="button">
          Yesterday
        </button>
        <button className={`report-range-chip ${reportRange === "week" ? "active" : ""}`} onClick={() => selectRange("week")} type="button">
          This Week
        </button>
        <button className={`report-range-chip with-icon ${reportRange === "custom" ? "active" : ""}`} onClick={() => selectRange("custom")} type="button">
          <CalendarDays size={18} /> Custom
        </button>
      </div>

      {reportRange === "custom" && (
        <div className="report-custom-range">
          <label>
            <span>From</span>
            <input className="input" type="date" value={customReportStartDate} onChange={(e) => setCustomReportStartDate(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input className="input" type="date" value={customReportEndDate} onChange={(e) => setCustomReportEndDate(e.target.value)} />
          </label>
        </div>
      )}

      <div className="report-kpi-grid">
        <ReportKpi accent label="Total Sales" value={money(activeReport.summary.total)} />
        <ReportKpi label="Items Sold" value={activeReport.summary.itemQuantity} />
        <ReportKpi label="Avg Sale" value={money(activeReport.summary.averageInvoice)} />
        <ReportKpi label="Status">
          <div className="report-status-lines">
            <strong className="paid">{activeReport.summary.paidInvoices} Paid</strong>
            <strong className="unpaid">{activeReport.summary.unpaidInvoices} Unpaid</strong>
          </div>
        </ReportKpi>
      </div>

      <section className="report-best-card">
        <div className="report-best-head">
          <h3>Best Sellers</h3>
          <Trophy size={26} />
        </div>

        {visibleTopItems.length ? (
          <div className="report-best-list">
            {visibleTopItems.map((item, index) => (
              <div className="report-best-item" key={bestSellerKey(item, index)}>
                <div className={`report-rank ${index === 0 ? "first" : ""}`}>{index + 1}</div>
                <div className="report-best-name">
                  <strong>{item.name}</strong>
                  <span>{reportPriceType === "all" ? item.priceTypeLabel : priceFilters.find(filter => filter.id === reportPriceType)?.label}</span>
                </div>
                <div className="report-best-total">
                  <strong>{item.quantity} Qty</strong>
                  <span>{money(item.total)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact report-empty">
            <div className="empty-icon">{"\ud83c\udfc6"}</div>
            <strong>No best sellers yet</strong>
            <span>Save invoices to see product ranking.</span>
          </div>
        )}

        {topItems.length > 3 && (
          <button className="report-view-list" onClick={() => setShowAllBestSellers(prev => !prev)} type="button">
            {showAllBestSellers ? "Show Top 3" : "View Full List"}
          </button>
        )}
      </section>
    </section>
  );
}
