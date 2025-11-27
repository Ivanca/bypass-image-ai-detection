import { startDragAndDrop } from "./startDragAndDrop.js";

const container = document.getElementById("content");

const DROP_HINT = "Drag and drop an image to process it.";

var lastWidthHeightRatio = null;

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
  container.querySelector('.messages').appendChild(message);
};

const createFigure = (src, caption, id) => {
  const figure = document.getElementById(id);
  figure.innerHTML = "";
  const img = document.createElement("img");
  img.src = src;
  img.alt = caption;
  const figcaption = document.createElement("figcaption");
  figcaption.textContent = caption;
  figure.appendChild(img);
  figure.appendChild(figcaption);
};

const renderPreview = (blob, caption, id = "processed") => {
  const objectUrl = URL.createObjectURL(blob);
  createFigure(objectUrl, caption, id);
};

var lastFile = null;
const handleDroppedFile = async (file, isRestore) => {
  try {
    lastFile = file;
    const result = await window.processImage(file, isRestore ? (lastWidthHeightRatio || true) : null, isRestore);
    if (result?.error) {
      throw new Error(result.error);
    }
    if (!isRestore && result.lastWidthHeightRatio) {
      lastWidthHeightRatio = result.lastWidthHeightRatio;
    }
    if (isRestore) {
      lastWidthHeightRatio = null;
    }
    renderPreview(result.blob, "", isRestore ? "restored" : "processed");
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

var debounceTimeout = null;
const callback = async (event) => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    const amplitude = parseInt(document.getElementById("amplitudeRange").value, 10) * -1;
    const frequency = parseFloat(document.getElementById("frequencyRange").value, 10) / 1000;
    if (lastFile) {
      const result = await window.processImage(lastFile, lastWidthHeightRatio ? lastWidthHeightRatio : null, true, amplitude, frequency);
      renderPreview(result.blob, "", lastWidthHeightRatio ? "processed" : "restored");
    }
  }, 100);
}

document.getElementById("amplitudeRange").addEventListener("input", callback);
document.getElementById("frequencyRange").addEventListener("input", callback);
