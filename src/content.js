// GitHub Markdown Exporter - Content Script
class GitHubMarkdownExporter {
  constructor() {
    this.isProcessing = false;
    this.addSpinAnimation();
    this.init();
  }

  addSpinAnimation() {
    // Add spin animation CSS and theme-aware styles if not already present
    if (!document.getElementById('github-markdown-exporter-animations')) {
      const style = document.createElement('style');
      style.id = 'github-markdown-exporter-animations';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* GitHub New Issue button flex-grow override */
        .HeaderMenu-module__buttonContainer--Nazjm {
          flex-grow: 0 !important;
          margin-left: 0 !important;
        }
        
        /* Copy to Markdown button takes remaining space on mobile only */
        .gh-markdown-export-button-grow {
          flex-grow: 1;
        }
        
        @media screen and (min-width: 768px) {
          .gh-markdown-export-button-grow {
            flex-grow: 0;
          }
          .gh-header-actions.ml-1 {
            width: auto !important;
          }
        }
        
        /* Pull request header actions container margin fix */
        .gh-header-actions.ml-1 {
          margin-left: 0 !important;
          width: 100%;
        }
        
        /* Mobile pull request layout order adjustments */
        .flex-auto.text-right.d-block.d-md-none {
          order: 3;
        }
        .gh-markdown-export-dropdown-border {
          border-left-color: #d1d9e0;
        }
        
        .gh-markdown-export-arrow {
          fill: #5c626d;
        }

        /* Pull Request specific: force arrow to inherit currentColor */
        .gh-markdown-export-pr .gh-markdown-export-arrow {
          fill: currentColor !important;
        }
        
        .gh-markdown-export-menu {
          background: #ffffff;
          border: 1px solid #d3d8df;
          box-shadow: 0 8px 24px rgba(140, 149, 159, 0.15);
        }
        
        .gh-markdown-export-menu-item {
          color: #1f2328;
        }
        
        .gh-markdown-export-menu-item:not(:last-child) {
          border-bottom: 1px solid #e0e4e9;
        }
        
        .gh-markdown-export-menu-item:hover {
          background-color: #eff2f5;
        }
        
        @media (prefers-color-scheme: dark) {
          .gh-markdown-export-dropdown-border {
            border-left-color: #3f444c;
          }
          
          .gh-markdown-export-arrow {
            fill: #9198a1;
          }
          
          .gh-markdown-export-menu {
            background: #020409;
            border: 1px solid #3f444c;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          }
          
          .gh-markdown-export-menu-item {
            color: #e6edf3;
          }
          
          .gh-markdown-export-menu-item:not(:last-child) {
            border-bottom: 1px solid #2d3038;
          }
          
          .gh-markdown-export-menu-item:hover {
            background-color: #1f2328;
          }
        }
      `;
      document.head.appendChild(style);
    }
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

    // Listen for messages from popup
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'triggerExport') {
        const pageInfo = this.detectPageInfo();
        if (pageInfo) {
          // Try to click the export button if it exists
          const exportBtn = document.querySelector('[id^="github-markdown-export-btn"]');
          if (exportBtn) {
            exportBtn.click();
            sendResponse({ success: true, message: 'Export triggered' });
          } else {
            // Button doesn't exist, try to add it and then click
            if (this.addExportButton()) {
              setTimeout(() => {
                const newExportBtn = document.querySelector('[id^="github-markdown-export-btn"]');
                if (newExportBtn) {
                  newExportBtn.click();
                  sendResponse({ success: true, message: 'Export button added and triggered' });
                } else {
                  sendResponse({ success: false, message: 'Could not add export button' });
                }
              }, 100);
            } else {
              sendResponse({ success: false, message: 'Not on a supported page' });
            }
          }
        } else {
          sendResponse({ success: false, message: 'Not on a supported page' });
        }
      }
      return true; // Keep message channel open
    });
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

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      console.log('GitHub Markdown Exporter: PushState detected:', args[2] || args[0]);
      setTimeout(() => self.handleNavigation(), 200);
      return result;
    };

    history.replaceState = function (...args) {
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
    const pathParts = new URL(url).pathname.split('/').filter(part => part !== '');

    if (pathParts.length < 3) return null;

    const owner = pathParts[0];
    const repo = pathParts[1];
    const type = pathParts[2]; // 'issues', 'discussions', 'pull', or 'wiki'

    // Check for wiki pages
    if (type === 'wiki') {
      const pageName = pathParts.length >= 4 ? pathParts.slice(3).join('/') : 'Home';
      return {
        owner,
        repo,
        type: 'wiki',
        pageName: pageName,
        displayType: 'wiki'
      };
    }

    // For issues, discussions, and pull requests we need at least 4 parts
    if (pathParts.length < 4) return null;

    const number = pathParts[3];

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
      console.log('GitHub Markdown Exporter: Not on an issue, discussion, pull request, or wiki page');
      return false;
    }

    console.log('GitHub Markdown Exporter: Detected page info:', pageInfo);

    // Remove existing buttons if present (including groups)
    const existingButtonGroups = document.querySelectorAll('[id^="github-markdown-export-btn"][id$="-group"]');
    const existingButtons = document.querySelectorAll('[id^="github-markdown-export-btn"]:not([id$="-group"]):not([id$="-dropdown"]):not([id$="-menu"])');

    existingButtonGroups.forEach(group => {
      group.remove();
      console.log('GitHub Markdown Exporter: Removed existing button group');
    });

    existingButtons.forEach(btn => {
      // Remove standalone buttons that might not be in groups
      if (!btn.closest('[id$="-group"]')) {
        btn.remove();
        console.log('GitHub Markdown Exporter: Removed existing standalone button');
      }
    });

    // Handle wiki pages separately
    if (pageInfo.type === 'wiki') {
      return this.addWikiExportButton(pageInfo);
    }

    // For GitHub's responsive design, we need to add buttons to both mobile and desktop containers
    const containers = this.findAllButtonContainers();
    if (containers.length === 0) {
      console.warn('GitHub Markdown Exporter: Could not find any button containers');
      return false;
    }

    console.log(`GitHub Markdown Exporter: Found ${containers.length} button containers`);

    // Check if user is author (has edit button) for better placement context
    const hasEditButton = document.querySelector('[data-testid="edit-issue-title-button"], .js-title-edit-button, .js-details-target[aria-label*="Edit"]');
    const isAuthor = !!hasEditButton;
    console.log(`GitHub Markdown Exporter: User appears to be author: ${isAuthor}`);

    // Detect page type for placement logic
    const url = window.location.href;
    const isIssue = url.includes('/issues/');
    const isDiscussion = url.includes('/discussions/');
    const isPullRequest = url.includes('/pull/');

    let addedCount = 0;
    containers.forEach((container, index) => {
      // For issues, we want to add buttons to both desktop and mobile containers
      // For PRs/discussions, skip truly hidden containers but allow mobile ones
      const isMobileContainer = container.getAttribute('data-hidden-regular') === 'true';
      const shouldSkip = containers.length > 1 && this.isHidden(container) && !isMobileContainer && !isIssue;

      if (shouldSkip) {
        console.log(`GitHub Markdown Exporter: Skipping hidden container ${index + 1}`);
        return;
      }

      const exportButton = this.createExportButton(pageInfo, `github-markdown-export-btn-${index}`);

      // Special placement logic for Issues vs Pull Requests/Discussions
      if (isIssue) {
        // For Issues: Place after the "New issue" button and take remaining space
        const newIssueButtonContainer = container.querySelector('.HeaderMenu-module__buttonContainer--Nazjm');
        const newIssueButton = container.querySelector('a[href$="/issues/new"], a[data-hotkey="c"]');

        if (newIssueButtonContainer) {
          // Insert after the New issue button container
          const nextSibling = newIssueButtonContainer.nextElementSibling;
          if (nextSibling) {
            container.insertBefore(exportButton, nextSibling);
          } else {
            container.appendChild(exportButton);
          }
        } else if (newIssueButton) {
          // Fallback: insert after New issue button
          const nextSibling = newIssueButton.nextElementSibling;
          if (nextSibling) {
            container.insertBefore(exportButton, nextSibling);
          } else {
            container.appendChild(exportButton);
          }
        } else {
          // Final fallback: place at beginning
          if (container.firstChild) {
            container.insertBefore(exportButton, container.firstChild);
          } else {
            container.appendChild(exportButton);
          }
        }
      } else {
        // For PRs/Discussions: Place after Code button, before Jump to bottom
        if (isPullRequest) {
          // Find Code button container
          const codeButtonContainer = container.querySelector('get-repo, .flex-md-order-2');
          // Find Jump to bottom link
          const jumpToBottomContainer = container.querySelector('.flex-auto.text-right.d-block.d-md-none');

          if (codeButtonContainer && jumpToBottomContainer) {
            // Insert between Code button and Jump to bottom
            container.insertBefore(exportButton, jumpToBottomContainer);
          } else if (codeButtonContainer) {
            // Insert after Code button
            const nextSibling = codeButtonContainer.nextElementSibling;
            if (nextSibling) {
              container.insertBefore(exportButton, nextSibling);
            } else {
              container.appendChild(exportButton);
            }
          } else {
            // Fallback: append at end
            container.appendChild(exportButton);
          }

          this.adjustPullRequestButtonSizing(container);
        } else {
          // Discussions: simply append
          container.appendChild(exportButton);
        }
      }

      addedCount++;
      console.log(`GitHub Markdown Exporter: Added button ${index + 1} to container`);
    });

    console.log(`GitHub Markdown Exporter: Successfully added ${addedCount} buttons`);
    return addedCount > 0;
  }

  addWikiExportButton(pageInfo) {
    console.log('GitHub Markdown Exporter: Adding wiki export button');

    // Find wiki page header area
    const wikiContainer = this.findWikiButtonContainer();
    if (!wikiContainer) {
      console.warn('GitHub Markdown Exporter: Could not find wiki button container');
      return false;
    }

    const exportButton = this.createWikiExportButton(pageInfo, 'github-markdown-export-btn-wiki');
    wikiContainer.appendChild(exportButton);

    console.log('GitHub Markdown Exporter: Successfully added wiki export button');
    return true;
  }

  findWikiButtonContainer() {
    // Wiki pages have different layouts - try multiple selectors
    const selectors = [
      // Wiki header actions area
      '.gh-header-actions',
      // Wiki page header
      '.wiki-rightbar .wiki-pages-box',
      // Alternative: create container near wiki title
      '#wiki-wrapper .gh-header',
      '.repository-content .gh-header',
      // New wiki layout
      '.Layout-sidebar',
      '.wiki-pages-box'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Found wiki container with selector: ${selector}`);
        
        // For sidebar containers, we want to create a dedicated actions area
        if (selector.includes('sidebar') || selector.includes('wiki-pages-box')) {
          // Create a wrapper for our button that fits the wiki layout
          let actionsWrapper = container.querySelector('.gh-markdown-wiki-actions');
          if (!actionsWrapper) {
            actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'gh-markdown-wiki-actions';
            actionsWrapper.style.cssText = `
              padding: 16px;
              border-bottom: 1px solid var(--borderColor-muted, #d1d9e0);
            `;
            container.insertBefore(actionsWrapper, container.firstChild);
          }
          return actionsWrapper;
        }
        
        return container;
      }
    }

