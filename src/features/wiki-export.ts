/**
 * Wiki Export Feature
 * 
 * Adds export button to GitHub wiki pages.
 */

import features from '../helpers/feature-manager';
import observe from '../helpers/selector-observer';
import * as pageDetect from '../helpers/page-detect';
import * as selectors from '../helpers/selectors';
import { copyToClipboard, showNotification, downloadFile, div } from '../helpers/dom-utils';
import { htmlToMarkdown } from '../helpers/markdown-converter';
import { getEnabledAIProviders, getProviderIcon, type AIProviderConfig } from '../helpers/ai-providers';
import {
  createExportButtonGroup,
  updateButtonState,
  resetButtonAfterDelay,
  MENU_ICONS,
  type MenuAction,
} from './export-button';

let isProcessing = false;
let cachedEnabledProviders: AIProviderConfig[] | null = null;

interface WikiPageInfo {
  owner: string;
  repo: string;
  pageName: string;
}

/**
 * Get wiki page content from the DOM
 */
function getWikiContent(): { title: string; markdown: string } | null {
  const pageInfo = pageDetect.getPageInfo();
  if (!pageInfo || pageInfo.displayType !== 'wiki') return null;

  const wikiBody = selectors.selectFirst(['.markdown-body', '.wiki-body']);
  if (!wikiBody) return null;

  const titleElement = selectors.selectFirst(selectors.wikiTitle);
  const title = titleElement?.textContent?.trim() || pageInfo.pageName || 'Wiki Page';

  const markdown = htmlToMarkdown(wikiBody.innerHTML, title, {
    owner: pageInfo.owner,
    repo: pageInfo.repo,
  });

  return { title, markdown };
}

/**
 * Find or create wiki button container
 */
function findWikiButtonContainer(): Element | null {
  // First check if we already created a container
  const existingCreated = document.querySelector('.rgh-wiki-actions, .rgh-wiki-actions-inline');
  if (existingCreated) return existingCreated;

  // Try existing containers
  let container = selectors.selectFirst(selectors.wikiHeader);
  if (container) return container;

  // Try sidebar
  container = selectors.selectFirst(selectors.wikiSidebar);
  if (container) {
    // Create a wrapper in the sidebar
    const wrapper = div({ class: 'rgh-wiki-actions' });
    container.insertBefore(wrapper, container.firstChild);
    return wrapper;
  }

  // Create container near wiki content
  const wikiContent = selectors.selectFirst(selectors.wikiContent);
  if (wikiContent?.parentNode) {
    const wrapper = div({ class: 'rgh-wiki-actions-inline' });
    wikiContent.parentNode.insertBefore(wrapper, wikiContent);
    return wrapper;
  }

  return null;
}

/**
 * Lock to prevent multiple button additions
 */
let isAddingButton = false;

/**
 * Add export button to wiki page
 */
async function addWikiExportButton(): Promise<void> {
  // Prevent concurrent additions
  if (isAddingButton) return;

  const pageInfo = pageDetect.getPageInfo();
  if (!pageInfo || pageInfo.displayType !== 'wiki') return;

  // Skip if already has our button
  if (document.querySelector(`[id^="${selectors.EXTENSION_PREFIX}-btn"]`)) {
    return;
  }

  // Set lock
  isAddingButton = true;

  try {
    const container = findWikiButtonContainer();
    if (!container) {
      console.warn('[WikiExport] Could not find wiki button container');
      return;
    }

    // Double-check after potential async container creation
    if (document.querySelector(`[id^="${selectors.EXTENSION_PREFIX}-btn"]`)) {
      return;
    }

    const buttonId = `${selectors.EXTENSION_PREFIX}-btn-wiki`;
    const wikiInfo: WikiPageInfo = {
      owner: pageInfo.owner,
      repo: pageInfo.repo,
      pageName: pageInfo.pageName!,
    };

    // Load enabled AI providers (cache for performance)
    if (!cachedEnabledProviders) {
      cachedEnabledProviders = await getEnabledAIProviders();
    }

    const menuActions: MenuAction[] = [
      {
        icon: MENU_ICONS.download,
        text: 'Save Current Page',
        action: () => downloadWikiPage(wikiInfo),
      },
      {
        icon: MENU_ICONS.wiki,
        text: 'Download Entire Wiki',
        action: () => downloadEntireWiki(wikiInfo),
      },
    ];

    // Add enabled AI providers
    for (const provider of cachedEnabledProviders) {
      menuActions.push({
        icon: getProviderIcon(provider.id),
        text: `Open in ${provider.name}`,
        action: () => openWikiInAI(wikiInfo, provider.id),
        isExternal: true,
      });
    }

    const buttonGroup = createExportButtonGroup({
      id: buttonId,
      mainButtonText: 'Copy Page',
      onMainClick: () => copyWikiPage(buttonId),
      menuActions,
    });

    container.appendChild(buttonGroup);
    console.log('[WikiExport] Added button to wiki page');
  } finally {
    isAddingButton = false;
  }
}

