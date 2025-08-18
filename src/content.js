// GitHub Markdown Exporter - Content Script
class GitHubMarkdownExporter {
  constructor() {
    this.isProcessing = false;
    this.init();
  }

  init() {
    // Wait for page to load and add button
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.addExportButtonWithRetry());
    } else {
      this.addExportButtonWithRetry();
    }

    // Listen for navigation changes (GitHub is a single-page application)
    this.setupNavigationListeners();
  }

  setupNavigationListeners() {
    // Track current URL to detect navigation
    let currentUrl = window.location.href;
    console.log('GitHub Markdown Exporter: Initial URL:', currentUrl);

    // Method 1: Listen for browser navigation events
    window.addEventListener('popstate', () => {
      console.log('GitHub Markdown Exporter: Popstate event detected');
      this.handleNavigation();
    });

    // Method 2: Override pushState and replaceState to catch programmatic navigation
    const self = this;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      console.log('GitHub Markdown Exporter: PushState detected:', args[2] || args[0]);
      setTimeout(() => self.handleNavigation(), 200);
      return result;
    };
    
    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      console.log('GitHub Markdown Exporter: ReplaceState detected:', args[2] || args[0]);
      setTimeout(() => self.handleNavigation(), 200);
      return result;
    };

    // Method 3: Listen for turbo navigation events (GitHub uses Turbo)
    document.addEventListener('turbo:load', () => {
      console.log('GitHub Markdown Exporter: Turbo load detected');
      this.handleNavigation();
    });

    document.addEventListener('turbo:render', () => {
      console.log('GitHub Markdown Exporter: Turbo render detected');
      this.handleNavigation();
    });

    // Method 4: Watch for URL changes using MutationObserver
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        console.log('GitHub Markdown Exporter: URL change detected via mutation:', window.location.href);
        currentUrl = window.location.href;
        this.handleNavigation();
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });

    // Method 5: Periodic URL checking as fallback
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        console.log('GitHub Markdown Exporter: URL change detected via polling:', window.location.href);
        currentUrl = window.location.href;
        this.handleNavigation();
      }
    }, 2000);

    console.log('GitHub Markdown Exporter: Navigation listeners set up');
  }

  handleNavigation() {
    console.log('GitHub Markdown Exporter: Handling navigation to:', window.location.href);
    
    // Wait a bit for the page to load, then try to add button
    setTimeout(() => {
      this.addExportButtonWithRetry();
    }, 800);
  }

  addExportButtonWithRetry() {
    // Try adding the button immediately
    if (this.addExportButton()) {
      return;
    }

    // If it fails, retry a few times as the page might still be loading
    let attempts = 0;
    const maxAttempts = 10;
    const retryInterval = setInterval(() => {
      attempts++;
      if (this.addExportButton() || attempts >= maxAttempts) {
        clearInterval(retryInterval);
      }
    }, 500);
  }

  detectPageInfo() {
    const url = window.location.href;
    const pathParts = url.split('/');
    
    if (pathParts.length < 7) return null;
    
    const owner = pathParts[3];
    const repo = pathParts[4];
    const type = pathParts[5]; // 'issues', 'discussions', or 'pull'
    const number = pathParts[6];
    
    // Validate we're on an issue, discussion, or pull request page
    if (!['issues', 'discussions', 'pull'].includes(type) || !number || isNaN(parseInt(number))) {
      return null;
    }
    
    // Map 'pull' to 'issues' since GitHub API treats PRs as issues
    const apiType = type === 'pull' ? 'issues' : type;
    
    return {
      owner,
      repo,
      type: apiType,
      number: parseInt(number),
      displayType: type // Keep original type for display purposes
    };
  }

  addExportButton() {
    const pageInfo = this.detectPageInfo();
    if (!pageInfo) {
      console.log('GitHub Markdown Exporter: Not on an issue, discussion, or pull request page');
      return false;
    }

    console.log('GitHub Markdown Exporter: Detected page info:', pageInfo);

    // Remove existing buttons if present (there might be multiple)
    const existingButtons = document.querySelectorAll('[id^="github-markdown-export-btn"]');
    existingButtons.forEach(btn => {
      btn.remove();
      console.log('GitHub Markdown Exporter: Removed existing button');
    });

    // For GitHub's responsive design, we need to add buttons to both mobile and desktop containers
    const containers = this.findAllButtonContainers();
    if (containers.length === 0) {
      console.warn('GitHub Markdown Exporter: Could not find any button containers');
      return false;
    }

    console.log(`GitHub Markdown Exporter: Found ${containers.length} button containers`);

    let addedCount = 0;
    containers.forEach((container, index) => {
      const exportButton = this.createExportButton(pageInfo, `github-markdown-export-btn-${index}`);
      container.appendChild(exportButton);
      addedCount++;
      console.log(`GitHub Markdown Exporter: Added button ${index + 1} to container`);
    });

    console.log(`GitHub Markdown Exporter: Successfully added ${addedCount} buttons`);
    return addedCount > 0;
  }

  createExportButton(pageInfo, buttonId) {
    const exportButton = document.createElement('button');
    exportButton.id = buttonId;
    exportButton.className = 'prc-Button-ButtonBase-c50BI';
    exportButton.setAttribute('data-component', 'Button');
    exportButton.setAttribute('data-loading', 'false');
    exportButton.setAttribute('data-no-visuals', 'true');
    exportButton.setAttribute('data-size', 'medium');
    exportButton.setAttribute('data-variant', 'default');
    exportButton.innerHTML = `
      <span data-component="buttonContent" data-align="center" class="prc-Button-ButtonContent-HKbr-">
        <span data-component="leadingVisual" class="prc-Button-Visual-2szjw prc-Button-LeadingVisual-K5XKQ">
          <svg aria-hidden="true" focusable="false" class="octicon octicon-download" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path fill-rule="evenodd" d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"></path>
          </svg>
        </span>
        <span data-component="text" class="prc-Button-Label-pTQ3x">Copy to Markdown</span>
      </span>
    `;
    exportButton.addEventListener('click', () => this.exportToMarkdown(pageInfo));
    return exportButton;
  }

  findAllButtonContainers() {
    const containers = [];
    
    // Strategy 1: Find all button containers (both visible and mobile-hidden)
    const buttonContainerSelectors = [
      // Main actions area (desktop)
      '[data-component="PH_Actions"] .HeaderMenu-module__menuActionsContainer--Gf9W9',
      '.prc-PageHeader-Actions-ygtmj .HeaderMenu-module__menuActionsContainer--Gf9W9', 
      '.HeaderViewer-module__PageHeader_Actions--SRZVA .HeaderMenu-module__menuActionsContainer--Gf9W9',
      
      // Context area (mobile)
      '.prc-PageHeader-ContextAreaActions-RTJRk .HeaderMenu-module__menuActionsContainer--Gf9W9',
      '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m .HeaderMenu-module__menuActionsContainer--Gf9W9',
      
      // Discussions
      '.gh-header-actions'
    ];

    buttonContainerSelectors.forEach(selector => {
      const container = document.querySelector(selector);
      if (container && !containers.includes(container)) {
        containers.push(container);
        console.log(`Found container with selector: ${selector}`);
      }
    });

    // Strategy 2: If no containers found, look for action areas
    if (containers.length === 0) {
      const actionAreaSelectors = [
        '[data-component="PH_Actions"]',
        '.prc-PageHeader-Actions-ygtmj',
        '.HeaderViewer-module__PageHeader_Actions--SRZVA',
        '.prc-PageHeader-ContextAreaActions-RTJRk',
        '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m',
        '.gh-header-actions'
      ];

      actionAreaSelectors.forEach(selector => {
        const area = document.querySelector(selector);
        if (area && !containers.includes(area)) {
          containers.push(area);
          console.log(`Found action area with selector: ${selector}`);
        }
      });
    }

    // Strategy 3: Create containers if none found
    if (containers.length === 0) {
      const createdContainer = this.createButtonContainer();
      if (createdContainer) {
        containers.push(createdContainer);
      }
    }

    return containers;
  }

  findButtonContainer() {
    // Strategy 1: Try to find visible button containers first (avoid hidden ones)
    const visibleButtonContainerSelectors = [
      // Main actions area (always visible) - prioritize these
      '[data-component="PH_Actions"] .HeaderMenu-module__menuActionsContainer--Gf9W9',
      '.prc-PageHeader-Actions-ygtmj .HeaderMenu-module__menuActionsContainer--Gf9W9', 
      '.HeaderViewer-module__PageHeader_Actions--SRZVA .HeaderMenu-module__menuActionsContainer--Gf9W9',
      
      // Discussions - modern layout  
      '.gh-header-actions'
    ];

    for (const selector of visibleButtonContainerSelectors) {
      const container = document.querySelector(selector);
      if (container && !this.isHidden(container)) {
        console.log(`Found visible button container with selector: ${selector}`);
        return container;
      }
    }

    // Strategy 2: Look for visible action areas to insert into
    const visibleActionAreaSelectors = [
      '[data-component="PH_Actions"]',
      '.prc-PageHeader-Actions-ygtmj',
      '.HeaderViewer-module__PageHeader_Actions--SRZVA',
      '.gh-header-actions'
    ];

    for (const selector of visibleActionAreaSelectors) {
      const area = document.querySelector(selector);
      if (area && !this.isHidden(area)) {
        console.log(`Found visible action area with selector: ${selector}`);
        return area;
      }
    }

    // Strategy 3: Fallback to context area containers only if no visible ones found
    const contextButtonContainerSelectors = [
      '.prc-PageHeader-ContextAreaActions-RTJRk .HeaderMenu-module__menuActionsContainer--Gf9W9',
      '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m .HeaderMenu-module__menuActionsContainer--Gf9W9'
    ];

    for (const selector of contextButtonContainerSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Found context button container with selector: ${selector}`);
        return container;
      }
    }

    // Strategy 4: Create a container in the appropriate header section
    return this.createButtonContainer();
  }

  isHidden(element) {
    // Check if element or any parent has data-hidden-regular="true" or is actually hidden
    let current = element;
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute('data-hidden-regular') === 'true') {
        return true;
      }
      if (window.getComputedStyle && window.getComputedStyle(current).display === 'none') {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  createButtonContainer() {
    // Try different strategies to create a button container
    
    // Strategy 3a: For new issues UI - add to context area
    const contextArea = document.querySelector('.prc-PageHeader-ContextArea-6ykSJ, .HeaderViewer-module__headerContainer--kkVCB');
    if (contextArea) {
      console.log('Creating container in context area');
      const container = document.createElement('div');
      container.className = 'HeaderMenu-module__menuActionsContainer--custom prc-PageHeader-ContextAreaActions-RTJRk';
      container.style.display = 'flex';
      container.style.gap = '8px';
      container.style.alignItems = 'center';
      container.style.marginLeft = '8px';
      
      // Find the best insertion point
      const existingActions = contextArea.querySelector('.prc-PageHeader-ContextAreaActions-RTJRk, .HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m');
      if (existingActions) {
        existingActions.appendChild(container);
      } else {
        contextArea.appendChild(container);
      }
      return container;
    }

    // Strategy 3b: For discussions - add to gh-header-actions area
    const discussionHeader = document.querySelector('.gh-header-show .d-flex.flex-column.flex-md-row');
    if (discussionHeader) {
      console.log('Creating container for discussion');
      let actionsContainer = discussionHeader.querySelector('.gh-header-actions');
      
      if (!actionsContainer) {
        // Create the actions container
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'gh-header-actions mt-0 mt-md-1 mb-2 mb-md-0 flex-shrink-0 d-flex';
        discussionHeader.appendChild(actionsContainer);
      }
      
      return actionsContainer;
    }

    // Strategy 3c: Find title and create container nearby
    const titleSelectors = [
      'h1[data-component="PH_Title"]',
      'h1[class*="prc-PageHeader-Title"]',
      'h1.gh-header-title',
      '.js-issue-title',
      '[data-testid="issue-title"]'
    ];

    for (const selector of titleSelectors) {
      const title = document.querySelector(selector);
      if (title) {
        console.log(`Creating container near title: ${selector}`);
        
        // Find the header container
        let headerContainer = title.closest('[class*="HeaderViewer"], [class*="prc-PageHeader"], .gh-header');
        if (!headerContainer) {
          headerContainer = title.closest('.d-flex');
        }
        if (!headerContainer) {
          headerContainer = title.parentNode;
        }

        const container = document.createElement('div');
        container.className = 'HeaderMenu-module__menuActionsContainer--custom';
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.alignItems = 'center';
        container.style.marginLeft = 'auto';
        container.style.marginRight = '0';
        
        // Try to insert in the best location
        const titleArea = title.closest('[data-component="TitleArea"], .d-flex');
        if (titleArea && titleArea !== headerContainer) {
          titleArea.appendChild(container);
        } else {
          headerContainer.appendChild(container);
        }
        
        return container;
      }
    }

    console.warn('Could not find suitable location for button container');
    return null;
  }

  async exportToMarkdown(pageInfo) {
    if (this.isProcessing) return;

    this.isProcessing = true;
    
    // Update all export buttons
    const buttons = document.querySelectorAll('[id^="github-markdown-export-btn"]');
    const originalTexts = [];
    
    buttons.forEach((button, index) => {
      originalTexts[index] = button.innerHTML;
      button.innerHTML = `
        <span data-component="buttonContent" data-align="center" class="prc-Button-ButtonContent-HKbr-">
          <span data-component="leadingVisual" class="prc-Button-Visual-2szjw prc-Button-LeadingVisual-K5XKQ">
            <svg aria-hidden="true" focusable="false" class="octicon octicon-sync anim-rotate" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path fill-rule="evenodd" d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177L2.623 3.123A7.48 7.48 0 018 .5c4.142 0 7.5 3.358 7.5 7.5a.75.75 0 01-1.5 0A6 6 0 008 2.5zM1.5 8a.75.75 0 01.75.75 6 6 0 006 6 5.487 5.487 0 004.131-1.869l-1.204-1.204a.25.25 0 01.177-.427h3.646a.25.25 0 01.25.25v3.646a.25.25 0 01-.427.177l-1.196-1.196A7.48 7.48 0 018 15.5c-4.142 0-7.5-3.358-7.5-7.5A.75.75 0 011.5 8z"></path>
            </svg>
          </span>
          <span data-component="text" class="prc-Button-Label-pTQ3x">Exporting...</span>
        </span>
      `;
      button.disabled = true;
    });

    try {
      const data = await this.fetchGitHubData(pageInfo);
      const markdown = this.convertToMarkdown(data);
      await this.copyToClipboard(markdown);
      
      // Success feedback
      buttons.forEach((button, index) => {
        button.innerHTML = `✓ Copied to Clipboard`;
        setTimeout(() => {
          button.innerHTML = originalTexts[index];
          button.disabled = false;
          if (index === buttons.length - 1) { // Only reset processing flag after last button
            this.isProcessing = false;
          }
        }, 2000);
      });

    } catch (error) {
      console.error('Export failed:', error);
      
      // Error feedback
      buttons.forEach((button, index) => {
        button.innerHTML = `✗ Export Failed`;
        setTimeout(() => {
          button.innerHTML = originalTexts[index];
          button.disabled = false;
          if (index === buttons.length - 1) { // Only reset processing flag after last button
            this.isProcessing = false;
          }
        }, 3000);
      });

      // Show detailed error to user
      alert(`Export failed: ${error.message}`);
    }
  }

  async fetchGitHubData(pageInfo) {
    const { owner, repo, type, number } = pageInfo;
    
    console.log(`GitHub Markdown Exporter: Fetching data for ${owner}/${repo} ${pageInfo.displayType || type} #${number}`);
    
    // Get stored token if available
    const result = await chrome.storage.sync.get(['githubToken']);
    const token = result.githubToken;
    
    if (token) {
      console.log('GitHub Markdown Exporter: Token found, using authenticated requests');
      console.log(`GitHub Markdown Exporter: Token preview: ${token.substring(0, 10)}...`);
    } else {
      console.log('GitHub Markdown Exporter: No token found, using unauthenticated requests');
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'GitHub-Markdown-Exporter',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    
    if (token) {
      // Use Bearer token format as recommended in GitHub docs
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('GitHub Markdown Exporter: Request headers:', { ...headers, Authorization: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none' });

    // Fetch main issue/discussion
    const mainUrl = `https://api.github.com/repos/${owner}/${repo}/${type}/${number}`;
    console.log(`GitHub Markdown Exporter: Requesting main ${type.slice(0, -1)} from: ${mainUrl}`);
    
    const mainResponse = await fetch(mainUrl, { headers });
    
    console.log(`GitHub Markdown Exporter: Main request response status: ${mainResponse.status} ${mainResponse.statusText}`);
    
    if (!mainResponse.ok) {
      // Log response details for debugging
      console.error('GitHub Markdown Exporter: Request failed');
      console.error('GitHub Markdown Exporter: Response headers:', Object.fromEntries(mainResponse.headers.entries()));
      
      let errorText = '';
      try {
        const errorBody = await mainResponse.text();
        console.error('GitHub Markdown Exporter: Response body:', errorBody);
        errorText = errorBody;
      } catch (e) {
        console.error('GitHub Markdown Exporter: Could not read response body:', e);
      }
      
      if (mainResponse.status === 404) {
        if (token) {
          throw new Error(`${type.slice(0, -1)} not found. Check if the repository exists and your token has access to it.`);
        } else {
          throw new Error(`${type.slice(0, -1)} not found or private. Try adding a GitHub token in the extension popup.`);
        }
      } else if (mainResponse.status === 403) {
        const rateLimitRemaining = mainResponse.headers.get('x-ratelimit-remaining');
        const rateLimitReset = mainResponse.headers.get('x-ratelimit-reset');
        console.log(`GitHub Markdown Exporter: Rate limit remaining: ${rateLimitRemaining}`);
        console.log(`GitHub Markdown Exporter: Rate limit resets at: ${rateLimitReset}`);
        
        if (token) {
          throw new Error('Access forbidden. Check if your token has the required permissions for this repository.');
        } else {
          throw new Error('Rate limit exceeded. Please add a GitHub token in the extension popup.');
        }
      } else if (mainResponse.status === 401) {
        throw new Error('Authentication failed. Please check your GitHub token in the extension popup.');
      } else if (mainResponse.status === 301) {
        throw new Error(`${type.slice(0, -1)} was moved to another repository.`);
      } else if (mainResponse.status === 410) {
        throw new Error(`${type.slice(0, -1)} was deleted from the repository.`);
      }
      throw new Error(`Failed to fetch ${type.slice(0, -1)}: ${mainResponse.status} ${mainResponse.statusText}`);
    }
    
    const mainData = await mainResponse.json();
    console.log(`GitHub Markdown Exporter: Successfully fetched main ${type.slice(0, -1)}: ${mainData.title}`);

    // Fetch comments with pagination
    const comments = await this.fetchAllComments(owner, repo, type, number, headers);

    console.log(`GitHub Markdown Exporter: Successfully fetched ${comments.length} comments`);

    return {
      issue: mainData,
      comments: comments,
      metadata: {
        total_comments: comments.length,
        fetched_at: new Date().toISOString().split('T')[0],
        issue_number: number,
        repository: `${owner}/${repo}`
      }
    };
  }

  async fetchAllComments(owner, repo, type, number, headers) {
    const allComments = [];
    let page = 1;
    const perPage = 100;

    console.log(`GitHub Markdown Exporter: Starting to fetch comments for ${owner}/${repo} ${type} #${number}`);

    while (true) {
      const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/${type}/${number}/comments?page=${page}&per_page=${perPage}`;
      console.log(`GitHub Markdown Exporter: Fetching comments page ${page} from: ${commentsUrl}`);
      
      const response = await fetch(commentsUrl, { headers });
      
      console.log(`GitHub Markdown Exporter: Comments page ${page} response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`GitHub Markdown Exporter: Failed to fetch comments page ${page}`);
        console.error('GitHub Markdown Exporter: Comments response headers:', Object.fromEntries(response.headers.entries()));
        
        try {
          const errorBody = await response.text();
          console.error('GitHub Markdown Exporter: Comments response body:', errorBody);
        } catch (e) {
          console.error('GitHub Markdown Exporter: Could not read comments response body:', e);
        }
        
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }
      
      const comments = await response.json();
      console.log(`GitHub Markdown Exporter: Fetched ${comments.length} comments from page ${page}`);
      
      if (comments.length === 0) {
        console.log('GitHub Markdown Exporter: No more comments, stopping pagination');
        break;
      }
      
      allComments.push(...comments);
      
      if (comments.length < perPage) {
        console.log('GitHub Markdown Exporter: Last page reached, stopping pagination');
        break;
      }
      
      page++;
    }

    console.log(`GitHub Markdown Exporter: Total comments fetched: ${allComments.length}`);
    return allComments;
  }

  convertToMarkdown(data) {
    const { issue, comments } = data;
    
    // Format date
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();
    
    // Build markdown content
    let markdown = `# [${issue.title}](${issue.html_url})\n\n`;
    markdown += `> state: **${issue.state}** opened by: **${issue.user.login}** on: **${formatDate(issue.created_at)}**\n\n`;
    markdown += `${issue.body || ''}\n\n`;
    
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

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
  }
}

// Initialize the exporter (only once)
if (!window.ghMarkdownExporter) {
  window.ghMarkdownExporter = new GitHubMarkdownExporter();
  console.log('GitHub Markdown Exporter: Initialized');
} else {
  console.log('GitHub Markdown Exporter: Already initialized');
}