const STORAGE_KEY = "watermarkPreview";
const container = document.getElementById("content");

const renderMessage = (text) => {
  container.innerHTML = "";
  const message = document.createElement("div");
  message.className = "message";
  message.textContent = text;
  container.appendChild(message);
};

(async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const preview = result?.[STORAGE_KEY];

    if (!preview || !preview.sideA || !preview.sideB) {
      renderMessage("No processed images found. Try running the extension again.");
      return;
    }

    container.innerHTML = "";

    const createFigure = (src, caption) => {
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = src;
      img.alt = caption;
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;
      figure.appendChild(img);
      figure.appendChild(figcaption);
      return figure;
    };

    container.appendChild(createFigure(preview.sideA, "Watermark Side A"));
    container.appendChild(createFigure(preview.sideB, "Watermark Side B"));
  } catch (error) {
    console.error("Failed to load preview", error);
    renderMessage("Failed to load the processed images. Check the extension's console for details.");
  } finally {
    chrome.storage.local.remove(STORAGE_KEY);
  }
})();
