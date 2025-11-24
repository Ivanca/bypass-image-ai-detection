
const MENU_ID = "invert-watermark";
const PREVIEW_STORAGE_KEY = "storedPreview";
const LAST_RATIO_KEY = "lastWidthHeightRatio";

chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});