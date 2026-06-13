import { Download, Send, Upload, Wifi } from "lucide-react";
import { usePosContext } from "../../context/PosContext";

export default function WifiSyncPanel() {
  const {
    settings, updateSetting,
    syncStatus, syncBusy, syncPeerAddress, setSyncPeerAddress,
    startWifiSyncReceiver, stopWifiSyncReceiver,
    testWifiSyncConnection, sendLatestInvoiceOverWifi, sendAllInvoicesOverWifi,
    invoices,
  } = usePosContext();

  const receiverAddress = syncStatus.url || "Not running";
  const hasInvoices = invoices.length > 0;

  return (
    <div className="panel">
      <h2 className="section-title">WiFi Sync</h2>
      <div className="sync-grid">
        <div className={`sync-card ${syncStatus.running ? "active" : ""}`}>
          <div className="sync-card-head">
            <span>This Device</span>
            <strong>{syncStatus.running ? "Receiving" : "Stopped"}</strong>
          </div>
          <input className="input" onChange={(e) => updateSetting("deviceName", e.target.value)} placeholder="Device name, example Tablet or Sunmi" value={settings.deviceName || ""} />
          <div className="sync-options">
            <label className="toggle-row">
              <input checked={Boolean(settings.autoPrintReceivedInvoices)} onChange={(e) => updateSetting("autoPrintReceivedInvoices", e.target.checked)} type="checkbox" />
              <span>Auto-print received invoices</span>
            </label>
            <label className="toggle-row">
              <input checked={Boolean(settings.syncMenuPricesOnWifi)} onChange={(e) => updateSetting("syncMenuPricesOnWifi", e.target.checked)} type="checkbox" />
              <span>Sync menu/prices when receiving</span>
            </label>
          </div>
          <div className="sync-address">{receiverAddress}</div>
          <div className="button-row">
            <button className="primary-btn" onClick={startWifiSyncReceiver} type="button"><Wifi size={18} /> Start Receive</button>
            <button className="secondary-btn" onClick={stopWifiSyncReceiver} type="button">Stop</button>
          </div>
        </div>

        <div className="sync-card">
          <div className="sync-card-head">
            <span>Send To Device</span>
            <strong>{syncBusy ? "Sending" : "Ready"}</strong>
          </div>
          <input className="input" onChange={(e) => setSyncPeerAddress(e.target.value)} placeholder="192.168.1.20:8787" value={syncPeerAddress} />
          <div className="button-row">
            <button className="secondary-btn" disabled={syncBusy} onClick={testWifiSyncConnection} type="button"><Wifi size={18} /> Test</button>
            <button className="secondary-btn" disabled={syncBusy || !hasInvoices} onClick={sendLatestInvoiceOverWifi} type="button"><Send size={18} /> Latest</button>
            <button className="primary-btn" disabled={syncBusy || !hasInvoices} onClick={sendAllInvoicesOverWifi} type="button"><Upload size={18} /> All Invoices</button>
          </div>
        </div>
      </div>
    </div>
  );
}
