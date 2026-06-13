import { X } from "lucide-react";

export function OwnerUnlockModal({
  closeOwnerUnlock,
  ownerPinInput,
  ownerUnlockRequest,
  setOwnerPinInput,
  submitOwnerUnlock,
}) {
  if (!ownerUnlockRequest) return null;

  return (
    <div className="modal-backdrop no-print" role="presentation">
      <div className="pin-modal" role="dialog" aria-modal="true">
        <div className="pin-modal-head">
          <div>
            <span>Owner Access</span>
            <h2>{ownerUnlockRequest.title}</h2>
          </div>
          <button className="icon-btn" onClick={closeOwnerUnlock} type="button">
            <X size={18} />
          </button>
        </div>
        <p>{ownerUnlockRequest.message}</p>
        <input
          autoFocus
          className="input pin-input"
          inputMode="numeric"
          onChange={(event) => setOwnerPinInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitOwnerUnlock();
          }}
          placeholder="Enter PIN"
          type="password"
          value={ownerPinInput}
        />
        <div className="button-row">
          <button className="secondary-btn" onClick={closeOwnerUnlock} type="button">
            Cancel
          </button>
          <button className="primary-btn" onClick={submitOwnerUnlock} type="button">
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
