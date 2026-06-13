import { Plus } from "lucide-react";
import { usePosContext } from "../../context/PosContext";
import { ProductPhotoPicker } from "../shared/ProductMedia";

export default function ProductForm() {
  const {
    newEmoji, setNewEmoji, newName, setNewName,
    newRetailPrice, setNewRetailPrice, newWholesalePrice, setNewWholesalePrice,
    newPhoto, newPhotoZoom, setNewPhoto, setNewPhotoZoom,
    chooseNewProductPhoto, addProduct,
  } = usePosContext();

  return (
    <div className="menu-form">
      <input className="input" onChange={(e) => setNewEmoji(e.target.value)} placeholder="Icon" value={newEmoji} />
      <ProductPhotoPicker emoji={newEmoji} onClear={() => { setNewPhoto(""); setNewPhotoZoom(""); }} onPick={chooseNewProductPhoto} photo={newPhoto} zoomPhoto={newPhotoZoom} />
      <input className="input" onChange={(e) => setNewName(e.target.value)} placeholder="Item name" value={newName} />
      <input className="input" min="0" onChange={(e) => setNewRetailPrice(e.target.value)} placeholder="Retail price" step="0.01" type="number" value={newRetailPrice} />
      <input className="input" min="0" onChange={(e) => setNewWholesalePrice(e.target.value)} placeholder="Wholesale price" step="0.01" type="number" value={newWholesalePrice} />
      <button className="primary-btn" onClick={addProduct} type="button">
        <Plus size={18} /> Add
      </button>
    </div>
  );
}
