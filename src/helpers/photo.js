const PRODUCT_THUMB_SIZE = 360;
const PRODUCT_THUMB_QUALITY = 0.76;
const PRODUCT_ZOOM_SIZE = 1200;
const PRODUCT_ZOOM_QUALITY = 0.88;

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = src;
  });
}

export function drawProductImage(image, maxSize, quality) {
  const longestSide = Math.max(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );
  const scale = longestSide > maxSize ? maxSize / longestSide : 1;
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

export async function resizeProductPhoto(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  return {
    thumb: drawProductImage(image, PRODUCT_THUMB_SIZE, PRODUCT_THUMB_QUALITY),
    zoom: drawProductImage(image, PRODUCT_ZOOM_SIZE, PRODUCT_ZOOM_QUALITY),
  };
}