/**
 * Copy wiki page to clipboard
 */
async function copyWikiPage(buttonId: string): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  updateButtonState(buttonId, 'loading', 'Exporting...');

  try {
    const content = getWikiContent();
    if (!content) throw new Error('Could not find wiki content');

    await copyToClipboard(content.markdown);

    updateButtonState(buttonId, 'success', 'Copied!');
    showNotification('Wiki page copied to clipboard!', 'success');
    resetButtonAfterDelay(buttonId, 'Copy Page');
  } catch (error) {
    console.error('[WikiExport] Export failed:', error);
    updateButtonState(buttonId, 'error', 'Failed');
    showNotification(`Export failed: ${(error as Error).message}`, 'error');
    resetButtonAfterDelay(buttonId, 'Copy Page', 3000);
  } finally {
    isProcessing = false;
  }
}

/**
 * Download wiki page as file
 */
async function downloadWikiPage(wikiInfo: WikiPageInfo): Promise<void> {
  try {
    const content = getWikiContent();
    if (!content) throw new Error('Could not find wiki content');

    const filename = `${wikiInfo.owner}-${wikiInfo.repo}-wiki-${wikiInfo.pageName.replace(/\//g, '-')}.md`;
    downloadFile(content.markdown, filename);
    showNotification('Wiki page downloaded!', 'success');
  } catch (error) {
    showNotification(`Download failed: ${(error as Error).message}`, 'error');
  }
}

/**
 * Collect all wiki page slugs from the _pages endpoint
 */
async function collectWikiPageSlugs(wikiInfo: WikiPageInfo): Promise<Array<{ slug: string; title: string }>> {
  const pages: Array<{ slug: string; title: string }> = [];

  try {
    // First try the _pages endpoint
    const pagesUrl = `https://github.com/${wikiInfo.owner}/${wikiInfo.repo}/wiki/_pages`;
    const response = await fetch(pagesUrl);

    if (response.ok && response.url.includes('/wiki/')) {
      const html = await response.text();

      // Parse page links from the _pages HTML
      const linkPattern = new RegExp(
        `<a\\s+href="/${wikiInfo.owner}/${wikiInfo.repo}/wiki/([^"_][^"]*)"[^>]*>([^<]+)</a>`,
        'gi'
      );

      let match;
      const seen = new Set<string>();

      while ((match = linkPattern.exec(html)) !== null) {
        const slug = decodeURIComponent(match[1]);
        const title = match[2].trim();
        if (!seen.has(slug) && !slug.startsWith('_') && !slug.includes('#')) {
          seen.add(slug);
          pages.push({ slug, title });
        }
      }
    }

    // Fallback to sidebar scraping if _pages didn't work
    if (pages.length === 0) {
      const allSelectors = selectors.wikiPageLinks.join(', ');
      const wikiLinks = document.querySelectorAll(allSelectors);

      wikiLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/wiki')) {
          const match = href.match(/\/wiki\/([^?#_]+)/);
          if (match) {
            const slug = decodeURIComponent(match[1]);
            const title = link.textContent?.trim() || slug.replace(/-/g, ' ');
            pages.push({ slug, title });
          }
        }
      });

      // Always include current page
      if (wikiInfo.pageName && !pages.find(p => p.slug === wikiInfo.pageName)) {
        pages.push({ slug: wikiInfo.pageName, title: wikiInfo.pageName.replace(/-/g, ' ') });
      }
    }
  } catch {
    // Fallback to just current page
    if (wikiInfo.pageName) {
      pages.push({ slug: wikiInfo.pageName, title: wikiInfo.pageName.replace(/-/g, ' ') });
    }
  }

  // Always ensure Home page is included
  if (!pages.find(p => p.slug === 'Home')) {
    pages.unshift({ slug: 'Home', title: 'Home' });
  }

  return pages;
}

/**
 * Fetch wiki page content by slug from raw.githubusercontent.com
 */
