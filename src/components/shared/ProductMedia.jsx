import { useEffect, useState } from "react";
import { ImageDown, X } from "lucide-react";

const DEFAULT_PRODUCT_EMOJI = "\ud83e\uddc6";

export function ProductVisual({ emoji, photo }) {
  return (
    <div className={`product-emoji ${photo ? "has-photo" : ""}`} aria-hidden="true">
      {photo ? <img alt="" src={photo} /> : emoji || DEFAULT_PRODUCT_EMOJI}
    </div>
  );
}

export function ZoomableProductVisual({
  emoji,
  label = "Product photo",
  photo,
  zoomPhoto,
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const largePhoto = zoomPhoto || photo;

  return (
    <>
      <button
        aria-label={`View ${label}`}
        className={`product-emoji ${photo ? "has-photo" : ""} product-photo-thumb`}
        onClick={() => setZoomOpen(true)}
        type="button"
      >
        {photo ? <img alt="" src={photo} /> : emoji || DEFAULT_PRODUCT_EMOJI}
      </button>
      {zoomOpen ? (
        <ProductPhotoZoom
          emoji={emoji}
          label={label}
          onClose={() => setZoomOpen(false)}
          photo={largePhoto}
        />
      ) : null}
    </>
  );
}

function ProductPhotoZoom({ emoji, label, onClose, photo }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-label={label}
      aria-modal="true"
      className="product-photo-zoom"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="product-photo-zoom-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close photo"
          className="icon-btn product-photo-close"
          onClick={onClose}
          type="button"
        >
          <X size={22} />
        </button>
        {photo ? (
          <img alt={label} src={photo} />
        ) : (
          <div className="product-photo-zoom-emoji" aria-hidden="true">
            {emoji || DEFAULT_PRODUCT_EMOJI}
          </div>
        )}
        <strong>{label}</strong>
      </div>
    </div>
  );
}

export function ProductPhotoPicker({ emoji, onClear, onPick, photo, zoomPhoto }) {
  return (
    <div className="product-photo-picker">
      <ZoomableProductVisual
        emoji={emoji}
        label="Product photo preview"
        photo={photo}
        zoomPhoto={zoomPhoto}
      />
      <label className="secondary-btn photo-upload-btn">
        <ImageDown size={18} />
        Photo
        <input
          accept="image/*"
          className="file-input"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {photo ? (
        <button className="ghost-btn compact-btn" onClick={onClear} type="button">
          <X size={16} />
          Remove
        </button>
      ) : null}
    </div>
  );
}
