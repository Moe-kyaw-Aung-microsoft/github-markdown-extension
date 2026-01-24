/**
 * Issue/PR Export Feature
 * 
 * Adds export button to GitHub issue and pull request pages.
 */

import features from '../helpers/feature-manager';
import observe from '../helpers/selector-observer';
import * as pageDetect from '../helpers/page-detect';
import * as selectors from '../helpers/selectors';
import { isHidden, copyToClipboard, showNotification, downloadFile } from '../helpers/dom-utils';
import { fetchGitHubData } from '../helpers/api';
import { convertToMarkdown } from '../helpers/markdown-converter';
import { getEnabledAIProviders, getProviderIcon, type AIProviderConfig } from '../helpers/ai-providers';
import {
  createExportButtonGroup,
  updateButtonState,
  resetButtonAfterDelay,
  MENU_ICONS,
  type MenuAction,
} from './export-button';

let isProcessing = false;
let buttonCounter = 0;
let cachedEnabledProviders: AIProviderConfig[] | null = null;

/**
 * Find all button containers for the current page type
 */
function findButtonContainers(): Element[] {
  const containers: Element[] = [];

  if (pageDetect.isIssue()) {
    // Issue pages use the new responsive header design
    for (const selector of [...selectors.issueActionsDesktop, ...selectors.issueActionsMobile]) {
      const container = document.querySelector(selector);
      if (container && !containers.includes(container)) {
        containers.push(container);
      }
    }
  } else if (pageDetect.isPR() || pageDetect.isDiscussion()) {
    // PRs and discussions use .gh-header-actions
    const container = document.querySelector(selectors.prActionsContainer);
    if (container) {
      containers.push(container);
    }
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
      '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m',
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element && !containers.includes(element)) {
        containers.push(element);
        console.log(`[IssueExport] Found fallback container: ${selector}`);
      }
    }
  }

  // Last resort: Create our own container
  if (containers.length === 0) {
    const createdContainer = createButtonContainer();
    if (createdContainer) {
      containers.push(createdContainer);
    }
  }

  return containers;
}

/**
 * Create a button container if none found
 */
function createButtonContainer(): Element | null {
  const isIssue = pageDetect.isIssue();
  const isDiscussion = pageDetect.isDiscussion();
  const isPR = pageDetect.isPR();

  console.log(`[IssueExport] Creating container for page type - Issue: ${isIssue}, Discussion: ${isDiscussion}, PR: ${isPR}`);

  if (isIssue) {
    // Strategy for Issues: Create in context area or main header
    const contextArea = document.querySelector('.prc-PageHeader-ContextArea-6ykSJ, .HeaderViewer-module__headerContainer--kkVCB');
    if (contextArea) {
      console.log('[IssueExport] Creating issue container in context area');
      const container = document.createElement('div');
      container.className = 'HeaderMenu-module__menuActionsContainer--custom rgh-created-container';
      container.style.cssText = 'display: flex; gap: 0; align-items: center; margin-left: 8px;';

      const existingActions = contextArea.querySelector('.prc-PageHeader-ContextAreaActions-RTJRk, .HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m');
      if (existingActions) {
        existingActions.appendChild(container);
      } else {
        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'prc-PageHeader-ContextAreaActions-RTJRk';
        actionsWrapper.appendChild(container);
        contextArea.appendChild(actionsWrapper);
      }
      return container;
    }
  } else if (isDiscussion || isPR) {
    // Strategy for Discussions/PRs: Create in gh-header-actions area
    const headerShow = document.querySelector('.gh-header-show');
    if (headerShow) {
      console.log('[IssueExport] Creating discussion/PR container in gh-header-actions');

      let actionsContainer = headerShow.querySelector('.gh-header-actions');
      if (actionsContainer) {
        return actionsContainer;
      }

      const headerRow = headerShow.querySelector('.d-flex.flex-column.flex-md-row, .d-flex.flex-column.flex-md-row.flex-items-start');
      if (headerRow) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'gh-header-actions mt-0 mt-md-1 mb-2 mb-md-0 flex-shrink-0 d-flex rgh-created-container';
        headerRow.appendChild(actionsContainer);
        return actionsContainer;
      }
    }
  }

  // Try finding a title and create container nearby
  const titleSelectors = [
    'h1[data-component="PH_Title"]',
    'h1[class*="prc-PageHeader-Title"]',
    'h1.gh-header-title',
    '.js-issue-title',
    '[data-testid="issue-title"]',
  ];

  for (const selector of titleSelectors) {
    const title = document.querySelector(selector);
    if (title) {
      console.log(`[IssueExport] Creating container near title: ${selector}`);

      let headerContainer: Element | null = title.closest('[class*="HeaderViewer"], [class*="prc-PageHeader"], .gh-header');
      if (!headerContainer) {
        headerContainer = title.closest('.d-flex');
      }
      if (!headerContainer) {
        headerContainer = title.parentElement;
      }

      if (headerContainer) {
        const container = document.createElement('div');
        container.className = 'HeaderMenu-module__menuActionsContainer--custom rgh-created-container';
        container.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-left: auto; margin-right: 0;';
        headerContainer.appendChild(container);
        return container;
      }
    }
  }

  console.warn('[IssueExport] Could not find suitable location for button container');
  return null;
}