    // Fallback: Try to create a container near the wiki content
    const wikiContent = document.querySelector('#wiki-wrapper, .repository-content .wiki-body, .markdown-body');
    if (wikiContent) {
      console.log('Creating wiki button container near wiki content');
      const container = document.createElement('div');
      container.className = 'gh-markdown-wiki-actions';
      container.style.cssText = `
        display: flex;
        justify-content: flex-end;
        padding: 12px 0;
        margin-bottom: 12px;
      `;
      wikiContent.parentNode.insertBefore(container, wikiContent);
      return container;
    }

    return null;
  }

  createWikiExportButton(pageInfo, buttonId) {
    const styles = this.detectButtonClasses();

    // Create button group container
    const buttonGroup = document.createElement('div');
    buttonGroup.id = `${buttonId}-group`;
    buttonGroup.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 0;
      position: relative;
    `;

    // Create main export button for current page
    const exportButton = document.createElement('button');
    exportButton.id = buttonId;
    exportButton.className = `${styles.buttonClass} gh-markdown-export-btn`;
    exportButton.setAttribute('data-component', 'Button');
    exportButton.setAttribute('data-loading', 'false');
    exportButton.setAttribute('data-no-visuals', 'true');
    exportButton.setAttribute('data-size', 'medium');
    exportButton.setAttribute('data-variant', 'default');
    exportButton.innerHTML = `
      <span data-component="buttonContent" data-align="center" class="${styles.contentClass}">
        <span data-component="leadingVisual" class="${styles.visualClass}" style="display: flex; align-items: center; justify-content: center;">
          <svg aria-hidden="true" focusable="false" class="octicon octicon-copy" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
          </svg>
        </span>
        <span data-component="text" class="${styles.textClass}">Copy Page</span>
      </span>
    `;
    exportButton.addEventListener('click', () => this.exportWikiPage(pageInfo));

    // Style the main button to connect with dropdown
    exportButton.style.cssText = `
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-right: none;
    `;

    // Create dropdown button
    const dropdownButton = document.createElement('button');
    dropdownButton.id = `${buttonId}-dropdown`;
    dropdownButton.className = `${styles.buttonClass} gh-markdown-export-btn gh-markdown-export-dropdown-border`;
    dropdownButton.setAttribute('data-component', 'Button');
    dropdownButton.setAttribute('data-loading', 'false');
    dropdownButton.setAttribute('data-no-visuals', 'true');
    dropdownButton.setAttribute('data-size', 'medium');
    dropdownButton.setAttribute('data-variant', 'default');
    dropdownButton.style.cssText = `
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding-left: 7px;
      padding-right: 7px;
      min-width: auto;
    `;
    dropdownButton.innerHTML = `
      <span data-component="buttonContent" data-align="center" class="${styles.contentClass}">
        <svg aria-hidden="true" focusable="false" class="octicon octicon-triangle-down gh-markdown-export-arrow" viewBox="0 0 16 16" width="16" height="16" display="inline-block" overflow="visible" style="vertical-align: text-bottom;">
          <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
        </svg>
      </span>
    `;

    // Create dropdown menu for wiki
    const dropdownMenu = this.createWikiDropdownMenu(pageInfo, buttonId);

    // Add click handler for dropdown toggle
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(dropdownMenu);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!buttonGroup.contains(e.target)) {
        dropdownMenu.style.display = 'none';
      }
    });

    buttonGroup.appendChild(exportButton);
    buttonGroup.appendChild(dropdownButton);
    buttonGroup.appendChild(dropdownMenu);

    return buttonGroup;
  }

  createWikiDropdownMenu(pageInfo, buttonId) {
    const menu = document.createElement('div');
    menu.id = `${buttonId}-menu`;
    menu.className = 'gh-markdown-export-menu';
    menu.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      border-radius: 6px;
      min-width: 220px;
      margin-top: 4px;
      overflow: hidden;
    `;

    const menuItems = [
      {
        icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>
              </svg>`,
        text: 'Save Current Page',
        action: () => this.downloadWikiPage(pageInfo)
      },
      {
        icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h8.5A2.75 2.75 0 0 1 16 2.75v10.5A2.75 2.75 0 0 1 13.25 16h-8.5A2.75 2.75 0 0 1 2 13.25Zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V2.75c0-.69-.56-1.25-1.25-1.25ZM5 5.75A.75.75 0 0 1 5.75 5h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 5.75Zm0 3A.75.75 0 0 1 5.75 8h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 8.75Zm0 3a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/>
              </svg>`,
        text: 'Download Entire Wiki',
        action: () => this.downloadEntireWiki(pageInfo)
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path xmlns="http://www.w3.org/2000/svg" d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
              </svg>`,
        text: 'Open Wiki in ChatGPT',
        action: () => this.openWikiInChatGPT(pageInfo)
      },
      {
        icon: `<svg width="16" height="16" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24">
                <path xmlns="http://www.w3.org/2000/svg" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/>
              </svg>`,
        text: 'Open Wiki in Claude',
        action: () => this.openWikiInClaude(pageInfo)
      }
    ];

    menuItems.forEach((item) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'gh-markdown-export-menu-item';
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
      `;

      menuItem.innerHTML = `
        ${item.icon} 
        ${item.text}
        ${item.text.startsWith('Open') ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: auto; opacity: 0.6;"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>' : ''}
      `;

      menuItem.addEventListener('click', (e) => {
        e.preventDefault();
        menu.style.display = 'none';
        item.action();
      });

      menu.appendChild(menuItem);
    });

    return menu;
  }

  async exportWikiPage(pageInfo) {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.updateWikiButtonState('exporting');

    try {
      const markdown = await this.fetchWikiPageContent(pageInfo);
      await this.copyToClipboard(markdown);
      this.updateWikiButtonState('success');
      this.showNotification('Wiki page copied to clipboard!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.updateWikiButtonState('error');
      this.showNotification('Export failed: ' + error.message, 'error');
    }
  }

  updateWikiButtonState(state) {
    const buttons = document.querySelectorAll('[id^="github-markdown-export-btn"]:not([id$="-dropdown"])');

    buttons.forEach((button) => {
      const textElement = button.querySelector('[data-component="text"]');
      const iconElement = button.querySelector('[data-component="leadingVisual"] svg');

      if (state === 'exporting') {
        if (textElement) textElement.textContent = 'Exporting...';
        if (iconElement) {
          iconElement.innerHTML = `<path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />`;
          iconElement.style.animation = 'spin 1s linear infinite';
        }
        button.disabled = true;
      } else if (state === 'success') {
        if (textElement) textElement.textContent = 'Copied!';
        if (iconElement) {
          iconElement.innerHTML = `<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>`;
          iconElement.style.animation = '';
        }
        setTimeout(() => this.resetWikiButton(), 2000);
      } else if (state === 'error') {
        if (textElement) textElement.textContent = 'Failed';
        if (iconElement) {
          iconElement.innerHTML = `<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>`;
          iconElement.style.animation = '';
        }
        setTimeout(() => this.resetWikiButton(), 3000);
      }
    });
  }

  resetWikiButton() {
    const buttons = document.querySelectorAll('[id^="github-markdown-export-btn"]:not([id$="-dropdown"])');

    buttons.forEach((button) => {
      const textElement = button.querySelector('[data-component="text"]');
      const iconElement = button.querySelector('[data-component="leadingVisual"] svg');

      if (textElement) textElement.textContent = 'Copy Page';
      if (iconElement) {
        iconElement.innerHTML = `
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
        `;
      }
      button.disabled = false;
      this.isProcessing = false;
    });
  }

  async fetchWikiPageContent(pageInfo) {
    const { owner, repo, pageName } = pageInfo;

    console.log(`GitHub Markdown Exporter: Fetching wiki page content for ${owner}/${repo}/wiki/${pageName}`);

    // Get the current page's markdown content from the DOM
    const wikiBody = document.querySelector('.markdown-body, .wiki-body');
    if (!wikiBody) {
      throw new Error('Could not find wiki content on the page');
    }

    // Get the page title
    const titleElement = document.querySelector('#wiki-wrapper h1, .gh-header-title, .wiki-title');
    const title = titleElement ? titleElement.textContent.trim() : pageName;

    // Extract the rendered HTML and convert to markdown
    const htmlContent = wikiBody.innerHTML;
    const markdown = this.htmlToMarkdown(htmlContent, title, pageInfo);

    return markdown;
  }

  htmlToMarkdown(html, title, pageInfo) {
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Build markdown with header
    let markdown = `# ${title}\n\n`;
    markdown += `> Wiki page from: **${pageInfo.owner}/${pageInfo.repo}**\n\n`;

    // Process the content
    markdown += this.processHtmlNode(temp);

    return markdown;
  }

  processHtmlNode(node) {
    let result = '';

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        switch (tagName) {
          case 'h1':
            result += `\n# ${child.textContent.trim()}\n\n`;
            break;
          case 'h2':
            result += `\n## ${child.textContent.trim()}\n\n`;
            break;
          case 'h3':
            result += `\n### ${child.textContent.trim()}\n\n`;
            break;
          case 'h4':
            result += `\n#### ${child.textContent.trim()}\n\n`;
            break;
          case 'h5':
            result += `\n##### ${child.textContent.trim()}\n\n`;
            break;
          case 'h6':
            result += `\n###### ${child.textContent.trim()}\n\n`;
            break;
          case 'p':
            result += `${this.processHtmlNode(child)}\n\n`;
            break;
          case 'br':
            result += '\n';
            break;
          case 'strong':
          case 'b':
            result += `**${child.textContent}**`;
            break;
          case 'em':
          case 'i':
            result += `*${child.textContent}*`;
            break;
          case 'code':
            if (child.parentElement && child.parentElement.tagName.toLowerCase() === 'pre') {
              // Skip, handled by pre
            } else {
              result += `\`${child.textContent}\``;
            }
            break;
          case 'pre':
            const codeBlock = child.querySelector('code');
            const lang = codeBlock ? (codeBlock.className.match(/language-(\w+)/) || ['', ''])[1] : '';
            const code = codeBlock ? codeBlock.textContent : child.textContent;
            result += `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
            break;
          case 'a':
            const href = child.getAttribute('href') || '';
            result += `[${child.textContent}](${href})`;
            break;
          case 'img':
            const src = child.getAttribute('src') || '';
            const alt = child.getAttribute('alt') || '';
            result += `![${alt}](${src})`;
            break;
          case 'ul':
            result += '\n';
            for (const li of child.querySelectorAll(':scope > li')) {
              result += `- ${this.processHtmlNode(li).trim()}\n`;
            }
            result += '\n';
            break;
          case 'ol':
            result += '\n';
            let num = 1;
            for (const li of child.querySelectorAll(':scope > li')) {
              result += `${num}. ${this.processHtmlNode(li).trim()}\n`;
              num++;
            }
            result += '\n';
            break;
          case 'blockquote':
            const lines = this.processHtmlNode(child).trim().split('\n');
            result += lines.map(line => `> ${line}`).join('\n') + '\n\n';
            break;
          case 'table':
            result += this.processTable(child);
            break;
          case 'hr':
            result += '\n---\n\n';
            break;
          case 'div':
          case 'span':
          case 'section':
          case 'article':
            result += this.processHtmlNode(child);
            break;
          default:
            result += this.processHtmlNode(child);
        }
      }
    }

    return result;
  }

  processTable(table) {
    let result = '\n';
    const rows = table.querySelectorAll('tr');

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map(cell => cell.textContent.trim());
      result += '| ' + cellContents.join(' | ') + ' |\n';

      // Add header separator after first row
      if (rowIndex === 0) {
        result += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
      }
    });

    result += '\n';
    return result;
  }

  async downloadWikiPage(pageInfo) {
    try {
      const markdown = await this.fetchWikiPageContent(pageInfo);
      const filename = `${pageInfo.owner}-${pageInfo.repo}-wiki-${pageInfo.pageName.replace(/\//g, '-')}.md`;

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Wiki page downloaded!', 'success');
    } catch (error) {
      this.showNotification('Download failed: ' + error.message, 'error');
    }
  }

  async downloadEntireWiki(pageInfo) {
    this.showNotification('Fetching all wiki pages...', 'success');

    try {
      const wikiPages = await this.fetchAllWikiPages(pageInfo);

      if (wikiPages.length === 0) {
        throw new Error('No wiki pages found');
      }

      // Combine all pages into one markdown document
      let combinedMarkdown = `# ${pageInfo.owner}/${pageInfo.repo} - Wiki Documentation\n\n`;
      combinedMarkdown += `> Exported on: ${new Date().toLocaleDateString()}\n\n`;
      combinedMarkdown += `## Table of Contents\n\n`;

      // Add table of contents
      wikiPages.forEach((page, index) => {
        combinedMarkdown += `${index + 1}. [${page.title}](#${page.title.toLowerCase().replace(/\s+/g, '-')})\n`;
      });

      combinedMarkdown += '\n---\n\n';

      // Add each page's content
      for (const page of wikiPages) {
        combinedMarkdown += `## ${page.title}\n\n`;
        combinedMarkdown += page.content + '\n\n';
        combinedMarkdown += '---\n\n';
      }

      const filename = `${pageInfo.owner}-${pageInfo.repo}-wiki-complete.md`;

      const blob = new Blob([combinedMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification(`Downloaded ${wikiPages.length} wiki pages!`, 'success');
    } catch (error) {
      console.error('Download entire wiki failed:', error);
      this.showNotification('Download failed: ' + error.message, 'error');
    }
  }

  async fetchAllWikiPages(pageInfo) {
    const { owner, repo } = pageInfo;
    const pages = [];

    // Get list of all wiki pages from the sidebar
    const wikiLinks = document.querySelectorAll('.wiki-pages-box a, .wiki-rightbar a[href*="/wiki/"], .Layout-sidebar a[href*="/wiki/"]');
    const pageUrls = new Set();

    // Add current page
    pageUrls.add(window.location.pathname);

    // Add all linked pages
    wikiLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('/wiki')) {
        // Make sure it's a valid wiki page link (not edit, history, etc.)
        if (!href.includes('/_') && !href.includes('/wiki/') && href.endsWith('/wiki')) {
          // This is the main wiki page
          pageUrls.add(href);
        } else if (href.includes('/wiki/') && !href.includes('/_')) {
          pageUrls.add(href);
        }
      }
    });

    // Also try to get pages from the Pages panel
    const pagesPanel = document.querySelector('.wiki-pages-box ul, .wiki-pages ul');
    if (pagesPanel) {
      pagesPanel.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/wiki')) {
          pageUrls.add(href);
        }
      });
    }

    console.log(`GitHub Markdown Exporter: Found ${pageUrls.size} wiki pages to fetch`);

    // Fetch each page's content
    for (const pageUrl of pageUrls) {
      try {
        // If it's the current page, just get from DOM
        if (pageUrl === window.location.pathname || pageUrl === window.location.href) {
          const currentContent = await this.fetchWikiPageContent(pageInfo);
          const titleEl = document.querySelector('#wiki-wrapper h1, .gh-header-title');
          pages.push({
            title: titleEl ? titleEl.textContent.trim() : pageInfo.pageName,
            content: currentContent
          });
        } else {
          // Fetch other pages
          const fullUrl = pageUrl.startsWith('http') ? pageUrl : `https://github.com${pageUrl}`;
          const response = await fetch(fullUrl);
          if (response.ok) {
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const wikiBody = doc.querySelector('.markdown-body, .wiki-body');
            const titleEl = doc.querySelector('#wiki-wrapper h1, .gh-header-title, .wiki-title');

            if (wikiBody) {
              const title = titleEl ? titleEl.textContent.trim() : pageUrl.split('/').pop() || 'Home';
              const content = this.htmlToMarkdown(wikiBody.innerHTML, title, pageInfo);
              pages.push({ title, content });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch wiki page: ${pageUrl}`, error);
      }
    }

    return pages;
  }

  async openWikiInChatGPT(pageInfo) {
    try {
      const markdown = await this.fetchWikiPageContent(pageInfo);
      const prompt = `Please analyze this wiki documentation from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://chatgpt.com/?hints=search&q=${encodedPrompt}`, '_blank');
    } catch (error) {
      this.showNotification('Failed to open in ChatGPT: ' + error.message, 'error');
    }
  }

  async openWikiInClaude(pageInfo) {
    try {
      const markdown = await this.fetchWikiPageContent(pageInfo);
      const prompt = `Please analyze this wiki documentation from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://claude.ai/new?q=${encodedPrompt}`, '_blank');
    } catch (error) {
      this.showNotification('Failed to open in Claude: ' + error.message, 'error');
    }
  }

  detectButtonClasses() {
    // Try to find a reference button on the page to copy styles from
    const selector = '[data-component="Button"][data-size="medium"], [data-component="Button"]';
    const referenceBtn = document.querySelector(selector);

    if (referenceBtn) {
      const classList = Array.from(referenceBtn.classList);
      // Prefer classes starting with prc-Button-ButtonBase-
      const baseClass = classList.find(c => c.startsWith('prc-Button-ButtonBase-')) || classList[0];

      const contentSpan = referenceBtn.querySelector('[data-component="buttonContent"]');
      const textSpan = referenceBtn.querySelector('[data-component="text"]');
      const visualSpan = referenceBtn.querySelector('[data-component="leadingVisual"]');

      return {
        buttonClass: baseClass || 'prc-Button-ButtonBase-9n-Xk',
        contentClass: contentSpan ? contentSpan.className : 'prc-Button-ButtonContent-Iohp5',
        textClass: textSpan ? textSpan.className : 'prc-Button-Label-FWkx3',
        visualClass: visualSpan ? visualSpan.className : 'prc-Button-Visual-2szjw prc-Button-LeadingVisual-K5XKQ'
      };
    }

    return {
      buttonClass: 'prc-Button-ButtonBase-9n-Xk',
      contentClass: 'prc-Button-ButtonContent-Iohp5',
      textClass: 'prc-Button-Label-FWkx3',
      visualClass: 'prc-Button-Visual-2szjw prc-Button-LeadingVisual-K5XKQ'
    };
  }

  createExportButton(pageInfo, buttonId) {
    const styles = this.detectButtonClasses();

    // Detect container context for optimal styling
    const url = window.location.href;
    const isIssue = url.includes('/issues/');
    const isDiscussion = url.includes('/discussions/');
    const isPullRequest = url.includes('/pull/');

    // Create button group container with context-aware spacing
    const buttonGroup = document.createElement('div');
    buttonGroup.id = `${buttonId}-group`;

    // Add flex-grow for issues and pull requests (mobile only via CSS media query)
    if (isIssue) {
      buttonGroup.className = 'gh-markdown-export-button-grow';
    } else if (isPullRequest) {
      buttonGroup.classList.add('gh-markdown-export-button-grow');
      buttonGroup.classList.add('gh-markdown-export-pr');
    }

    // Adjust margins based on context
    let marginLeft = '0.25rem';
    if (isIssue) {
      marginLeft = '0';
    } else if (isPullRequest) {
      marginLeft = '0';
    } else if (isDiscussion) {
      const hasEditButton = document.querySelector('.js-title-edit-button, .js-details-target[aria-label*="Edit"]');
      marginLeft = hasEditButton ? '0.25rem' : '0';
    }

    // For issues with flex-grow we don't want the dropdown menu to be positioned relative to the full-width flex item.
    // We'll insert an inner wrapper that sizes to content and is position:relative; the outer container can still grow.
    // Use inner wrapper when flex-grow is applied (issues & pull requests) so dropdown anchors to content width
    const useInnerWrapper = isIssue || isPullRequest;

    buttonGroup.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 0;
      margin-left: ${marginLeft};
      ${!useInnerWrapper ? 'position: relative;' : ''}
      ${isPullRequest ? 'order: 3;' : ''}
    `;

    let targetContainer = buttonGroup; // where buttons & menu will be appended
    if (useInnerWrapper) {
      const inner = document.createElement('div');
      inner.className = 'gh-markdown-export-inner';
      inner.style.cssText = `
        display: flex;
        position: relative;
        gap: 0;
        width: max-content;
        max-width: 100%;
      `;
      buttonGroup.appendChild(inner);
      targetContainer = inner;
    }

    // Create main export button (copy to clipboard)
    const exportButton = document.createElement('button');
    exportButton.id = buttonId;
    exportButton.className = `${styles.buttonClass} gh-markdown-export-btn`;
    exportButton.setAttribute('data-component', 'Button');
    exportButton.setAttribute('data-loading', 'false');
    exportButton.setAttribute('data-no-visuals', 'true');
    exportButton.setAttribute('data-size', 'medium');
    exportButton.setAttribute('data-variant', 'default');
    exportButton.innerHTML = `
      <span data-component="buttonContent" data-align="center" class="${styles.contentClass}">
        <span data-component="leadingVisual" class="${styles.visualClass}" style="display: flex; align-items: center; justify-content: center;">
          <svg aria-hidden="true" focusable="false" class="octicon octicon-copy" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
          </svg>
        </span>
        <span data-component="text" class="${styles.textClass}">Copy to Markdown</span>
      </span>
    `;
    exportButton.addEventListener('click', () => this.exportToMarkdown(pageInfo));

    // Create dropdown button
    const dropdownButton = document.createElement('button');
    dropdownButton.id = `${buttonId}-dropdown`;
    dropdownButton.className = `${styles.buttonClass} gh-markdown-export-btn gh-markdown-export-dropdown-border`;
    dropdownButton.setAttribute('data-component', 'Button');
    dropdownButton.setAttribute('data-loading', 'false');
    dropdownButton.setAttribute('data-no-visuals', 'true');
    dropdownButton.setAttribute('data-size', 'medium');
    dropdownButton.setAttribute('data-variant', 'default');

    dropdownButton.style.cssText = `
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding-left: 7px;
      padding-right: 7px;
      min-width: auto;
    `;
    dropdownButton.innerHTML = `
      <span data-component="buttonContent" data-align="center" class="${styles.contentClass}">
        <svg aria-hidden="true" focusable="false" class="octicon octicon-triangle-down gh-markdown-export-arrow" viewBox="0 0 16 16" width="16" height="16" display="inline-block" overflow="visible" style="vertical-align: text-bottom;">
          <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
        </svg>
      </span>
    `;

    // Style the main button to connect with dropdown
    exportButton.style.cssText = `
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-right: none;
    `;

    // Create dropdown menu
    const dropdownMenu = this.createDropdownMenu(pageInfo, buttonId);

    // Add click handler for dropdown toggle
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // Don't let processing state interfere with dropdown
      this.toggleDropdown(dropdownMenu);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!buttonGroup.contains(e.target)) {
        dropdownMenu.style.display = 'none';
      }
    });

    targetContainer.appendChild(exportButton);
    targetContainer.appendChild(dropdownButton);
    targetContainer.appendChild(dropdownMenu);

    return buttonGroup;
  }

  adjustPullRequestButtonSizing(container) {
    // Find Edit and Code buttons in Pull Requests and adjust their size to match our medium button
    const editButton = container.querySelector('.js-title-edit-button, .js-details-target');
    const codeButton = container.querySelector('[class*="Button--secondary"][class*="Button--small"]');

    // Adjust Edit button to medium size
    if (editButton && editButton.classList.contains('Button--small')) {
      editButton.classList.remove('Button--small');
      editButton.classList.add('Button--medium');
      editButton.setAttribute('data-size', 'medium');
      console.log('GitHub Markdown Exporter: Adjusted Edit button to medium size');
    }

    // Adjust Code button to medium size
    if (codeButton && codeButton.classList.contains('Button--small')) {
      codeButton.classList.remove('Button--small');
      codeButton.classList.add('Button--medium');
      codeButton.setAttribute('data-size', 'medium');
      console.log('GitHub Markdown Exporter: Adjusted Code button to medium size');
    }

    // Also adjust any nested buttons in the Code dropdown
    const codeDropdown = container.querySelector('get-repo details');
    if (codeDropdown) {
      const codeButtonInDropdown = codeDropdown.querySelector('summary[class*="Button--small"]');
      if (codeButtonInDropdown && codeButtonInDropdown.classList.contains('Button--small')) {
        codeButtonInDropdown.classList.remove('Button--small');
        codeButtonInDropdown.classList.add('Button--medium');
        console.log('GitHub Markdown Exporter: Adjusted Code dropdown button to medium size');
      }
    }

    // Fix ordering for the empty flex container using JavaScript
    const emptyFlexContainer = container.querySelector('.d-flex.flex-order-2.flex-md-order-1.mx-2');
    if (emptyFlexContainer) {
      // Hide the empty flex container completely with !important
      emptyFlexContainer.style.setProperty('display', 'none', 'important');
      console.log('GitHub Markdown Exporter: Hidden empty flex container with !important');

      // Listen for viewport changes to maintain the hidden state
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      const handleViewportChange = (e) => {
        emptyFlexContainer.style.setProperty('display', 'none', 'important');
      };
      mediaQuery.addListener(handleViewportChange);
    }

    // Set order for Edit button
    if (editButton) {
      editButton.style.order = '2';
      console.log('GitHub Markdown Exporter: Set order 2 for Edit button');
    }

    // Set order for Code button container
    const codeButtonContainer = container.querySelector('.flex-md-order-2');
    if (codeButtonContainer && codeButtonContainer.querySelector('get-repo')) {
      codeButtonContainer.style.order = '2';
      console.log('GitHub Markdown Exporter: Set order 2 for Code button container');
    }
  }

  createDropdownMenu(pageInfo, buttonId) {
    const menu = document.createElement('div');
    menu.id = `${buttonId}-menu`;
    menu.className = 'gh-markdown-export-menu';
    menu.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      border-radius: 6px;
      min-width: 200px;
      margin-top: 4px;
      overflow: hidden;
    `;

    const menuItems = [
      {
        icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>
              </svg>`,
        text: 'Save as File',
        action: () => this.downloadAsFile(pageInfo)
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path xmlns="http://www.w3.org/2000/svg" d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
              </svg>`,
        text: 'Open in ChatGPT',
        action: () => this.openInChatGPT(pageInfo)
      },
      {
        icon: `<svg width="16" height="16" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24">
                <path xmlns="http://www.w3.org/2000/svg" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/>
              </svg>`,
        text: 'Open in Claude',
        action: () => this.openInClaude(pageInfo)
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
              </svg>`,
        text: 'Open in T3 Chat',
        action: () => this.openInT3Chat(pageInfo)
      }
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'gh-markdown-export-menu-item';
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
      `;

      menuItem.innerHTML = `
        ${item.icon} 
        ${item.text}
        ${item.text.startsWith('Open') ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: auto; opacity: 0.6;"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>' : ''}
      `;

      menuItem.addEventListener('click', (e) => {
        e.preventDefault();
        menu.style.display = 'none';
        item.action();
      });

      menu.appendChild(menuItem);
    });

    return menu;
  }

  toggleDropdown(menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  async downloadAsFile(pageInfo) {
    try {
      const markdown = await this.fetchAndFormatMarkdown(pageInfo);
      const filename = `${pageInfo.owner}-${pageInfo.repo}-${pageInfo.type}-${pageInfo.number}.md`;

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Downloaded as file successfully!', 'success');
    } catch (error) {
      this.showNotification('Download failed: ' + error.message, 'error');
    }
  }

  async openInChatGPT(pageInfo) {
    try {
      const markdown = await this.fetchAndFormatMarkdown(pageInfo);
      const prompt = `Please analyze this ${pageInfo.displayType === 'pull' ? 'pull request' : pageInfo.displayType.slice(0, -1)} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://chatgpt.com/?hints=search&q=${encodedPrompt}`, '_blank');
    } catch (error) {
      this.showNotification('Failed to open in ChatGPT: ' + error.message, 'error');
    }
  }

  async openInClaude(pageInfo) {
    try {
      const markdown = await this.fetchAndFormatMarkdown(pageInfo);
      const prompt = `Please analyze this ${pageInfo.displayType === 'pull' ? 'pull request' : pageInfo.displayType.slice(0, -1)} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://claude.ai/new?q=${encodedPrompt}`, '_blank');
    } catch (error) {
      this.showNotification('Failed to open in Claude: ' + error.message, 'error');
    }
  }

  async openInT3Chat(pageInfo) {
    try {
      const markdown = await this.fetchAndFormatMarkdown(pageInfo);
      const prompt = `Please analyze this ${pageInfo.displayType === 'pull' ? 'pull request' : pageInfo.displayType.slice(0, -1)} from GitHub:\n\n${markdown}`;
      const encodedPrompt = encodeURIComponent(prompt);
      window.open(`https://t3.chat/new?q=${encodedPrompt}`, '_blank');
    } catch (error) {
      this.showNotification('Failed to open in T3 Chat: ' + error.message, 'error');
    }
  }

  async fetchAndFormatMarkdown(pageInfo) {
    // Reuse the existing export logic
    const response = await this.fetchGitHubData(pageInfo);
    return this.convertToMarkdown(response);
  }

  findAllButtonContainers() {
    const containers = [];

    // Detect page type for targeted approach
    const url = window.location.href;
    const isIssue = url.includes('/issues/');
    const isDiscussion = url.includes('/discussions/');
    const isPullRequest = url.includes('/pull/');

    console.log(`GitHub Markdown Exporter: Detected page type - Issue: ${isIssue}, Discussion: ${isDiscussion}, PR: ${isPullRequest}`);

    if (isIssue) {
      // Issues use the new responsive header design
      const issueContainerSelectors = [
        // Main actions area (desktop) - primary target
        '[data-component="PH_Actions"] .HeaderMenu-module__menuActionsContainer--Gf9W9',
        '.prc-PageHeader-Actions-ygtmj .HeaderMenu-module__menuActionsContainer--Gf9W9',
        '.HeaderViewer-module__PageHeader_Actions--SRZVA .HeaderMenu-module__menuActionsContainer--Gf9W9',

        // Context area (mobile/responsive) - secondary target
        '.prc-PageHeader-ContextAreaActions-RTJRk .HeaderMenu-module__menuActionsContainer--Gf9W9',
        '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m .HeaderMenu-module__menuActionsContainer--Gf9W9'
      ];

      issueContainerSelectors.forEach(selector => {
        const container = document.querySelector(selector);
        if (container && !containers.includes(container)) {
          containers.push(container);
          console.log(`Found issue container with selector: ${selector}`);
        }
      });
    }
    else if (isDiscussion || isPullRequest) {
      // Discussions and PRs use the older .gh-header-actions design
      const discussionPRSelectors = [
        '.gh-header-actions'
      ];

      discussionPRSelectors.forEach(selector => {
        const container = document.querySelector(selector);
        if (container && !containers.includes(container)) {
          containers.push(container);
          console.log(`Found discussion/PR container with selector: ${selector}`);
        }
      });
    }

    // Fallback: If no specific containers found, try broader selectors
    if (containers.length === 0) {
      const fallbackSelectors = [
        // Try to find any menu actions container
        '.HeaderMenu-module__menuActionsContainer--Gf9W9',
        '.gh-header-actions',

        // Action areas as containers
        '[data-component="PH_Actions"]',
        '.prc-PageHeader-Actions-ygtmj',
        '.HeaderViewer-module__PageHeader_Actions--SRZVA',
        '.prc-PageHeader-ContextAreaActions-RTJRk',
        '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m'
      ];

      fallbackSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && !containers.includes(element)) {
          containers.push(element);
          console.log(`Found fallback container with selector: ${selector}`);
        }
      });
    }

    // Last resort: Create containers if none found
    if (containers.length === 0) {
      const createdContainer = this.createButtonContainer();
      if (createdContainer) {
        containers.push(createdContainer);
      }
    }

    console.log(`GitHub Markdown Exporter: Found ${containers.length} total containers`);
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
    // Detect page type for targeted container creation
    const url = window.location.href;
    const isIssue = url.includes('/issues/');
    const isDiscussion = url.includes('/discussions/');
    const isPullRequest = url.includes('/pull/');

    console.log(`Creating container for page type - Issue: ${isIssue}, Discussion: ${isDiscussion}, PR: ${isPullRequest}`);

    if (isIssue) {
      // Strategy for Issues: Create in context area or main header
      const contextArea = document.querySelector('.prc-PageHeader-ContextArea-6ykSJ, .HeaderViewer-module__headerContainer--kkVCB');
      if (contextArea) {
        console.log('Creating issue container in context area');
        const container = document.createElement('div');
        container.className = 'HeaderMenu-module__menuActionsContainer--custom';
        container.style.cssText = `
          display: flex;
          gap: 0;
          align-items: center;
          margin-left: 8px;
        `;

        // Find the best insertion point in context area
        const existingActions = contextArea.querySelector('.prc-PageHeader-ContextAreaActions-RTJRk, .HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m');
        if (existingActions) {
          existingActions.appendChild(container);
        } else {
          // Create a context actions wrapper
          const actionsWrapper = document.createElement('div');
          actionsWrapper.className = 'prc-PageHeader-ContextAreaActions-RTJRk';
          actionsWrapper.appendChild(container);
          contextArea.appendChild(actionsWrapper);
        }
        return container;
      }
    }
    else if (isDiscussion || isPullRequest) {
      // Strategy for Discussions/PRs: Create in gh-header-actions area
      const headerShow = document.querySelector('.gh-header-show');
      if (headerShow) {
        console.log('Creating discussion/PR container in gh-header-actions');

        // Look for existing .gh-header-actions
        let actionsContainer = headerShow.querySelector('.gh-header-actions');

        if (actionsContainer) {
          return actionsContainer;
        } else {
          // Create new .gh-header-actions container
          const headerRow = headerShow.querySelector('.d-flex.flex-column.flex-md-row, .d-flex.flex-column.flex-md-row.flex-items-start');
          if (headerRow) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'gh-header-actions mt-0 mt-md-1 mb-2 mb-md-0 flex-shrink-0 d-flex';
            headerRow.appendChild(actionsContainer);
            return actionsContainer;
          }
        }
      }
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

    // Update all export buttons - just change the text, not the whole button
    const buttons = document.querySelectorAll('[id^="github-markdown-export-btn"]:not([id$="-dropdown"])');
    const originalTexts = [];

    buttons.forEach((button, index) => {
      const textElement = button.querySelector('[data-component="text"]');
      const iconElement = button.querySelector('[data-component="leadingVisual"] svg');
      if (textElement) {
        // Capture original text before changing it
        originalTexts[index] = textElement.textContent;
        textElement.textContent = 'Exporting...';
      }
      // Add spinning animation to icon
      if (iconElement) {
        iconElement.innerHTML = `
          <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
        `;
        iconElement.style.animation = 'spin 1s linear infinite';
      }
      button.disabled = true;
    });

    // Keep dropdown buttons enabled
    const dropdownButtons = document.querySelectorAll('[id$="-dropdown"]');
    dropdownButtons.forEach(btn => {
      btn.disabled = false;
    });

    try {
      const data = await this.fetchGitHubData(pageInfo);
      const markdown = this.convertToMarkdown(data);
      await this.copyToClipboard(markdown);

      // Success feedback - change icon and text
      buttons.forEach((button, index) => {
        const textElement = button.querySelector('[data-component="text"]');
        const iconElement = button.querySelector('[data-component="leadingVisual"] svg');
        if (textElement) {
          textElement.textContent = 'Copied!';
        }
        if (iconElement) {
          iconElement.innerHTML = `
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
          `;
          iconElement.style.animation = '';
        }
        setTimeout(() => {
          if (textElement) {
            // Always restore to the correct original text
            textElement.textContent = 'Copy to Markdown';
          }
          if (iconElement) {
            // Restore original copy icon
            iconElement.innerHTML = `
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            `;
          }
          button.disabled = false;
          if (index === buttons.length - 1) {
            this.isProcessing = false;
          }
        }, 2000);
      });

    } catch (error) {
      console.error('Export failed:', error);

      // Error feedback - change icon and text
      buttons.forEach((button, index) => {
        const textElement = button.querySelector('[data-component="text"]');
        const iconElement = button.querySelector('[data-component="leadingVisual"] svg');
        if (textElement) {
          textElement.textContent = 'Failed';
        }
        if (iconElement) {
          iconElement.innerHTML = `
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
          `;
          iconElement.style.animation = '';
        }
        setTimeout(() => {
          if (textElement) {
            // Always restore to the correct original text
            textElement.textContent = 'Copy to Markdown';
          }
          if (iconElement) {
            // Restore original copy icon
            iconElement.innerHTML = `
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            `;
          }
          button.disabled = false;
          if (index === buttons.length - 1) {
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

    // For pull requests, also fetch diff information
    let diffContent = '';
    if (pageInfo.displayType === 'pull') {
      try {
        console.log('GitHub Markdown Exporter: Fetching pull request diff...');
        const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
        const diffResponse = await fetch(diffUrl, {
          headers: {
            ...headers,
            'Accept': 'application/vnd.github.v3.diff'
          }
        });
        if (diffResponse.ok) {
          diffContent = await diffResponse.text();
          console.log(`GitHub Markdown Exporter: Successfully fetched diff (${diffContent.length} characters)`);
        } else {
          console.warn(`GitHub Markdown Exporter: Could not fetch diff: ${diffResponse.status}`);
        }
      } catch (error) {
        console.warn('GitHub Markdown Exporter: Error fetching diff:', error);
      }
    }

    return {
      issue: mainData,
      comments: comments,
      diff: diffContent,
      metadata: {
        total_comments: comments.length,
        fetched_at: new Date().toISOString().split('T')[0],
        issue_number: number,
        repository: `${owner}/${repo}`,
        has_diff: !!diffContent
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
    const { issue, comments, diff } = data;

    // Format date
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

    // Build markdown content
    let markdown = `# [${issue.title}](${issue.html_url})\n\n`;
    markdown += `> state: **${issue.state}** opened by: **${issue.user.login}** on: **${formatDate(issue.created_at)}**\n\n`;
    markdown += `${issue.body || ''}\n\n`;

    // Add diff content for pull requests
    if (diff) {
      markdown += `### Pull Request Diff\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
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

  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the exporter (only once)
if (!window.ghMarkdownExporter) {
  window.ghMarkdownExporter = new GitHubMarkdownExporter();
  console.log('GitHub Markdown Exporter: Initialized');
} else {
  console.log('GitHub Markdown Exporter: Already initialized');
}