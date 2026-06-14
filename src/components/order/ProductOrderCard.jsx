import { Minus, Plus } from "lucide-react";
import { money } from "../../helpers/format";
import { getProductPrice, normalizeProduct } from "../../helpers/product";
import { ZoomableProductVisual } from "../shared/ProductMedia";
import { usePosContext } from "../../context/PosContext";

export default function ProductOrderCard({ product, priceType }) {
  const { bump, handleExactQty, qty } = usePosContext();
  const normalized = normalizeProduct(product);
  const activePrice = getProductPrice(normalized, priceType);
  const quantity = qty[normalized.id] || 0;

  return (
    <article className="product-card">
      <ZoomableProductVisual emoji={normalized.emoji} label={normalized.name} photo={normalized.photo} zoomPhoto={normalized.photoZoom} />
      <div>
        <div className="product-name">{normalized.name}</div>
        <div className="product-price">{money(activePrice)}</div>
      </div>
      <div className="qty-row">
        <button aria-label={`Decrease ${normalized.name}`} className="qty-btn decrease" onClick={() => bump(normalized.id, -1)} type="button">
          <Minus size={20} />
        </button>
        <input className="qty-input" inputMode="numeric" min="0" onChange={(e) => handleExactQty(normalized.id, e.target.value)} type="number" value={quantity || ""} placeholder="0" />
        <button aria-label={`Increase ${normalized.name}`} className="qty-btn" onClick={() => bump(normalized.id, 1)} type="button">
          <Plus size={20} />
        </button>
      </div>
    </article>
  );
}
