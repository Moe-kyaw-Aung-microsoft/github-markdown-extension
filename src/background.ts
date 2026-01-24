/**
 * Background Service Worker
 * 
 * Handles:
 * - Extension lifecycle events
 * - Theme-aware icon updates (dark/light mode)
 * - Cross-origin requests
 */

// ============================================================================
// Icon Theme Management
// ============================================================================

type ThemeScheme = 'light' | 'dark';

/**
 * Update extension icon based on color scheme
 */
function updateIcon(scheme: ThemeScheme): void {
  const suffix = scheme === 'dark' ? '-dark' : '';
  const iconPaths = {
    16: `icons/icon16${suffix}.png`,
    32: `icons/icon32${suffix}.png`,
    48: `icons/icon48${suffix}.png`,
    128: `icons/icon128${suffix}.png`,
  };

  chrome.action.setIcon({ path: iconPaths }).catch(() => {
    // Fallback to light icons if dark icons don't exist
    if (scheme === 'dark') {
      updateIcon('light');
    }
  });
}

// ============================================================================
// Offscreen Document for Theme Detection (Chrome only)
// ============================================================================

// Check if Chrome (has offscreen API)
const isChrome = typeof chrome.offscreen !== 'undefined';

async function createOffscreenDocument(): Promise<boolean> {
  if (!isChrome) return false;

  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });

    if (existingContexts.length > 0) return true;

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.DISPLAY_MEDIA],
      justification: 'Detect user theme preference for icon adaptation'
    });

    return true;
  } catch (error) {
    console.warn('[Background] Could not create offscreen document:', error);
    return false;
  }
}

/**
 * Initialize theme detection using offscreen document
 */
async function initializeTheme(): Promise<void> {
  if (isChrome) {
    const success = await createOffscreenDocument();
    if (success) {
      // Give offscreen document time to load
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'detect-theme' }).catch(() => {
          updateIcon('light');
        });
      }, 100);
    } else {
      updateIcon('light');
    }
  } else {
    // Firefox or other browsers - default to light
    updateIcon('light');
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Handle theme detection from content scripts or offscreen document
  if (request.scheme || request.action === 'theme-detected') {
    updateIcon(request.scheme as ThemeScheme);
    sendResponse({ success: true });
    return true;
  }

  // Handle token management
  if (request.action === 'getToken') {
    chrome.storage.sync.get(['githubToken'], (result) => {
      sendResponse({ token: result.githubToken || null });
    });
    return true;
  }

  if (request.action === 'saveToken') {
    chrome.storage.sync.set({ githubToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'removeToken') {
    chrome.storage.sync.remove(['githubToken'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

// ============================================================================
// Lifecycle Events
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);
  }

  // Initialize theme detection
  initializeTheme();
});

chrome.runtime.onStartup.addListener(() => {
  // Initialize theme detection on browser startup
  initializeTheme();
});

// Handle extension icon click when popup is not available
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (!tab.url?.includes('github.com')) {
    console.log('[Background] Not on GitHub, ignoring click');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'triggerExport' });
    console.log('[Background] Export trigger response:', response);
  } catch (error) {
    console.warn('[Background] Could not communicate with content script:', error);
  }
});

console.log('[Background] Service worker started');
