import { usePosContext } from "../../context/PosContext";

export default function CalculatorTab() {
  const { calcInput, handleCalcBtn } = usePosContext();
  const buttons = [
    { label: "C", type: "action" },
    { label: "\u232b", type: "action" },
    { label: "\u00f7", val: "/", type: "op" },
    { label: "\u00d7", val: "*", type: "op" },
    { label: "7" },
    { label: "8" },
    { label: "9" },
    { label: "-", type: "op" },
    { label: "4" },
    { label: "5" },
    { label: "6" },
    { label: "+", type: "op" },
    { label: "1" },
    { label: "2" },
    { label: "3" },
    { label: "=", type: "equal", rowSpan: 2 },
    { label: "0" },
    { label: "00" },
    { label: "." },
  ];

  return (
    <section className="section calc-section">
      <div className="panel calc-shell">
        <div className="calc-display">
          <div>{calcInput || "0"}</div>
        </div>
        <div className="calc-grid">
          {buttons.map((button, index) => (
            <button
              className={`calc-btn ${
                button.type === "op" ? "operator" : ""
              } ${button.type === "action" ? "action" : ""} ${
                button.type === "equal" ? "equals" : ""
              }`}
              key={`${button.label}-${index}`}
              onClick={() => handleCalcBtn(button.val || button.label)}
              style={{
                gridRow: button.rowSpan ? `span ${button.rowSpan}` : "auto",
              }}
              type="button"
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
