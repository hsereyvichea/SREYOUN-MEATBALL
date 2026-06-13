import { usePosContext } from "../../context/PosContext";

export default function OwnerModeBar() {
  const { ownerUnlocked, lockOwnerMode } = usePosContext();

  if (!ownerUnlocked) return null;

  return (
    <div className="owner-mode-bar no-print">
      <span>Owner mode unlocked</span>
      <button className="secondary-btn compact-btn" onClick={lockOwnerMode} type="button">
        Lock
      </button>
    </div>
  );
}