async function fetchWikiPageBySlug(pageSlug: string, wikiInfo: WikiPageInfo): Promise<{ title: string; content: string } | null> {
  try {
    // Try fetching raw markdown from raw.githubusercontent.com
    const rawUrl = `https://raw.githubusercontent.com/wiki/${wikiInfo.owner}/${wikiInfo.repo}/${pageSlug}.md`;
    const response = await fetch(rawUrl);

    if (response.ok) {
      const content = await response.text();
      const title = pageSlug.replace(/-/g, ' ');
      return { title, content };
    }

    // Try .markdown extension
    const altUrl = `https://raw.githubusercontent.com/wiki/${wikiInfo.owner}/${wikiInfo.repo}/${pageSlug}.markdown`;
    const altResponse = await fetch(altUrl);

    if (altResponse.ok) {
      const content = await altResponse.text();
      const title = pageSlug.replace(/-/g, ' ');
      return { title, content };
    }

    // Fallback to HTML scraping
    const fullUrl = `https://github.com/${wikiInfo.owner}/${wikiInfo.repo}/wiki/${pageSlug}`;
    const htmlResponse = await fetch(fullUrl);

    if (!htmlResponse.ok) return null;

    const html = await htmlResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const wikiBody = doc.querySelector('.markdown-body, .wiki-body');
    const titleEl = doc.querySelector('#wiki-wrapper h1, .gh-header-title, .wiki-title');

    if (!wikiBody) return null;

    const title = titleEl?.textContent?.trim() || pageSlug.replace(/-/g, ' ');
    const content = htmlToMarkdown(wikiBody.innerHTML, title, wikiInfo);

    return { title, content };
  } catch {
    return null;
  }
}

/**
 * Fetch wiki page content from URL (legacy function for compatibility)
 */
async function fetchWikiPageFromUrl(url: string, wikiInfo: WikiPageInfo): Promise<{ title: string; content: string } | null> {
  // Extract page slug from URL
  const wikiMatch = url.match(/\/wiki\/([^?#]+)/);
  if (!wikiMatch) return null;

  const pageSlug = decodeURIComponent(wikiMatch[1]);
  return fetchWikiPageBySlug(pageSlug, wikiInfo);
}

/**
 * Download entire wiki as single markdown file
 */
async function downloadEntireWiki(wikiInfo: WikiPageInfo): Promise<void> {
  showNotification('Fetching all wiki pages...', 'success');

  try {
    const pageSlugs = await collectWikiPageSlugs(wikiInfo);
    const pages: { title: string; content: string }[] = [];

    // Fetch current page from DOM first
    const currentContent = getWikiContent();
    if (currentContent) {
      pages.push({ title: currentContent.title, content: currentContent.markdown });
    }

    // Fetch other pages using their slugs
    for (const { slug, title } of pageSlugs) {
      // Skip current page if already added
      if (slug === wikiInfo.pageName) continue;

      const page = await fetchWikiPageBySlug(slug, wikiInfo);
      if (page) {
        pages.push(page);
      } else {
        // If fetch failed, at least add a placeholder
        console.warn(`[WikiExport] Failed to fetch page: ${slug}`);
      }
    }

    if (pages.length === 0) {
      throw new Error('No wiki pages found');
    }

    // Build combined markdown
    let combined = `# ${wikiInfo.owner}/${wikiInfo.repo} - Wiki Documentation\n\n`;
    combined += `> Exported on: ${new Date().toLocaleDateString()}\n\n`;
    combined += `## Table of Contents\n\n`;

    pages.forEach((page, i) => {
      combined += `${i + 1}. [${page.title}](#${page.title.toLowerCase().replace(/\s+/g, '-')})\n`;
    });

    combined += '\n---\n\n';

    for (const page of pages) {
      combined += `## ${page.title}\n\n`;
      combined += page.content + '\n\n---\n\n';
    }

    const filename = `${wikiInfo.owner}-${wikiInfo.repo}-wiki-complete.md`;
    downloadFile(combined, filename);
    showNotification(`Downloaded ${pages.length} wiki pages!`, 'success');
  } catch (error) {
    console.error('[WikiExport] Download entire wiki failed:', error);
    showNotification(`Download failed: ${(error as Error).message}`, 'error');
  }
}

/**
 * Open wiki in AI chat
 */
async function openWikiInAI(_wikiInfo: WikiPageInfo, providerId: string): Promise<void> {
  try {
    // Get provider config
    const providers = cachedEnabledProviders || await getEnabledAIProviders();
    const provider = providers.find(p => p.id === providerId);

    if (!provider) {
      showNotification(`Unknown AI provider: ${providerId}`, 'error');
      return;
    }

    const content = getWikiContent();
    if (!content) throw new Error('Could not find wiki content');

    const prompt = `Please analyze this wiki documentation from GitHub:\n\n${content.markdown}`;
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
  // Try to add button immediately if container exists
  const container = findWikiButtonContainer();
  if (container) {
    addWikiExportButton();
  }

  // Also observe for dynamic content
  for (const selector of [...selectors.wikiHeader, ...selectors.wikiSidebar]) {
    observe(selector, () => addWikiExportButton(), { signal });
  }

  console.log('[WikiExport] Feature initialized');
}

// Register the feature
features.add('wiki-export', {
  include: [pageDetect.isWiki],
  init,
});
