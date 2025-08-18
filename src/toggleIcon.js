// Content script for theme detection
(function () {
  function sendTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    chrome.runtime.sendMessage({ scheme: isDark ? 'dark' : 'light' });
  }

  sendTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sendTheme);
})();