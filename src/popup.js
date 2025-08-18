// GitHub Markdown Exporter - Popup Script
class PopupManager {
  constructor() {
    this.statusContainer = document.getElementById('status-container');
    this.tokenInput = document.getElementById('github-token');
    this.saveTokenBtn = document.getElementById('save-token');
    this.clearTokenBtn = document.getElementById('clear-token');
    this.testPageBtn = document.getElementById('test-page');
    this.tokenHelpLink = document.getElementById('token-help');
    
    this.init();
  }

  init() {
    // Load saved token
    this.loadToken();
    
    // Event listeners
    this.saveTokenBtn.addEventListener('click', () => this.saveToken());
    this.clearTokenBtn.addEventListener('click', () => this.clearToken());
    this.testPageBtn.addEventListener('click', () => this.testCurrentPage());
    this.tokenHelpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleTokenInstructions();
    });
    
    // Save token on Enter key
    this.tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveToken();
      }
    });
  }

  toggleTokenInstructions() {
    const content = document.getElementById('token-instructions');
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      content.classList.remove('expanded');
    } else {
      content.classList.add('expanded');
    }
  }

  async loadToken() {
    try {
      const result = await chrome.storage.sync.get(['githubToken']);
      if (result.githubToken) {
        // Show masked token
        this.tokenInput.value = '●'.repeat(result.githubToken.length);
        this.tokenInput.placeholder = 'Token saved (masked)';
        this.showStatus('Token loaded', 'success');
      }
    } catch (error) {
      this.showStatus('Failed to load token', 'error');
    }
  }

  async saveToken() {
    const token = this.tokenInput.value.trim();
    
    if (!token || token.startsWith('●')) {
      this.showStatus('Please enter a valid token', 'error');
      return;
    }
    
    // Basic token validation
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      this.showStatus('Invalid token format. Expected ghp_ or github_pat_ prefix', 'error');
      return;
    }
    
    this.saveTokenBtn.disabled = true;
    this.saveTokenBtn.textContent = 'Validating...';
    
    try {
      console.log('GitHub Markdown Exporter Popup: Testing token...');
      
      // Test token by making a simple API call using the same format as content script
      const testResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'GitHub-Markdown-Exporter',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      console.log(`GitHub Markdown Exporter Popup: Token test response: ${testResponse.status}`);
      
      if (!testResponse.ok) {
        const errorBody = await testResponse.text();
        console.error('GitHub Markdown Exporter Popup: Token test failed:', errorBody);
        
        if (testResponse.status === 401) {
          throw new Error(`Invalid token - Authentication failed`);
        } else if (testResponse.status === 403) {
          throw new Error(`Token lacks required permissions`);
        } else {
          throw new Error(`Token validation failed (${testResponse.status})`);
        }
      }
      
      const userData = await testResponse.json();
      console.log(`GitHub Markdown Exporter Popup: Token validated for user: ${userData.login}`);
      
      // Save token
      await chrome.storage.sync.set({ githubToken: token });
      
      // Mask the input
      this.tokenInput.value = '●'.repeat(token.length);
      this.tokenInput.placeholder = 'Token saved (masked)';
      
      this.showStatus(`Token saved and validated for user: ${userData.login}`, 'success');
      
    } catch (error) {
      console.error('GitHub Markdown Exporter Popup: Token save failed:', error);
      this.showStatus(`Failed to save token: ${error.message}`, 'error');
    } finally {
      this.saveTokenBtn.disabled = false;
      this.saveTokenBtn.textContent = 'Save Token';
    }
  }

  async clearToken() {
    try {
      await chrome.storage.sync.remove(['githubToken']);
      this.tokenInput.value = '';
      this.tokenInput.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      this.showStatus('Token cleared', 'success');
    } catch (error) {
      this.showStatus('Failed to clear token', 'error');
    }
  }

  async testCurrentPage() {
    this.testPageBtn.disabled = true;
    this.testPageBtn.textContent = 'Testing...';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('github.com')) {
        throw new Error('Not on a GitHub page');
      }
      
      // Check if it's an issue, discussion, or pull request page
      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/');
      
      if (pathParts.length < 7 || !['issues', 'discussions', 'pull'].includes(pathParts[5])) {
        throw new Error('Not on a GitHub issue, discussion, or pull request page');
      }
      
      const owner = pathParts[3];
      const repo = pathParts[4];
      const type = pathParts[5];
      const number = pathParts[6];
      
      const displayType = type === 'pull' ? 'pull request' : type.slice(0, -1);
      this.showStatus(`✓ Detected: ${owner}/${repo} ${displayType} #${number}`, 'success');
      
      // Trigger the export button on the page
      await chrome.tabs.sendMessage(tab.id, { action: 'triggerExport' });
      
    } catch (error) {
      this.showStatus(`Test failed: ${error.message}`, 'error');
    } finally {
      this.testPageBtn.disabled = false;
      this.testPageBtn.textContent = 'Test Current Page';
    }
  }


  showStatus(message, type) {
    this.statusContainer.innerHTML = `
      <div class="status ${type}">
        ${message}
      </div>
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.statusContainer.innerHTML = '';
    }, 5000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});