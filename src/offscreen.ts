/**
 * Offscreen Document for Theme Detection (Chrome only)
 * 
 * In MV3, service workers don't have DOM access, so we use an offscreen
 * document to detect system color scheme via window.matchMedia.
 * 
 * Firefox uses theme_icons in manifest.json for automatic theme-aware icons.
 */

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let lastReportedScheme: string | null = null;

/**
 * Send current color scheme to background service worker
 * @param force - If true, always send even if scheme hasn't changed
 */
function reportColorScheme(force = false): void {
  const currentScheme = mediaQuery.matches ? 'dark' : 'light';

  // Skip if scheme hasn't changed (unless forced)
  if (!force && currentScheme === lastReportedScheme) {
    return;
  }

  lastReportedScheme = currentScheme;

  chrome.runtime.sendMessage({
    type: 'COLOR_SCHEME',
    scheme: currentScheme,
    dark: mediaQuery.matches
  }).catch(() => {
    // Reset so we retry next time
    lastReportedScheme = null;
  });
}

// Listen for theme detection requests from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'detect-theme') {
    reportColorScheme(true);
    sendResponse({ success: true });
    return true;
  }
  return false;
});

// Listen for system theme changes
mediaQuery.addEventListener('change', () => {
  reportColorScheme(true);
});

// Poll for theme changes every second (catches edge cases)
setInterval(() => {
  const currentScheme = mediaQuery.matches ? 'dark' : 'light';
  if (currentScheme !== lastReportedScheme) {
    reportColorScheme(true);
  }
}, 1000);

// Report theme immediately when document loads
reportColorScheme(true);
