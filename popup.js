import { startDragAndDrop } from "./startDragAndDrop.js";

const container = document.getElementById("content");

const STORAGE_KEY = "storedPreview";
const LAST_RATIO_KEY = "lastWidthHeightRatio";
const DROP_HINT = "Drag and drop an image to process it.";

const renderMessage = (text, hint) => {
  // container.innerHTML = "";
  const message = document.createElement("div");
  message.className = "message";

  const primary = document.createElement("p");
  primary.textContent = text;
  message.appendChild(primary);

  if (hint) {
    const secondary = document.createElement("p");
    secondary.className = "hint";
    secondary.textContent = hint;
    message.appendChild(secondary);
  }
  container.querySelectorAll('.message').forEach(el => el.remove());
  container.appendChild(message);
};

const createFigure = (src, caption, id) => {
  document.querySelector('#' + id)?.remove();
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  img.src = src;
  img.alt = caption;
  img.id = id;
  const figcaption = document.createElement("figcaption");
  figcaption.textContent = caption;
  figure.appendChild(img);
  figure.appendChild(figcaption);
  return figure;
};

const renderPreview = (src, caption, id = "processed") => {
  container.querySelector('.output-images').appendChild(createFigure(src, caption, id));
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read dropped file"));
    reader.readAsDataURL(file);
  });


const handleDroppedFile = async (file, isRestore) => {
  try {
    if (isRestore && !lastWidthHeightRatio) {
      renderMessage("Source image goes first before we can restore it.", DROP_HINT);
      return;
    }
    renderMessage(`Processing ${file.name || "dropped image"}…`, "This can take a few seconds.");
    const dataUrl = await readFileAsDataURL(file);
    const result = await window.processImage(dataUrl, isRestore ? lastWidthHeightRatio : null);
    if (result?.error) {
      throw new Error(result.error);
    }
    if (!isRestore && result.lastWidthHeightRatio) {
      lastWidthHeightRatio = result.lastWidthHeightRatio;
      chrome.storage.local.set({
        [LAST_RATIO_KEY]: lastWidthHeightRatio
      });
    }
    if (isRestore) {
      chrome.storage.local.remove(LAST_RATIO_KEY);
      lastWidthHeightRatio = null;
    }
    renderPreview(result.dataUrl, "", isRestore ? "restored" : "processed");
  } catch (error) {
    console.error("Failed to process dropped image", error);
    renderMessage("Failed to process the dropped image.", error?.message || DROP_HINT);
  }
};

startDragAndDrop({
  dropTarget: container.querySelector('.process-image'),
  onImageDropped: (file) => handleDroppedFile(file, false),
  onError: (message) => renderMessage(message || "Unable to handle drop.", DROP_HINT)
});

startDragAndDrop({
  dropTarget: container.querySelector('.restore-image'),
  onImageDropped: (file) => handleDroppedFile(file, true),
  onError: (message) => renderMessage(message || "Unable to handle drop.", DROP_HINT)
});

var lastWidthHeightRatio = null;
(async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const preview = result?.[STORAGE_KEY];

    console.log("Loaded preview from storage", preview, STORAGE_KEY, result);

    if (!preview) {
      // renderMessage("No processed images found. Try running the extension again.");
      return;
    }


    const createFigure = (src, caption, id) => {
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = src;
      img.alt = caption;
      img.id = id;
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;
      figure.appendChild(img);
      figure.appendChild(figcaption);
      return figure;
    };

    container.querySelector('.output-images').appendChild(
      createFigure(preview, "obfuscated", 'obfuscated')
    );
    
    lastWidthHeightRatio = (await chrome.storage.local.get(LAST_RATIO_KEY))?.[LAST_RATIO_KEY] ?? null;
  } catch (error) {
    console.error("Failed to load preview", error);
    renderMessage("Failed to load the processed images. Check the extension's console for details.");
  } finally {
    chrome.storage.local.remove(STORAGE_KEY);
    chrome.storage.local.remove(LAST_RATIO_KEY);
  }
})();