/**
 * Add export button to a container
 */
async function addExportButton(container: Element): Promise<void> {
  const pageInfo = pageDetect.getPageInfo();
  if (!pageInfo || pageInfo.type === 'wiki') return;

  // Skip if already has our button
  if (container.querySelector(`[id^="${selectors.EXTENSION_PREFIX}-btn"]`)) {
    return;
  }

  // Skip hidden containers (but allow mobile ones)
  const isMobileContainer = container.getAttribute('data-hidden-regular') === 'true';
  if (isHidden(container) && !isMobileContainer && !pageDetect.isIssue()) {
    return;
  }

  const buttonId = `${selectors.EXTENSION_PREFIX}-btn-${buttonCounter++}`;
  const isPR = pageDetect.isPR();
  const isIssue = pageDetect.isIssue();
  const isDiscussion = pageDetect.isDiscussion();

  // Load enabled AI providers (cache for performance)
  if (!cachedEnabledProviders) {
    cachedEnabledProviders = await getEnabledAIProviders();
  }

  // Build menu actions dynamically based on enabled providers
  const menuActions: MenuAction[] = [
    {
      icon: MENU_ICONS.download,
      text: 'Save as File',
      action: () => downloadAsFile(pageInfo),
    },
  ];

  // Add enabled AI providers
  for (const provider of cachedEnabledProviders) {
    menuActions.push({
      icon: getProviderIcon(provider.id),
      text: `Open in ${provider.name}`,
      action: () => openInAI(pageInfo, provider.id),
      isExternal: true,
    });
  }

  const buttonGroup = createExportButtonGroup({
    id: buttonId,
    mainButtonText: 'Copy to Markdown',
    onMainClick: () => exportToClipboard(pageInfo, buttonId),
    menuActions,
    isPR,
    isIssue,
    isDiscussion,
  });

  // Insert button in appropriate position
  insertButton(container, buttonGroup, isIssue, isPR);

  console.log(`[IssueExport] Added button to container`);
}

/**
 * Insert button in the right position based on page type
 */
function insertButton(
  container: Element,
  buttonGroup: HTMLElement,
  isIssue: boolean,
  isPR: boolean
): void {
  if (isIssue) {
    // For issues: place after "New issue" button
    const newIssueContainer = container.querySelector(selectors.newIssueButtonContainer);
    const newIssueButton = container.querySelector(selectors.newIssueButton);

    if (newIssueContainer?.nextElementSibling) {
      container.insertBefore(buttonGroup, newIssueContainer.nextElementSibling);
    } else if (newIssueButton?.nextElementSibling) {
      container.insertBefore(buttonGroup, newIssueButton.nextElementSibling);
    } else if (container.firstChild) {
      container.insertBefore(buttonGroup, container.firstChild);
    } else {
      container.appendChild(buttonGroup);
    }
  } else if (isPR) {
    // For PRs: place after Code button container (which contains get-repo element)
    // Structure: empty div, Edit button, Code container (div.flex-md-order-2 with get-repo), our button, jump to bottom
    const codeButtonContainer = container.querySelector('.flex-md-order-2:has(get-repo)') ||
      container.querySelector('div.flex-md-order-2');
    const jumpToBottom = container.querySelector('.flex-auto.text-right, a[href="#issue-comment-box"]');

    if (jumpToBottom) {
      // Insert before jump to bottom link
      jumpToBottom.insertAdjacentElement('beforebegin', buttonGroup);
    } else if (codeButtonContainer) {
      // Insert after Code button container
      codeButtonContainer.insertAdjacentElement('afterend', buttonGroup);
    } else {
      // Last fallback: append to container
      container.appendChild(buttonGroup);
    }
  } else {
    // For discussions: append at end
    container.appendChild(buttonGroup);
  }
}

/**
 * Export content to clipboard
 */
async function exportToClipboard(
  pageInfo: NonNullable<ReturnType<typeof pageDetect.getPageInfo>>,
  _buttonId: string
): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  const isPR = pageInfo.displayType === 'pull';

  // Update all buttons with this feature
  const allButtons = document.querySelectorAll(`[id^="${selectors.EXTENSION_PREFIX}-btn"]:not([id$="-dropdown"]):not([id$="-menu"]):not([id$="-group"])`);
  allButtons.forEach(btn => {
    updateButtonState(btn.id, 'loading');
  });

  try {
    const data = await fetchGitHubData(
      pageInfo.owner,
      pageInfo.repo,
      pageInfo.type as 'issues' | 'discussions',
      pageInfo.number!,
      pageInfo.displayType as 'issue' | 'pull' | 'discussion'
    );
    // Include diff by default for PRs
    const markdown = convertToMarkdown(data, { includeDiff: isPR });
    await copyToClipboard(markdown);

    allButtons.forEach(btn => {
      updateButtonState(btn.id, 'success');
      resetButtonAfterDelay(btn.id, 'Copy to Markdown');
    });
  } catch (error) {
    console.error('[IssueExport] Export failed:', error);

    allButtons.forEach(btn => {
      updateButtonState(btn.id, 'error');
      resetButtonAfterDelay(btn.id, 'Copy to Markdown', 3000);
    });

    showNotification(`Export failed: ${(error as Error).message}`, 'error');
  } finally {
    isProcessing = false;
  }
}

