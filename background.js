const MENU_ID = "invert-watermark";
let lastGenerated = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Invert and Watermark Image",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const watermarkSideAUrl = chrome.runtime.getURL("a.png");
  const watermarkSideBUrl = chrome.runtime.getURL("b.png");

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: processImage,
      args: [info.srcUrl, watermarkSideAUrl, watermarkSideBUrl]
    });

    if (!injection?.result) {
      throw new Error("No image data returned");
    }

    if (injection.result.error) {
      throw new Error(injection.result.error);
    }

    lastGenerated = injection.result;
    const previewUrl = buildPreviewPage(lastGenerated.sideA, lastGenerated.sideB);
    await chrome.tabs.create({ url: previewUrl });
  } catch (error) {
    const message = error?.message ?? String(error);
    console.error("Invert & Watermark Images error:", message);

    if (tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => window.alert(text),
        args: [
          `Invert & Watermark Images\n${message}\nCheck the console for details.`
        ]
      });
    }
  }
});

function buildPreviewPage(sideAUrl, sideBUrl) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Watermarked Preview</title><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#111;color:#fff;display:flex;flex-direction:column;min-height:100vh;}header{padding:16px;text-align:center;background:#222;border-bottom:1px solid #333;}main{flex:1;display:flex;gap:1px;background:#111;}figure{flex:1;margin:0;display:flex;flex-direction:column;}figure img{flex:1;object-fit:contain;background:#000;}figcaption{padding:12px;text-align:center;background:#222;border-top:1px solid #333;font-size:14px;}</style></head><body><header><h1>Watermarked Variants</h1></header><main><figure><img src="${sideAUrl}" alt="Watermark Side A" /><figcaption>Watermark Side A</figcaption></figure><figure><img src="${sideBUrl}" alt="Watermark Side B" /><figcaption>Watermark Side B</figcaption></figure></main></body></html>`;
  const base64 = btoa(unescape(encodeURIComponent(html)));
  return `data:text/html;base64,${base64}`;
}

async function processImage(srcUrl, watermarkAUrl, watermarkBUrl) {
  const loadImage = (url, allowCors) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      if (allowCors) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });

  const fetchAsObjectUrl = async (url) => {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Unable to fetch image data (${response.status})`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  try {
    let baseImageSource = srcUrl;
    let shouldUseCors = false;
    let revokeBaseUrl = false;

    if (!srcUrl.startsWith("data:")) {
      try {
        baseImageSource = await fetchAsObjectUrl(srcUrl);
        revokeBaseUrl = true;
      } catch (fetchError) {
        console.warn("Falling back to direct image load:", fetchError);
        shouldUseCors = true;
      }
    }

    const baseImage = await loadImage(baseImageSource, shouldUseCors);

    if (revokeBaseUrl) {
      URL.revokeObjectURL(baseImageSource);
    }

    const width = baseImage.naturalWidth || baseImage.width;
    const height = baseImage.naturalHeight || baseImage.height;

    if (!width || !height) {
      throw new Error("Image has no measurable dimensions");
    }

    const invertedCanvas = document.createElement("canvas");
    invertedCanvas.width = width;
    invertedCanvas.height = height;
    const invertedCtx = invertedCanvas.getContext("2d", {
      willReadFrequently: true
    });

    invertedCtx.drawImage(baseImage, 0, 0);
    const frame = invertedCtx.getImageData(0, 0, width, height);
    const pixels = frame.data;

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 - pixels[i];
      pixels[i + 1] = 255 - pixels[i + 1];
      pixels[i + 2] = 255 - pixels[i + 2];
    }

    invertedCtx.putImageData(frame, 0, 0);

    const [watermarkA, watermarkB] = await Promise.all([
      loadImage(watermarkAUrl, false),
      loadImage(watermarkBUrl, false)
    ]);

    const composeVariant = async (watermark) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(invertedCanvas, 0, 0);
      ctx.drawImage(watermark, 0, 0, width, height);
      try {
        return canvas.toDataURL("image/png");
      } catch (readError) {
        throw new Error(
          "Unable to export the processed image. The original host likely blocks cross-origin canvas access."
        );
      }
    };

    const [sideA, sideB] = await Promise.all([
      composeVariant(watermarkA),
      composeVariant(watermarkB)
    ]);

    return { sideA, sideB };
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
}
