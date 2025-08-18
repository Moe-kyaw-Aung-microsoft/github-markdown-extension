// Content script to detect theme changes and notify background script
(function() {
  console.log('Theme toggle script loaded on:', window.location.href);
  
  // Function to check current theme and send message
  function checkAndSendTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('Theme detected:', isDark ? 'dark' : 'light');
    
    try {
      chrome.runtime.sendMessage({
        scheme: isDark ? "dark" : "light",
        source: 'theme-detection'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Message send error (might be normal):', chrome.runtime.lastError.message);
        } else {
          console.log('Theme message sent successfully');
        }
      });
    } catch (error) {
      console.log('Error sending message:', error);
    }
  }

  // Check theme on script load
  checkAndSendTheme();

  // Listen for theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    console.log('Theme change detected');
    checkAndSendTheme();
  });
})();