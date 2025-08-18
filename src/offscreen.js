// Offscreen document for theme detection
console.log('Offscreen document loaded for theme detection');

// Function to detect and send current theme
function detectAndSendTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  console.log('Offscreen detected theme:', isDark ? 'dark' : 'light');
  
  // Send theme to background script
  chrome.runtime.sendMessage({
    action: 'theme-detected',
    scheme: isDark ? 'dark' : 'light',
    source: 'offscreen'
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detect-theme') {
    detectAndSendTheme();
    sendResponse({success: true});
  }
});

// Also listen for theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', () => {
  console.log('Offscreen detected theme change');
  detectAndSendTheme();
});

// Send initial theme detection
detectAndSendTheme();