/**
 * Download content as file
 */
async function downloadAsFile(
  pageInfo: NonNullable<ReturnType<typeof pageDetect.getPageInfo>>
): Promise<void> {
  try {
    const isPR = pageInfo.displayType === 'pull';
    const data = await fetchGitHubData(
      pageInfo.owner,
      pageInfo.repo,
      pageInfo.type as 'issues' | 'discussions',
      pageInfo.number!,
      pageInfo.displayType as 'issue' | 'pull' | 'discussion'
    );
    // Include diff by default for PRs
    const markdown = convertToMarkdown(data, { includeDiff: isPR });
    const filename = `${pageInfo.owner}-${pageInfo.repo}-${pageInfo.type}-${pageInfo.number}.md`;

    downloadFile(markdown, filename);
    showNotification('Downloaded successfully!', 'success');
  } catch (error) {
    showNotification(`Download failed: ${(error as Error).message}`, 'error');
  }
}

/**
 * Open content in AI chat
 */
async function openInAI(
  pageInfo: NonNullable<ReturnType<typeof pageDetect.getPageInfo>>,
  providerId: string
): Promise<void> {
  try {
    // Get provider config
    const providers = cachedEnabledProviders || await getEnabledAIProviders();
    const provider = providers.find(p => p.id === providerId);

    if (!provider) {
      showNotification(`Unknown AI provider: ${providerId}`, 'error');
      return;
    }

    const isPR = pageInfo.displayType === 'pull';
    const data = await fetchGitHubData(
      pageInfo.owner,
      pageInfo.repo,
      pageInfo.type as 'issues' | 'discussions',
      pageInfo.number!,
      pageInfo.displayType as 'issue' | 'pull' | 'discussion'
    );
    // Include diff by default for PRs
    const markdown = convertToMarkdown(data, { includeDiff: isPR });

    const typeLabel = isPR ? 'pull request' : pageInfo.displayType;
    const prompt = `Please analyze this ${typeLabel} from GitHub:\n\n${markdown}`;
    const encodedPrompt = encodeURIComponent(prompt);

    // Use the provider's URL template
    const url = provider.urlTemplate.replace('{prompt}', encodedPrompt);
    window.open(url, '_blank');
  } catch (error) {
    showNotification(`Failed to open in AI: ${(error as Error).message}`, 'error');
  }
}

/**
 * Initialize the feature
 */
function init(signal: AbortSignal): void {
  // Reset counter on each navigation
  buttonCounter = 0;

  console.log('[IssueExport] Feature initializing...');

  // Function to add buttons with retry logic
  const addButtonsWithRetry = () => {
    const containers = findButtonContainers();
    if (containers.length > 0) {
      console.log(`[IssueExport] Found ${containers.length} containers`);
      for (const container of containers) {
        addExportButton(container);
      }
      return true;
    }
    return false;
  };

  // Try immediately
  if (addButtonsWithRetry()) {
    console.log('[IssueExport] Buttons added immediately');
  } else {
    // Retry with increasing delays
    let attempts = 0;
    const maxAttempts = 10;

    const retry = () => {
      if (signal.aborted) return;
      attempts++;

      if (addButtonsWithRetry()) {
        console.log(`[IssueExport] Buttons added after ${attempts} attempts`);
      } else if (attempts < maxAttempts) {
        setTimeout(retry, 500);
      } else {
        console.log('[IssueExport] Max attempts reached, setting up observer fallback');
        // Fall back to observer for dynamically added elements
        const allSelectors = [
          ...selectors.issueActionsDesktop,
          ...selectors.issueActionsMobile,
          selectors.prActionsContainer,
        ];

        for (const selector of allSelectors) {
          observe(selector, addExportButton, { signal });
        }
      }
    };

    setTimeout(retry, 300);
  }

  // Also watch for container changes via mutation observer as backup
  const allSelectors = [
    ...selectors.issueActionsDesktop,
    ...selectors.issueActionsMobile,
    selectors.prActionsContainer,
  ];

  for (const selector of allSelectors) {
    observe(selector, addExportButton, { signal, processExisting: false });
  }

  console.log('[IssueExport] Feature initialized');
}

// Register the feature
features.add('issue-export', {
  include: [pageDetect.isIssue, pageDetect.isPR, pageDetect.isDiscussion],
  init,
});
