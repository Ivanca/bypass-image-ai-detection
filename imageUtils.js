



async function processImage(srcInput, lastWidthHeightRatio = null, isRestore = false, amplitude = null, frequency = null) {

  if (lastWidthHeightRatio === true) {
    lastWidthHeightRatio = null;
  }
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

  const canvasToBlob = (canvas, type = "image/png", quality = 0.92) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to export image"));
        }
      }, type, quality);
    });


  try {
    const isBlobInput = srcInput instanceof Blob;
    const isStringInput = typeof srcInput === "string";
    let baseImageSource = srcInput;
    let shouldUseCors = false;
    let revokeBaseUrl = false;

    if (isBlobInput) {
      baseImageSource = URL.createObjectURL(srcInput);
      revokeBaseUrl = true;
    } else if (isStringInput && !srcInput.startsWith("data:")) {
      try {
        baseImageSource = await fetchAsObjectUrl(srcInput);
        revokeBaseUrl = true;
      } catch (fetchError) {
        console.warn("Falling back to direct image load:", fetchError);
        shouldUseCors = true;
      }
    }

    const baseImage = await loadImage(baseImageSource, shouldUseCors);



    // if (revokeBaseUrl) {
    //   URL.revokeObjectURL(baseImageSource);
    // }

    let imageSource = baseImage;


    const width = imageSource.naturalWidth || imageSource.width;
    const height = imageSource.naturalHeight || imageSource.height;

    if (isRestore && lastWidthHeightRatio && Math.round(lastWidthHeightRatio * 100) !== Math.round(width / height * 100)) {
        const targetHeight = baseImage.naturalHeight || baseImage.height;
        const targetWidth = Math.round(targetHeight * lastWidthHeightRatio);
        console.log("Restoring image to", targetWidth, "x", targetHeight);
        const resizedCanvas = document.createElement("canvas");
        resizedCanvas.width = targetWidth;
        resizedCanvas.height = targetHeight;
        const resizedCtx = resizedCanvas.getContext("2d");
        resizedCtx.clearRect(0, 0, targetWidth, targetHeight);
        resizedCtx.drawImage(baseImage, 0, 0, targetWidth, targetHeight);
        imageSource = resizedCanvas;
    } 

    lastWidthHeightRatio = !isRestore ? width / height : null;

    const invertedCanvas = document.createElement("canvas");
    invertedCanvas.width = width;
    invertedCanvas.height = height;
    const invertedCtx = invertedCanvas.getContext("2d", {
      willReadFrequently: true
    });

  invertedCtx.drawImage(imageSource, 0, 0);
    const frame = invertedCtx.getImageData(0, 0, width, height);
    const pixels = frame.data;

    const result = 
      isRestore ?
        invertHue(flipImageVertically(warpImage(frame, true, amplitude, frequency))) :
        // frame:
        warpImage(flipImageVertically(invertHue(frame)), false);

    invertedCtx.putImageData(result, 0, 0);

    const blob = await canvasToBlob(invertedCanvas);

    return { blob, lastWidthHeightRatio};
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
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

function invertHue(imageData) {
    const hueShift = 180; // Shift hue by 180 degrees for inversion
    const data = imageData.data;
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

function warpImage(imageData, isReverse = false, amplitude = null, frequency = null) {
    if (amplitude === null) {
        amplitude = Math.round(imageData.width * 0.06323396567);
        document.getElementById("amplitudeRange").value = amplitude;
        if (isReverse) {
          amplitude *= -1;
        }
        console.log("Calculated amplitude:", amplitude);
    }
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    
    // Get image data
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Create output image data
    const outputData = ctx.createImageData(width, height);
    
    // Wave parameters
    if (frequency === null) {
        frequency = 12.45 / width; // Adjust frequency based on image width
        console.log("Calculated frequency:", frequency);
        document.getElementById("frequencyRange").value = Math.round(frequency * 1000);
    }
    if (isReverse) {
      amplitude = -amplitude;
    }
    const edgeRegion = Math.max(1, height / 3); // First/last 33% of image height
    
    // Bilinear interpolation helper
    function getInterpolatedPixel(x, y) {
        // Clamp coordinates to image boundaries
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        
        const x0 = Math.floor(x);
        const x1 = Math.min(x0 + 1, width - 1);
        const y0 = Math.floor(y);
        const y1 = Math.min(y0 + 1, height - 1);
        
        const dx = x - x0;
        const dy = y - y0;
        
        const idx00 = (y0 * width + x0) * 4;
        const idx10 = (y0 * width + x1) * 4;
        const idx01 = (y1 * width + x0) * 4;
        const idx11 = (y1 * width + x1) * 4;
        
        const result = [];
        for (let i = 0; i < 4; i++) {
            const val00 = pixels[idx00 + i];
            const val10 = pixels[idx10 + i];
            const val01 = pixels[idx01 + i];
            const val11 = pixels[idx11 + i];
            
            const val0 = val00 * (1 - dx) + val10 * dx;
            const val1 = val01 * (1 - dx) + val11 * dx;
            result[i] = val0 * (1 - dy) + val1 * dy;
        }
        
        return result;
    }
    
    function getEdgeAttenuation(y) {
        const distanceToEdge = Math.min(y, (height - 1) - y);
        if (distanceToEdge <= 0) {
            return 0;
        }
        const t = Math.max(0, Math.min(1, distanceToEdge / edgeRegion));
        // Smoothstep for a gradual falloff toward the edges
        return t * t * (3 - 2 * t);
    }

    // Apply wave warp using inverse mapping (pull method)
    // This ensures no holes and stays within boundaries
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate wave offset for this destination pixel
            const waveOffset = Math.sin(x * frequency) * amplitude;
            const attenuation = getEdgeAttenuation(y);
            const adaptiveOffset = waveOffset * attenuation;
            
            // Map backward: where should we pull the pixel FROM?
            // We inverse the wave transform to find source coordinates
            const srcX = x;
            let srcY = y - adaptiveOffset;
            
            // Clamp to boundaries to ensure we never sample outside
            srcY = Math.max(0, Math.min(height - 1, srcY));
            
            // Get interpolated pixel value from source
            const pixel = getInterpolatedPixel(srcX, srcY);
            
            const destIndex = (y * width + x) * 4;
            outputData.data[destIndex] = pixel[0];     // R
            outputData.data[destIndex + 1] = pixel[1]; // G
            outputData.data[destIndex + 2] = pixel[2]; // B
            outputData.data[destIndex + 3] = pixel[3]; // A
        }
    }
    
    // Draw warped image
    ctx.putImageData(outputData, 0, 0);

    return ctx.getImageData(0, 0, width, height);
};

window.flipImageVertically = flipImageVertically;
window.invertHue = invertHue;
window.warpImage = warpImage;
window.processImage = processImage;
