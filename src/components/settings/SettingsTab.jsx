import ShopSettingsForm from "./ShopSettingsForm";
import WifiSyncPanel from "./WifiSyncPanel";
import BackupPanel from "./BackupPanel";

export default function SettingsTab() {
  return (
    <section className="section">
      <ShopSettingsForm />
      <WifiSyncPanel />
      <BackupPanel />
    </section>
  );
}
