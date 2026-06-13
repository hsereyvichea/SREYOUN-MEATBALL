import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";

import { money } from "../helpers/format";

import { normalizeProduct } from "../helpers/product";

import { ProductPhotoPicker, ZoomableProductVisual } from "./ProductMedia";

export function MenuTab({
  addProduct,
  chooseEditProductPhoto,
  chooseNewProductPhoto,
  deleteProduct,
  editEmoji,
  editId,
  editName,
  editPhoto,
  editPhotoZoom,
  editRetailPrice,
  editWholesalePrice,
  filteredProducts,
  newEmoji,
  newName,
  newPhoto,
  newPhotoZoom,
  newRetailPrice,
  newWholesalePrice,
  saveProductEdit,
  searchMenu,
  setEditEmoji,
  setEditId,
  setEditName,
  setEditPhoto,
  setEditPhotoZoom,
  setEditRetailPrice,
  setEditWholesalePrice,
  setNewEmoji,
  setNewName,
  setNewPhoto,
  setNewPhotoZoom,
  setNewRetailPrice,
  setNewWholesalePrice,
  setSearchMenu,
  startEditProduct,
}) {
  return (
    <section className="section">
      <div className="panel">
        <h2 className="section-title">Menu</h2>
        <div className="menu-form">
          <input
            className="input"
            onChange={(event) => setNewEmoji(event.target.value)}
            placeholder="Icon"
            value={newEmoji}
          />
          <ProductPhotoPicker
            emoji={newEmoji}
            onClear={() => {
              setNewPhoto("");
              setNewPhotoZoom("");
            }}
            onPick={chooseNewProductPhoto}
            photo={newPhoto}
            zoomPhoto={newPhotoZoom}
          />
          <input
            className="input"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Item name"
            value={newName}
          />
          <input
            className="input"
            min="0"
            onChange={(event) => setNewRetailPrice(event.target.value)}
            placeholder="Retail price"
            step="0.01"
            type="number"
            value={newRetailPrice}
          />
          <input
            className="input"
            min="0"
            onChange={(event) => setNewWholesalePrice(event.target.value)}
            placeholder="Wholesale price"
            step="0.01"
            type="number"
            value={newWholesalePrice}
          />
          <button className="primary-btn" onClick={addProduct} type="button">
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      <div className="panel">
        <label className="input-icon">
          <Search size={18} />
          <input
            className="input with-icon"
            onChange={(event) => setSearchMenu(event.target.value)}
            placeholder="Search menu"
            value={searchMenu}
          />
        </label>
        <div className="menu-grid menu-products">
          {filteredProducts.map((product) => (
            <article
              className={`product-card menu-product-card ${
                editId === product.id ? "is-editing" : ""
              }`}
              key={product.id}
            >
              {editId === product.id ? (
                <div className="menu-edit-panel">
                  <div className="menu-edit-head">
                    <div className="product-emoji">{editEmoji || "🧆"}</div>
                    <input
                      className="input"
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Item name"
                      value={editName}
                    />
                  </div>
                  <div className="menu-edit-fields">
                    <input
                      className="input"
                      onChange={(event) => setEditEmoji(event.target.value)}
                      placeholder="Icon"
                      value={editEmoji}
                    />
                    <input
                      className="input"
                      min="0"
                      onChange={(event) => setEditRetailPrice(event.target.value)}
                      placeholder="Retail"
                      step="0.01"
                      type="number"
                      value={editRetailPrice}
                    />
                    <input
                      className="input"
                      min="0"
                      onChange={(event) => setEditWholesalePrice(event.target.value)}
                      placeholder="Wholesale"
                      step="0.01"
                      type="number"
                      value={editWholesalePrice}
                    />
                  </div>
                  <ProductPhotoPicker
                    emoji={editEmoji}
                    onClear={() => {
                      setEditPhoto("");
                      setEditPhotoZoom("");
                    }}
                    onPick={chooseEditProductPhoto}
                    photo={editPhoto}
                    zoomPhoto={editPhotoZoom}
                  />
                  <div className="product-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => setEditId(null)}
                      type="button"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                    <button className="primary-btn" onClick={saveProductEdit} type="button">
                      <Save size={18} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <MenuProductView
                  deleteProduct={deleteProduct}
                  product={product}
                  startEditProduct={startEditProduct}
                />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuProductView({ deleteProduct, product, startEditProduct }) {
  const normalized = normalizeProduct(product);

  return (
    <>
      <div className="menu-product-head">
        <ZoomableProductVisual
          emoji={normalized.emoji}
          label={normalized.name}
          photo={normalized.photo}
          zoomPhoto={normalized.photoZoom}
        />
        <div className="product-name">{normalized.name}</div>
      </div>
      <div className="price-pair">
        <div>
          <span>Retail</span>
          <strong>{money(normalized.retailPrice)}</strong>
        </div>
        <div>
          <span>Wholesale</span>
          <strong>{money(normalized.wholesalePrice)}</strong>
        </div>
      </div>
                  <div className="product-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => startEditProduct(normalized)}
                      type="button"
                    >
                      <Pencil size={18} />
                      Edit
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => deleteProduct(normalized.id)}
                      type="button"
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  </div>
    </>
  );
}
