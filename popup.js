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
  document.querySelector('#' + id)?.remove();
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  img.src = src;
  img.alt = caption;
  figure.id = id;
  const figcaption = document.createElement("figcaption");
  figcaption.textContent = caption;
  figure.appendChild(img);
  figure.appendChild(figcaption);
  return figure;
};

const renderPreview = (blob, caption, id = "processed") => {
  const objectUrl = URL.createObjectURL(blob);
  const figure = createFigure(objectUrl, caption, id);
  figure.querySelector("img").addEventListener(
    "load",
    () => URL.revokeObjectURL(objectUrl),
    { once: true }
  );
  container.querySelector('.output-images').appendChild(figure);
};


const handleDroppedFile = async (file, isRestore) => {
  try {
    if (isRestore && !lastWidthHeightRatio) {
      renderMessage("Source image goes first before we can restore it.", DROP_HINT);
      return;
    }
    const result = await window.processImage(file, isRestore ? lastWidthHeightRatio : null);
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

