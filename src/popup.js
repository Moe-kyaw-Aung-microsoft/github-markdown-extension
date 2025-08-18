// GitHub Markdown Exporter - Popup Script
class PopupManager {
  constructor() {
    this.statusContainer = document.getElementById('status-container');
    this.tokenInput = document.getElementById('github-token');
    this.saveTokenBtn = document.getElementById('save-token');
    this.clearTokenBtn = document.getElementById('clear-token');
    this.tokenHelpLink = document.getElementById('token-help');
    this.exportSection = document.getElementById('export-section');
    this.refreshPageCheckBtn = document.getElementById('refresh-page-check');
    this.firstButtonRow = document.getElementById('first-button-row');
    this.copyToClipboardBtn = document.getElementById('copy-to-clipboard');
    this.exportCurrentPageBtn = document.getElementById('export-current-page');
    this.openChatGPTBtn = document.getElementById('open-chatgpt');
    this.openClaudeBtn = document.getElementById('open-claude');
    this.openT3ChatBtn = document.getElementById('open-t3chat');
    this.exportDropdown = document.getElementById('export-dropdown');
    this.pageStatus = document.getElementById('page-status');

    this.init();
  }

  init() {
    // Load saved token
    this.loadToken();

    // Check current page and display info
    this.checkAndDisplayPageInfo();

    // Event listeners
    this.saveTokenBtn.addEventListener('click', () => this.saveToken());
    this.clearTokenBtn.addEventListener('click', () => this.clearToken());
    this.refreshPageCheckBtn.addEventListener('click', () => this.checkAndDisplayPageInfo());

    if (this.copyToClipboardBtn) {
      this.copyToClipboardBtn.addEventListener('click', () => this.copyToClipboard());
    }
    if (this.exportCurrentPageBtn) {
      this.exportCurrentPageBtn.addEventListener('click', () => this.exportCurrentPage());
    }
    if (this.openChatGPTBtn) {
      this.openChatGPTBtn.addEventListener('click', () => this.openInChatGPT());
    }
    if (this.openClaudeBtn) {
      this.openClaudeBtn.addEventListener('click', () => this.openInClaude());
    }
    if (this.openT3ChatBtn) {
      this.openT3ChatBtn.addEventListener('click', () => this.openInT3Chat());
    }

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

  async checkAndDisplayPageInfo() {
    this.pageStatus.textContent = 'Checking current page...';

    // Hide copy button and export dropdown initially
    if (this.copyToClipboardBtn) {
      this.copyToClipboardBtn.style.display = 'none';
    }
    if (this.exportDropdown) {
      this.exportDropdown.style.display = 'none';
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('github.com')) {
        this.pageStatus.innerHTML = '❌ Not on a GitHub page';
        return;
      }

      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/').filter(part => part !== '');

      if (pathParts.length < 4 || !['issues', 'discussions', 'pull'].includes(pathParts[2])) {
        this.pageStatus.innerHTML = '❌ Not on a supported page (issues, discussions, or pull requests)';
        return;
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      const type = pathParts[2];
      const number = pathParts[3];

      const displayType = type === 'pull' ? 'pull request' : type.slice(0, -1);
      this.pageStatus.innerHTML = `
        ✅ <strong>${displayType.charAt(0).toUpperCase() + displayType.slice(1)} detected:</strong><br>
        📁 <code>${owner}/${repo}</code><br>
        🔢 ${displayType.charAt(0).toUpperCase() + displayType.slice(1)} #${number}
      `;

      // Show copy button next to refresh button and show export dropdown
      if (this.copyToClipboardBtn) {
        this.copyToClipboardBtn.style.display = 'flex';
      }
      if (this.exportDropdown) {
        this.exportDropdown.style.display = 'block';
      }

    } catch (error) {
      this.pageStatus.innerHTML = `❌ Error checking page: ${error.message}`;
    }
  }

  async copyToClipboard() {
    if (!this.copyToClipboardBtn) return;

    this.copyToClipboardBtn.disabled = true;

    // Update button with loading icon and text
    const originalHTML = this.copyToClipboardBtn.innerHTML;
    this.copyToClipboardBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="animation: spin 1s linear infinite;">
        <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
      </svg>
      Copying...
    `;

    try {
      const markdown = await this.fetchAndFormatMarkdown();

      // Copy to clipboard
      await navigator.clipboard.writeText(markdown);

      // Success state
      this.copyToClipboardBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>
        Copied!
      `;

      setTimeout(() => {
        this.copyToClipboardBtn.innerHTML = originalHTML;
        this.copyToClipboardBtn.disabled = false;
      }, 2000);

      this.showStatus('✓ Successfully copied to clipboard!', 'success');

    } catch (error) {
      // Error state
      this.copyToClipboardBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
        </svg>
        Failed
      `;

      setTimeout(() => {
        this.copyToClipboardBtn.innerHTML = originalHTML;
        this.copyToClipboardBtn.disabled = false;
      }, 3000);

      this.showStatus(`Copy failed: ${error.message}`, 'error');
    }
  }

  async openInChatGPT() {
    try {
      const markdown = await this.fetchAndFormatMarkdown();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      const type = pathParts[2];
      const displayType = type === 'pull' ? 'pull request' : type.slice(0, -1);

      const prompt = `Please analyze this ${displayType} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://chatgpt.com/?hints=search&q=${encodedPrompt}`, '_blank');

      this.showStatus('✓ Opened in ChatGPT', 'success');
    } catch (error) {
      this.showStatus(`Failed to open in ChatGPT: ${error.message}`, 'error');
    }
  }

