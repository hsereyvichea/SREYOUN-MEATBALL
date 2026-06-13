export function normalizeProduct(product) {
  const fallbackPrice = Number(product.price ?? product.retailPrice ?? 0) || 0;
  const retailPrice = Number(product.retailPrice ?? fallbackPrice) || 0;
  const wholesalePrice = Number(product.wholesalePrice ?? fallbackPrice) || 0;

  return {
    ...product,
    photo: typeof product.photo === "string" ? product.photo : "",
    photoZoom:
      typeof product.photoZoom === "string"
        ? product.photoZoom
        : typeof product.photo === "string"
          ? product.photo
          : "",
    retailPrice: +retailPrice.toFixed(2),
    wholesalePrice: +wholesalePrice.toFixed(2),
  };
}

export function normalizeProducts(products) {
  return products.map(normalizeProduct);
}

export function getProductPrice(product, priceType) {
  const normalized = normalizeProduct(product);
  return priceType === "wholesale"
    ? normalized.wholesalePrice
    : normalized.retailPrice;
}
