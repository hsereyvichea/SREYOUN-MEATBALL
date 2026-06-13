import { usePosContext } from "../../context/PosContext";

export default function Toast() {
  const { toast } = usePosContext();

  if (!toast) return null;

  return (
    <div className={`toast ${toast.type === "err" ? "error" : ""}`}>
      {toast.msg}
    </div>
  );
}