  async openInClaude() {
    try {
      const markdown = await this.fetchAndFormatMarkdown();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      const type = pathParts[2];
      const displayType = type === 'pull' ? 'pull request' : type.slice(0, -1);

      const prompt = `Please analyze this ${displayType} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://claude.ai/new?q=${encodedPrompt}`, '_blank');

      this.showStatus('✓ Opened in Claude', 'success');
    } catch (error) {
      this.showStatus(`Failed to open in Claude: ${error.message}`, 'error');
    }
  }

  async openInT3Chat() {
    try {
      const markdown = await this.fetchAndFormatMarkdown();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      const type = pathParts[2];
      const displayType = type === 'pull' ? 'pull request' : type.slice(0, -1);

      const prompt = `Please analyze this ${displayType} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://t3.chat/new?q=${encodedPrompt}`, '_blank');

      this.showStatus('✓ Opened in T3 Chat', 'success');
    } catch (error) {
      this.showStatus(`Failed to open in T3 Chat: ${error.message}`, 'error');
    }
  }

  async fetchAndFormatMarkdown() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get current page info
    const url = new URL(tab.url);
    const pathParts = url.pathname.split('/').filter(part => part !== '');

    if (pathParts.length < 4 || !['issues', 'discussions', 'pull'].includes(pathParts[2])) {
      throw new Error('Not on a supported page');
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    const type = pathParts[2];
    const number = pathParts[3];
    const apiType = type === 'pull' ? 'issues' : type;

    // Get GitHub token
    const storage = await chrome.storage.sync.get(['githubToken']);
    const token = storage.githubToken;

    // Make API request
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${apiType}/${number}`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'GitHub-Markdown-Exporter',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      let errorMsg = `API request failed (${response.status})`;
      if (response.status === 404) {
        errorMsg = 'Not found - may need GitHub token for private repos';
      } else if (response.status === 403) {
        errorMsg = 'Rate limited - please add GitHub token';
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();

    // Fetch comments as well
    const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/${apiType}/${number}/comments`;
    const commentsResponse = await fetch(commentsUrl, { headers });
    let comments = [];
    if (commentsResponse.ok) {
      comments = await commentsResponse.json();
    }

    // For pull requests, also fetch diff information
    let diffContent = '';
    if (type === 'pull') {
      try {
        const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
        const diffResponse = await fetch(diffUrl, {
          headers: {
            ...headers,
            'Accept': 'application/vnd.github.v3.diff'
          }
        });
        if (diffResponse.ok) {
          diffContent = await diffResponse.text();
        }
      } catch (error) {
        console.warn('Could not fetch diff:', error);
      }
    }

    // Format as markdown with comments (same as content.js)
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();
    let markdown = `# [${data.title}](${data.html_url})\n\n`;
    markdown += `> state: **${data.state}** opened by: **${data.user.login}** on: **${formatDate(data.created_at)}**\n\n`;
    markdown += `${data.body || ''}\n\n`;

    // Add diff content for pull requests
    if (type === 'pull' && diffContent) {
      markdown += `### Pull Request Diff\n\n\`\`\`diff\n${diffContent}\n\`\`\`\n\n`;
    }

    if (comments && comments.length > 0) {
      markdown += `### Comments\n\n`;

      for (const comment of comments) {
        markdown += `---\n`;
        markdown += `> from: [**${comment.user.login}**](${comment.user.html_url}) on: **${formatDate(comment.created_at)}**\n\n`;
        markdown += `${comment.body}\n`;
      }
    }

    return markdown;
  }

  async exportCurrentPage() {
    // Use the export-current-page button (Save as File button)
    const targetBtn = this.exportCurrentPageBtn;

    if (!targetBtn) return;

    targetBtn.disabled = true;

    // Update button with loading icon and text
    const originalHTML = targetBtn.innerHTML;
    targetBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="animation: spin 1s linear infinite;">
        <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
      </svg>
      Downloading...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      const owner = pathParts[0];
      const repo = pathParts[1];
      const type = pathParts[2];
      const number = pathParts[3];

      // Use the shared method to get formatted markdown
      const markdown = await this.fetchAndFormatMarkdown();

      // Download as file
      const filename = `${owner}-${repo}-${type}-${number}.md`;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (markdownText, fileName) => {
          const blob = new Blob([markdownText], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        args: [markdown, filename]
      });

      // Success state
      targetBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>
        Downloaded!
      `;

      setTimeout(() => {
        targetBtn.innerHTML = originalHTML;
        targetBtn.disabled = false;
      }, 2000);

      this.showStatus(`✓ Successfully downloaded as ${filename}`, 'success');

    } catch (error) {
      // Error state
      targetBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
        </svg>
        Failed
      `;

      setTimeout(() => {
        targetBtn.innerHTML = originalHTML;
        targetBtn.disabled = false;
      }, 3000);

      this.showStatus(`Export failed: ${error.message}`, 'error');
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