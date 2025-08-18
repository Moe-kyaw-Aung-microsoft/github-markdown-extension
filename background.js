// Background script to handle theme changes
console.log('Background script loaded');

// Function to update icon based on theme
function updateIcon(scheme) {
  console.log('Setting icon for scheme:', scheme);
  
  const iconPaths = {
    "16": scheme === "dark" ? "icons/icon16-dark.png" : "icons/icon16.png",
    "32": scheme === "dark" ? "icons/icon32-dark.png" : "icons/icon32.png",
    "48": scheme === "dark" ? "icons/icon48-dark.png" : "icons/icon48.png",
    "128": scheme === "dark" ? "icons/icon128-dark.png" : "icons/icon128.png"
  };

  chrome.action.setIcon({
    path: iconPaths
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Icon set error:', chrome.runtime.lastError);
    } else {
      console.log('Icon updated successfully to:', scheme);
    }
  });
}

// Detect if we're running in Chrome (has offscreen API) or Firefox
const isChrome = typeof chrome.offscreen !== 'undefined';
const isFirefox = !isChrome;

console.log('Browser detected:', isChrome ? 'Chrome' : 'Firefox');

// Function to create offscreen document for theme detection (Chrome only)
async function createOffscreenDocument() {
  if (!isChrome) {
    console.log('Skipping offscreen document creation - not Chrome');
    return false;
  }

  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return true;
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Detect user theme preference for icon adaptation'
    });
    
    console.log('Offscreen document created');
    return true;
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    return false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.scheme || request.action === 'theme-detected') {
    const scheme = request.scheme;
    updateIcon(scheme);
    sendResponse({success: true});
  }
  
  return true; // Keep message channel open for async response
});

// Function to initialize theme detection
async function initializeThemeDetection() {
  console.log('Initializing theme detection');
  
  if (isChrome) {
    // Chrome: Try offscreen document, fallback to simpler approach
    try {
      const success = await createOffscreenDocument();
      
      if (success) {
        // Give the offscreen document a moment to load and send the initial theme
        setTimeout(() => {
          // Request theme detection from offscreen document
          chrome.runtime.sendMessage({action: 'detect-theme'}).catch(() => {
            console.log('Offscreen messaging failed, trying tab approach');
            tryTabBasedDetection();
          });
        }, 100);
      } else {
        console.log('Offscreen creation failed, trying tab approach');
        tryTabBasedDetection();
      }
    } catch (error) {
      console.error('Chrome theme detection initialization failed:', error);
      tryTabBasedDetection();
    }
  } else {
    // Firefox: Start with light theme, will be updated by content script when user visits GitHub
    console.log('Firefox: Starting with light theme, will update via content script');
    updateIcon('light');
  }
}

// Fallback: Create a temporary tab for theme detection (Chrome)
async function tryTabBasedDetection() {
  try {
    console.log('Trying tab-based theme detection');
    const tab = await chrome.tabs.create({
      url: 'data:text/html,<script>chrome.runtime.sendMessage({scheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", source: "tab"});</script>',
      active: false
    });
    
    // Clean up the tab after a short delay
    setTimeout(() => {
      chrome.tabs.remove(tab.id);
    }, 500);
    
  } catch (error) {
    console.error('Tab-based detection failed:', error);
    updateIcon('light');
  }
}

// Set initial icon on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup');
  await initializeThemeDetection();
});

// Set initial icon on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  await initializeThemeDetection();
});