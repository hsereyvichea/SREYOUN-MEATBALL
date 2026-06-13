import { Search } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import { normalizeInvoice } from "../../helpers/invoice";
import { PaymentStatusBadge, PriceTypeBadge, OriginBadge } from "../shared/PaymentBadges";

export default function InvoiceList() {
  const { filteredInvoices, invoiceCount, searchInvoices, setSearchInvoices, setSelectedInvId } = usePosContext();

  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Recent Invoices</h2>
        <label className="input-icon search-input invoice-search">
          <Search size={18} />
          <input className="input with-icon" onChange={(e) => setSearchInvoices(e.target.value)} placeholder="Search #, customer, phone, date, paid, unpaid, retail, wholesale" value={searchInvoices} />
        </label>
        {invoiceCount ? (
          <div className="history-results-meta">Showing {filteredInvoices.length} of {invoiceCount} invoices</div>
        ) : null}
        {filteredInvoices.length ? (
          <div className="invoice-list">
            {filteredInvoices.map((invoice) => (
              <button className="invoice-row" key={invoice.id} onClick={() => setSelectedInvId(invoice.id)} type="button">
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
                  <div className="invoice-balance">នៅសល់ {money(normalizeInvoice(invoice).balanceDue)}</div>
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
