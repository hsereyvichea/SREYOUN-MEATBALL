import { Eye, FileDown, ImageDown, Pencil, Printer, Share2, Trash2, Wifi } from "lucide-react";
import { usePosContext } from "../../context/PosContext";

export default function InvoiceActionBar({ onTogglePreview, previewOpen }) {
  const { shareReceipt, sendSelectedInvoiceOverWifi, saveReceiptPhoto, saveReceiptPdf, printReceipt, startEditInvoice, deleteInvoice, selectedInv } = usePosContext();

  return (
    <div className="invoice-action-grid no-print history-actions">
      <button className="danger-btn compact-btn" onClick={() => deleteInvoice(selectedInv.id)} type="button"><Trash2 size={18} /> Delete</button>
      <button className="secondary-btn compact-btn" onClick={() => startEditInvoice(selectedInv)} type="button"><Pencil size={18} /> Edit</button>
      <button className="secondary-btn compact-btn" onClick={onTogglePreview} type="button"><Eye size={18} /> {previewOpen ? "Hide" : "Preview"}</button>
      <button className="primary-btn compact-btn" onClick={shareReceipt} type="button"><Share2 size={18} /> Share</button>
      <button className="secondary-btn compact-btn" onClick={sendSelectedInvoiceOverWifi} type="button"><Wifi size={18} /> WiFi</button>
      <button className="secondary-btn compact-btn" onClick={saveReceiptPhoto} type="button"><ImageDown size={18} /> Photo</button>
      <button className="secondary-btn compact-btn" onClick={saveReceiptPdf} type="button"><FileDown size={18} /> PDF</button>
      <button className="primary-btn compact-btn" onClick={printReceipt} type="button"><Printer size={18} /> Print</button>
    </div>
  );
}
