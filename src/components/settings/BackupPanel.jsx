import { Download, Upload } from "lucide-react";
import { usePosContext } from "../../context/PosContext";

export default function BackupPanel() {
  const { downloadBackup, uploadBackup, fileInputRef } = usePosContext();

  return (
    <div className="panel">
      <h2 className="section-title">Backup</h2>
      <div className="button-row">
        <button className="secondary-btn" onClick={downloadBackup} type="button"><Download size={18} /> Download</button>
        <input accept=".json,application/json" onChange={uploadBackup} ref={fileInputRef} style={{ display: "none" }} type="file" />
        <button className="primary-btn" onClick={() => fileInputRef.current?.click()} type="button"><Upload size={18} /> Upload</button>
      </div>
    </div>
  );
}
