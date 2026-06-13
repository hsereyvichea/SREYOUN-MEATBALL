import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";

export default function PaymentControl() {
  const { amountPaid, orderAmountPaid, orderBalanceDue, orderPaymentStatus, updateAmountPaid, setOrderPaidStatus, total } = usePosContext();

  return (
    <div className="payment-control" role="group" aria-label="Payment status">
      <span>Payment</span>
      <div>
        {["unpaid", "paid"].map((status) => (
          <button
            key={status}
            className={`payment-btn ${orderPaymentStatus === status ? `active ${status}` : ""}`}
            onClick={() => setOrderPaidStatus(status)}
            type="button"
          >
            {status === "paid" ? "Paid" : "Unpaid"}
          </button>
        ))}
      </div>
      <label className="payment-amount-field">
        <span>ប្រាក់បានបង់</span>
        <input className="input" inputMode="decimal" onChange={(e) => updateAmountPaid(e.target.value)} placeholder="0" type="text" value={amountPaid} />
      </label>
      <div className="payment-totals">
        <div><span>Total</span><strong>{money(total)}</strong></div>
        <div><span>បានបង់</span><strong>{money(orderAmountPaid)}</strong></div>
        <div><span>ប្រាក់នៅសល់</span><strong>{money(orderBalanceDue)}</strong></div>
      </div>
    </div>
  );
}
