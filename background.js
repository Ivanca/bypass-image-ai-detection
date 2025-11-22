const MENU_ID = "invert-watermark";
const PREVIEW_STORAGE_KEY = "watermarkPreview";

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

    await chrome.storage.local.set({
      [PREVIEW_STORAGE_KEY]: injection.result
    });

    await chrome.tabs.create({
      url: chrome.runtime.getURL("popup.html")
    });
  } catch (error) {
    const message = error?.message ?? String(error);
    console.error("Invert & Watermark Images error:", message);

    await chrome.storage.local.remove(PREVIEW_STORAGE_KEY);

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

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, l];
  }
    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h / 360 + 1 / 3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, h / 360 - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    function flipImageVertically(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        for (let y = 0; y < height / 2; y++) {
            for (let x = 0; x < width; x++) {
                const topIndex = (y * width + x) * 4;
                const bottomIndex = ((height - y - 1) * width + x) * 4;
                for (let i = 0; i < 4; i++) {
                    const temp = data[topIndex + i];
                    data[topIndex + i] = data[bottomIndex + i];
                    data[bottomIndex + i] = temp;
                }
            }
        }
        return imageData;
    }

  
    function changeHue(imageData, hueShift) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 1. Convert RGB to HSL
            let hsl = rgbToHsl(r, g, b); // You'll need to implement this function

            // 2. Adjust the hue
            hsl[0] = (hsl[0] + hueShift) % 360; // Assuming hueShift is in degrees

            // 3. Convert HSL back to RGB
            let newRgb = hslToRgb(hsl[0], hsl[1], hsl[2]); // You'll need to implement this function

            // 4. Update pixel data
            data[i] = newRgb[0];
            data[i + 1] = newRgb[1];
            data[i + 2] = newRgb[2];
        }
        return imageData;
    }

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

    const hueShift = 180; // Shift hue by 180 degrees for inversion
    const result = flipImageVertically(changeHue(frame, hueShift));

    invertedCtx.putImageData(result, 0, 0);

    const [watermarkA, watermarkB] = await Promise.all([
      loadImage(watermarkAUrl, false),
      loadImage(watermarkBUrl, false)
    ]);

    const composeVariant = async (
      watermark,
      { maskOutsideGreen } = { maskOutsideGreen: false }
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (maskOutsideGreen) {
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.drawImage(invertedCanvas, 0, 0);
      }
      const naturalWidth = watermark.naturalWidth || watermark.width;
      const naturalHeight = watermark.naturalHeight || watermark.height;

      if (!naturalWidth || !naturalHeight) {
        throw new Error("Watermark image has no measurable dimensions");
      }

      const overlayWidth = width * 0.75;
      const overlayHeight = overlayWidth * (naturalHeight / naturalWidth);
      const offsetX = (width - overlayWidth) / 2;
      const offsetY = (height - overlayHeight) / 2;

      if (maskOutsideGreen) {
        ctx.save();
        ctx.beginPath();
        const clipLeft = Math.max(0, offsetX + 1);
        const clipTop = Math.max(0, offsetY + 1);
        const clipRight = Math.min(width, offsetX + overlayWidth - 1);
        const clipBottom = Math.min(height, offsetY + overlayHeight - 1);
        ctx.rect(
          clipLeft,
          clipTop,
          Math.max(0, clipRight - clipLeft),
          Math.max(0, clipBottom - clipTop)
        );
        ctx.clip();
        ctx.drawImage(invertedCanvas, 0, 0);
        ctx.restore();
      }

      ctx.drawImage(watermark, offsetX, offsetY, overlayWidth, overlayHeight);
      try {
        return canvas.toDataURL("image/png");
      } catch (readError) {
        throw new Error(
          "Unable to export the processed image. The original host likely blocks cross-origin canvas access."
        );
      }
    };

    const [sideA, sideB] = await Promise.all([
      composeVariant(watermarkA, { maskOutsideGreen: false }),
      composeVariant(watermarkB, { maskOutsideGreen: true })
    ]);

    return { sideA, sideB };
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
}

