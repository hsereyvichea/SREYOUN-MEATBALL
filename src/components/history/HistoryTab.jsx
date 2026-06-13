import { usePosContext } from "../../context/PosContext";
import InvoiceList from "./InvoiceList";
import InvoiceDetail from "./InvoiceDetail";

export default function HistoryTab() {
  const { selectedInv } = usePosContext();

  return selectedInv ? <InvoiceDetail /> : <InvoiceList />;
}
