import { Trash2, User, X } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import { normalizeInvoice } from "../../helpers/invoice";

export default function CustomerPicker() {
  const {
    clearSelectedCustomer,
    deleteSelectedCustomer,
    filteredCustomers,
    filteredCustomerCount,
    isSearchingCustomers,
    openCustomerInvoice,
    selectCustomer,
    selectedCustomerSummary,
  } = usePosContext();

  if (!filteredCustomers.length) return null;

  const countLabel =
    filteredCustomerCount > filteredCustomers.length
      ? `${filteredCustomers.length}/${filteredCustomerCount}`
      : String(filteredCustomers.length);

  return (
    <div className="customer-picker">
      <div className="customer-picker-head">
        <span>{isSearchingCustomers ? "Matching customers" : "Recent customers"}</span>
        <strong>{countLabel}</strong>
      </div>
      <div className="customer-chip-row">
        {filteredCustomers.map((savedCustomer) => (
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
