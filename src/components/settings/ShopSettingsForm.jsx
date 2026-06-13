import { Save } from "lucide-react";
import { usePosContext } from "../../context/PosContext";

export default function ShopSettingsForm() {
  const { settings, updateSetting, showToast } = usePosContext();

  return (
    <div className="panel">
      <h2 className="section-title">Invoice Settings</h2>
      <div className="settings-grid">
        <input className="input" onChange={(e) => updateSetting("khmerName", e.target.value)} placeholder="Shop name in Khmer" value={settings.khmerName} />
        <input className="input" onChange={(e) => updateSetting("phoneNumbers", e.target.value)} placeholder="Phone numbers" value={settings.phoneNumbers} />
        <input className="input" onChange={(e) => updateSetting("bankAccount1", e.target.value)} placeholder="ABA Bank account 1" value={settings.bankAccount1} />
        <input className="input" onChange={(e) => updateSetting("bankAccount2", e.target.value)} placeholder="ABA Bank account 2" value={settings.bankAccount2} />
        <input className="input" inputMode="numeric" onChange={(e) => updateSetting("ownerPin", e.target.value)} placeholder="Owner PIN" type="password" value={settings.ownerPin || ""} />
        <button className="primary-btn settings-save" onClick={() => showToast("Settings saved.")} type="button">
          <Save size={18} /> Save Settings
        </button>
      </div>
    </div>
  );
}
