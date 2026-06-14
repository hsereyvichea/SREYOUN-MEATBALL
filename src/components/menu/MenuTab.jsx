import { Pencil, Save, Search, Trash2, X } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { money } from "../../helpers/format";
import { normalizeProduct } from "../../helpers/product";
import { ZoomableProductVisual, ProductPhotoPicker } from "../shared/ProductMedia";
import ProductForm from "./ProductForm";

export default function MenuTab() {
  const {
    filteredMenuProducts, searchMenu, setSearchMenu,
    editId, setEditId,
    editName, setEditName, editEmoji, setEditEmoji,
    editRetailPrice, setEditRetailPrice, editWholesalePrice, setEditWholesalePrice,
    editPhoto, editPhotoZoom, setEditPhoto, setEditPhotoZoom,
    chooseEditProductPhoto, saveProductEdit,
    startEditProduct, deleteProduct,
  } = usePosContext();

  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Menu</h2>
        <ProductForm />
      </div>

      <div className="panel">
        <label className="input-icon">
          <Search size={18} />
          <input className="input with-icon" onChange={(e) => setSearchMenu(e.target.value)} placeholder="Search menu" value={searchMenu} />
        </label>
        <div className="menu-grid menu-products">
          {filteredMenuProducts.map((product) => (
            <article className={`product-card menu-product-card ${editId === product.id ? "is-editing" : ""}`} key={product.id}>
              {editId === product.id ? (
                <div className="menu-edit-panel">
                  <div className="menu-edit-head">
                    <div className="product-emoji">{editEmoji || "\ud83e\uddc6"}</div>
                    <input className="input" onChange={(e) => setEditName(e.target.value)} placeholder="Item name" value={editName} />
                  </div>
                  <div className="menu-edit-fields">
                    <input className="input" onChange={(e) => setEditEmoji(e.target.value)} placeholder="Icon" value={editEmoji} />
                    <input className="input" min="0" onChange={(e) => setEditRetailPrice(e.target.value)} placeholder="Retail" step="0.01" type="number" value={editRetailPrice} />
                    <input className="input" min="0" onChange={(e) => setEditWholesalePrice(e.target.value)} placeholder="Wholesale" step="0.01" type="number" value={editWholesalePrice} />
                  </div>
                  <ProductPhotoPicker emoji={editEmoji} onClear={() => { setEditPhoto(""); setEditPhotoZoom(""); }} onPick={chooseEditProductPhoto} photo={editPhoto} zoomPhoto={editPhotoZoom} />
                  <div className="product-actions">
                    <button className="secondary-btn" onClick={() => setEditId(null)} type="button"><X size={18} /> Cancel</button>
                    <button className="primary-btn" onClick={saveProductEdit} type="button"><Save size={18} /> Save</button>
                  </div>
                </div>
              ) : (
                <MenuProductView product={product} startEditProduct={startEditProduct} deleteProduct={deleteProduct} />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuProductView({ product, startEditProduct, deleteProduct }) {
  const normalized = normalizeProduct(product);

  return (
    <>
      <div className="menu-product-head">
        <ZoomableProductVisual emoji={normalized.emoji} label={normalized.name} photo={normalized.photo} zoomPhoto={normalized.photoZoom} />
        <div className="product-name">{normalized.name}</div>
      </div>
      <div className="price-pair">
        <div><span>Retail</span><strong>{money(normalized.retailPrice)}</strong></div>
        <div><span>Wholesale</span><strong>{money(normalized.wholesalePrice)}</strong></div>
      </div>
      <div className="product-actions">
        <button className="secondary-btn" onClick={() => startEditProduct(normalized)} type="button"><Pencil size={18} /> Edit</button>
        <button className="danger-btn" onClick={() => deleteProduct(normalized.id)} type="button"><Trash2 size={18} /> Delete</button>
      </div>
    </>
  );
}
