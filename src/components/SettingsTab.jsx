import { Download, Save, Send, Upload, Wifi } from "lucide-react";

export function SettingsTab({
  downloadBackup,
  fileInputRef,
  invoices,
  sendAllInvoicesOverWifi,
  sendLatestInvoiceOverWifi,
  settings,
  showToast,
  startWifiSyncReceiver,
  stopWifiSyncReceiver,
  syncBusy,
  syncPeerAddress,
  syncStatus,
  setSyncPeerAddress,
  testWifiSyncConnection,
  updateSetting,
  uploadBackup,
}) {
  const receiverAddress = syncStatus.url || "Not running";
  const hasInvoices = invoices.length > 0;

  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Invoice Settings</h2>
        <div className="settings-grid">
          <input
            className="input"
            onChange={(event) => updateSetting("khmerName", event.target.value)}
            placeholder="Shop name in Khmer"
            value={settings.khmerName}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("phoneNumbers", event.target.value)}
            placeholder="Phone numbers"
            value={settings.phoneNumbers}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("bankAccount1", event.target.value)}
            placeholder="ABA Bank account 1"
            value={settings.bankAccount1}
          />
          <input
            className="input"
            onChange={(event) => updateSetting("bankAccount2", event.target.value)}
            placeholder="ABA Bank account 2"
            value={settings.bankAccount2}
          />
          <input
            className="input"
            inputMode="numeric"
            onChange={(event) => updateSetting("ownerPin", event.target.value)}
            placeholder="Owner PIN"
            type="password"
            value={settings.ownerPin || ""}
          />
          <button
            className="primary-btn settings-save"
            onClick={() => showToast("Settings saved.")}
            type="button"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title">WiFi Sync</h2>
        <div className="sync-grid">
          <div className={`sync-card ${syncStatus.running ? "active" : ""}`}>
            <div className="sync-card-head">
              <span>This Device</span>
              <strong>{syncStatus.running ? "Receiving" : "Stopped"}</strong>
            </div>
            <input
              className="input"
              onChange={(event) => updateSetting("deviceName", event.target.value)}
              placeholder="Device name, example Tablet or Sunmi"
              value={settings.deviceName || ""}
            />
            <div className="sync-options">
              <label className="toggle-row">
                <input
                  checked={Boolean(settings.autoPrintReceivedInvoices)}
                  onChange={(event) =>
                    updateSetting("autoPrintReceivedInvoices", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Auto-print received invoices</span>
              </label>
              <label className="toggle-row">
                <input
                  checked={Boolean(settings.syncMenuPricesOnWifi)}
                  onChange={(event) =>
                    updateSetting("syncMenuPricesOnWifi", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Sync menu/prices when receiving</span>
              </label>
            </div>
            <div className="sync-address">{receiverAddress}</div>
            <div className="button-row">
              <button
                className="primary-btn"
                onClick={startWifiSyncReceiver}
                type="button"
              >
                <Wifi size={18} />
                Start Receive
              </button>
              <button
                className="secondary-btn"
                onClick={stopWifiSyncReceiver}
                type="button"
              >
                Stop
              </button>
            </div>
          </div>

          <div className="sync-card">
            <div className="sync-card-head">
              <span>Send To Device</span>
              <strong>{syncBusy ? "Sending" : "Ready"}</strong>
            </div>
            <input
              className="input"
              onChange={(event) => setSyncPeerAddress(event.target.value)}
              placeholder="192.168.1.20:8787"
              value={syncPeerAddress}
            />
            <div className="button-row">
              <button
                className="secondary-btn"
                disabled={syncBusy}
                onClick={testWifiSyncConnection}
                type="button"
              >
                <Wifi size={18} />
                Test
              </button>
              <button
                className="secondary-btn"
                disabled={syncBusy || !hasInvoices}
                onClick={sendLatestInvoiceOverWifi}
                type="button"
              >
                <Send size={18} />
                Latest
              </button>
              <button
                className="primary-btn"
                disabled={syncBusy || !hasInvoices}
                onClick={sendAllInvoicesOverWifi}
                type="button"
              >
                <Upload size={18} />
                All Invoices
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title">Backup</h2>
        <div className="button-row">
          <button className="secondary-btn" onClick={downloadBackup} type="button">
            <Download size={18} />
            Download
          </button>
          <input
            accept=".json,application/json"
            onChange={uploadBackup}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
          />
          <button
            className="primary-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload size={18} />
            Upload
          </button>
        </div>
      </div>
    </section>
  );
}
