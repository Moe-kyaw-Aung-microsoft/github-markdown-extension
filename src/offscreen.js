// Offscreen document for theme detection
function detectAndSendTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  chrome.runtime.sendMessage({
    action: 'theme-detected',
    scheme: isDark ? 'dark' : 'light'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detect-theme') {
    detectAndSendTheme();
    sendResponse({success: true});
  }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectAndSendTheme);
detectAndSendTheme();