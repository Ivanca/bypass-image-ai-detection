
const MENU_ID = "invert-watermark";
const PREVIEW_STORAGE_KEY = "storedPreview";
const LAST_RATIO_KEY = "lastWidthHeightRatio";

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


  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['./imageUtils.js'],
    });

    const lastWidthHeightRatio = (await chrome.storage.local.get(LAST_RATIO_KEY))?.[LAST_RATIO_KEY] ?? null;

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (srcUrl, lastRatio) => processImage(srcUrl, lastRatio),
      args: [info.srcUrl, lastWidthHeightRatio]
    });

    if (!injection?.result) {
      throw new Error("No image data returned");
    }

    if (injection.result.error) {
      throw new Error(injection.result.error);
    }

    console.log("Storing preview data", injection.result);
    await chrome.storage.local.set({
      [PREVIEW_STORAGE_KEY]: injection.result.dataUrl,
      [LAST_RATIO_KEY]: injection.result.lastWidthHeightRatio
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
