/**
 * Background Service Worker
 * Handles theme-aware icon updates (Chrome only - Firefox uses theme_icons in manifest)
 * 
 * LIMITATION: Chrome does NOT expose its browser theme colors to extensions.
 * This detects OS color scheme only, not Chrome's custom themes.
 */

// Icon paths for different UI themes
// icon*.png = dark icons for light backgrounds
// icon*-dark.png = light icons for dark backgrounds
const ICONS_FOR_DARK_UI = {
  "16": "icons/icon16-dark.png",
  "32": "icons/icon32-dark.png",
  "48": "icons/icon48-dark.png",
  "128": "icons/icon128-dark.png"
};

const ICONS_FOR_LIGHT_UI = {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
};

/** Update toolbar icon based on color scheme */
function updateIcon(scheme: string): void {
  const iconPaths = scheme === "dark" ? ICONS_FOR_DARK_UI : ICONS_FOR_LIGHT_UI;
  chrome.action.setIcon({ path: iconPaths }).catch(() => { });
}

// Check if running in Chrome (has offscreen API)
const isChrome = typeof chrome.offscreen !== 'undefined';

/** Create offscreen document for theme detection (Chrome only) */
async function ensureOffscreenDocument(): Promise<boolean> {
  if (!isChrome) return false;

  try {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts?.({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
      documentUrls: [offscreenUrl]
    });

    if (existingContexts && existingContexts.length > 0) return true;

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
      justification: 'Detect prefers-color-scheme to update toolbar icon'
    });

    return true;
  } catch {
    return false;
  }
}

// Handle theme messages from offscreen document
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'COLOR_SCHEME') {
    const scheme = request.scheme || (request.dark ? 'dark' : 'light');
    updateIcon(scheme);
    sendResponse({ success: true });
  }
  return true;
});

/** Initialize theme detection */
async function initializeTheme(): Promise<void> {
  if (!isChrome) return; // Firefox uses theme_icons

  const success = await ensureOffscreenDocument();
  if (success) {
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'detect-theme' }).catch(() => {
        updateIcon('light');
      });
    }, 100);
  } else {
    updateIcon('light');
  }
}

// Initialize on startup and install
chrome.runtime.onStartup.addListener(initializeTheme);
chrome.runtime.onInstalled.addListener(() => {
  initializeTheme();

  // Set up periodic theme check (backup for when service worker was suspended)
  if (isChrome) {
    chrome.alarms.create('check-theme', { periodInMinutes: 1 });
  }
});

// Handle periodic theme check alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-theme') {
    initializeTheme();
  }
});
