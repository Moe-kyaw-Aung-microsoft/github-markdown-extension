// Background script to handle theme changes
function updateIcon(scheme) {
  const iconPaths = {
    "16": scheme === "dark" ? "icons/icon16-dark.png" : "icons/icon16.png",
    "32": scheme === "dark" ? "icons/icon32-dark.png" : "icons/icon32.png",
    "48": scheme === "dark" ? "icons/icon48-dark.png" : "icons/icon48.png",
    "128": scheme === "dark" ? "icons/icon128-dark.png" : "icons/icon128.png"
  };

  chrome.action.setIcon({path: iconPaths});
}

// Detect browser and create offscreen document for Chrome
const isChrome = typeof chrome.offscreen !== 'undefined';

async function createOffscreenDocument() {
  if (!isChrome) return false;

  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });

    if (existingContexts.length > 0) return true;

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Detect user theme preference for icon adaptation'
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

// Handle theme messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.scheme || request.action === 'theme-detected') {
    updateIcon(request.scheme);
    sendResponse({success: true});
  }
  return true;
});

// Initialize theme detection
async function initializeTheme() {
  if (isChrome) {
    const success = await createOffscreenDocument();
    if (success) {
      setTimeout(() => {
        chrome.runtime.sendMessage({action: 'detect-theme'}).catch(() => {
          updateIcon('light');
        });
      }, 100);
    } else {
      updateIcon('light');
    }
  } else {
    updateIcon('light');
  }
}

// Set initial theme on startup and install
chrome.runtime.onStartup.addListener(initializeTheme);
chrome.runtime.onInstalled.addListener(initializeTheme);