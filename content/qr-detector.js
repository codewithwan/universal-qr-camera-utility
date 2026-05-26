(function () {
  if (window.deviceSandboxQrDetector) return;

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function detectQrFromFile(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const detectorResult = await tryDecodeQr(bitmap);
      const box = detectorResult.box;
      const previewUrl = box ? await cropBitmapToDataUrl(bitmap, box) : "";

      return {
        text: detectorResult.text,
        box,
        previewUrl,
      };
    } finally {
      bitmap.close();
    }
  }

  async function tryDecodeQr(bitmap) {
    const emptyResult = { text: "", box: null };
    if (!("BarcodeDetector" in window)) return emptyResult;

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const results = await detector.detect(bitmap);
    if (!results || !results[0]) return emptyResult;

    const result = results[0];
    return {
      text: result.rawValue || "",
      box: normalizeQrBox(result, bitmap.width, bitmap.height),
    };
  }

  async function cropBitmapToDataUrl(bitmap, box) {
    const canvas = document.createElement("canvas");
    const size = 720;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  }

  function normalizeQrBox(result, imageWidth, imageHeight) {
    const points = Array.isArray(result.cornerPoints) ? result.cornerPoints : [];
    if (points.length) {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return expandBox(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
        imageWidth,
        imageHeight
      );
    }

    if (result.boundingBox) {
      return expandBox(
        result.boundingBox.x,
        result.boundingBox.y,
        result.boundingBox.width,
        result.boundingBox.height,
        imageWidth,
        imageHeight
      );
    }

    return null;
  }

  function expandBox(x, y, width, height, imageWidth, imageHeight, paddingRatio) {
    const padding = Math.max(width, height) * (paddingRatio ?? 0.22);
    const nextX = Math.max(0, x - padding);
    const nextY = Math.max(0, y - padding);
    const nextRight = Math.min(imageWidth, x + width + padding);
    const nextBottom = Math.min(imageHeight, y + height + padding);

    return {
      x: nextX,
      y: nextY,
      width: nextRight - nextX,
      height: nextBottom - nextY,
    };
  }

  // Export globally in Content Script isolated world context
  window.deviceSandboxQrDetector = {
    readFileAsDataUrl,
    detectQrFromFile
  };
})();
