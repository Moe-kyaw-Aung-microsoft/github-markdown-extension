/**
 * Offscreen Document for Theme Detection
 * 
 * This document runs in a hidden context and can access
 * window.matchMedia to detect the system color scheme.
 */

function detectAndSendTheme(): void {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  chrome.runtime.sendMessage({
    action: 'theme-detected',
    scheme: isDark ? 'dark' : 'light'
  }).catch(() => {
    // Background may not be ready yet, ignore
  });
}

// Listen for theme detection requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'detect-theme') {
    detectAndSendTheme();
    sendResponse({ success: true });
    return true;
  }
  return false;
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectAndSendTheme);

// Detect theme immediately when document loads
detectAndSendTheme();
