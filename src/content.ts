/**
 * Content Script Entry Point
 * 
 * Main entry point that imports and initializes all features.
 */

// Import styles
import './styles/content.css';

// Import helpers
import * as pageDetect from './helpers/page-detect';
import * as selectors from './helpers/selectors';
import { fetchGitHubData } from './helpers/api';
import { convertToMarkdown, convertToJSON, convertToHTML, htmlToMarkdown } from './helpers/markdown-converter';
import { downloadFile } from './helpers/dom-utils';

// Import feature manager (must be before features)
import './helpers/feature-manager';

// Import features - they self-register with the feature manager
import './features/issue-export';
import './features/wiki-export';

// ============================================================================
// Theme Detection for Icon
// ============================================================================

function detectAndSendTheme(): void {
  // Check GitHub's data-color-mode attribute
  const html = document.documentElement;
  const colorMode = html.getAttribute('data-color-mode');

  let scheme: 'light' | 'dark' = 'light';

  if (colorMode === 'dark') {
    scheme = 'dark';
  } else if (colorMode === 'auto') {
    // Check system preference
    scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    // Check data-dark-theme attribute as fallback
    const darkTheme = html.getAttribute('data-dark-theme');
    if (darkTheme && darkTheme !== 'light') {
      // If we're in dark mode
      if (document.body?.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches) {
        scheme = 'dark';
      }
    }
  }

  // Send to background
  chrome.runtime.sendMessage({ scheme }).catch(() => {
    // Extension context may be invalidated, ignore
  });
}

// Detect theme on load
detectAndSendTheme();

// Re-detect on theme changes
const themeObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.attributeName === 'data-color-mode' ||
      mutation.attributeName === 'data-dark-theme' ||
      mutation.attributeName === 'data-light-theme') {
      detectAndSendTheme();
      break;
    }
  }
});

themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-color-mode', 'data-dark-theme', 'data-light-theme'],
});

// Also listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectAndSendTheme);

// ============================================================================
// Message Handler for Popup Communication
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'triggerExport') {
    // Find and click the export button
    const exportBtn = document.querySelector('[id^="github-markdown-export-btn"]:not([id$="-dropdown"]):not([id$="-menu"]):not([id$="-group"])') as HTMLButtonElement | null;

    if (exportBtn) {
      exportBtn.click();
      sendResponse({ success: true, message: 'Export triggered' });
    } else {
      sendResponse({ success: false, message: 'Export button not found on this page' });
    }
    return true;
  }

  if (request.action === 'export') {
    // Handle export from popup with destination support
    const options = request.options || {};
    const destination = options.destination || 'clipboard';
    const format = options.format || 'markdown';

    // Get page info first
    const pageInfo = pageDetect.getPageInfo();
    if (!pageInfo) {
      sendResponse({ success: false, error: 'Not on an exportable page' });
      return true;
    }

    // Get file extension based on format
    const getExtension = () => {
      switch (format) {
        case 'json': return '.json';
        case 'html': return '.html';
        default: return '.md';
      }
    };

    // Helper to handle the content based on destination
    const handleContent = (content: string, baseFilename: string) => {
      const filename = baseFilename.replace(/\.[^.]+$/, '') + getExtension();
      if (destination === 'clipboard') {
        // Return content to popup - let popup copy to clipboard since it has focus
        sendResponse({ success: true, markdown: content, filename });
      } else {
        downloadFile(content, filename);
        sendResponse({ success: true });
      }
    };

    // Handle wiki pages using DOM extraction
    if (pageInfo.displayType === 'wiki') {
      const wikiScope = options.wikiScope || 'page';

      // Helper function to convert markdown to the target format
      const formatWikiContent = (markdown: string, title: string): string => {
        switch (format) {
          case 'json':
            return JSON.stringify({
              title,
              type: 'wiki',
              url: window.location.href,
              repository: `${pageInfo.owner}/${pageInfo.repo}`,
              exportedAt: new Date().toISOString(),
              content: markdown,
            }, null, 2);
          case 'html':
            // Convert markdown to basic HTML
            const htmlContent = markdown
              .replace(/^# (.+)$/gm, '<h1>$1</h1>')
              .replace(/^## (.+)$/gm, '<h2>$1</h2>')
              .replace(/^### (.+)$/gm, '<h3>$1</h3>')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
              .replace(/`(.+?)`/g, '<code>$1</code>')
              .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
              .replace(/\n\n/g, '</p><p>')
              .replace(/^/g, '<p>')
              .replace(/$/g, '</p>')
              .replace(/<p><h/g, '<h')
              .replace(/<\/h(\d)><\/p>/g, '</h$1>');
            return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
          default:
            return markdown;
        }
      };

      (async () => {
        try {
          if (wikiScope === 'all') {
            // Download entire wiki using _pages endpoint
            const pageSlugs = await collectWikiPageSlugs(pageInfo.owner, pageInfo.repo);
            const pages: { title: string; content: string }[] = [];

            // Fetch current page from DOM first
            const wikiBody = selectors.selectFirst(['.markdown-body', '.wiki-body']);
            if (wikiBody) {
              const titleElement = selectors.selectFirst(selectors.wikiTitle);
              const title = titleElement?.textContent?.trim() || pageInfo.pageName || 'Wiki Page';
              const content = htmlToMarkdown(wikiBody.innerHTML, title, {
                owner: pageInfo.owner,
                repo: pageInfo.repo,
              });
              pages.push({ title, content });
            }

            // Fetch other pages using their slugs
            for (const { slug } of pageSlugs) {
              // Skip current page if already added
              if (slug === pageInfo.pageName) continue;

              const pageUrl = `/${pageInfo.owner}/${pageInfo.repo}/wiki/${slug}`;
              const page = await fetchWikiPageContent(pageUrl, pageInfo.owner, pageInfo.repo);
              if (page) {
                pages.push(page);
              }
            }

            if (pages.length === 0) {
              sendResponse({ success: false, error: 'No wiki pages found' });
              return;
            }

            // Build combined markdown
            let combined = `# ${pageInfo.owner}/${pageInfo.repo} - Wiki Documentation\n\n`;
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

            const formattedContent = formatWikiContent(combined, `${pageInfo.owner}/${pageInfo.repo} Wiki`);
            const filename = `${pageInfo.owner}-${pageInfo.repo}-wiki-complete`;
            handleContent(formattedContent, filename);
          } else {
            // Single page export
            const wikiBody = selectors.selectFirst(['.markdown-body', '.wiki-body']);
            if (!wikiBody) {
              sendResponse({ success: false, error: 'Could not find wiki content' });
              return;
            }

            const titleElement = selectors.selectFirst(selectors.wikiTitle);
            const title = titleElement?.textContent?.trim() || pageInfo.pageName || 'Wiki Page';

            const markdown = htmlToMarkdown(wikiBody.innerHTML, title, {
              owner: pageInfo.owner,
              repo: pageInfo.repo,
            });

            const formattedContent = formatWikiContent(markdown, title);
            const filename = `${pageInfo.repo}-wiki-${(pageInfo.pageName || 'page').replace(/[^a-zA-Z0-9]/g, '-')}`;
            handleContent(formattedContent, filename);
          }
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();
      return true;
    }

    // For issues/PRs/discussions, use API
    if (!pageInfo.number) {
      sendResponse({ success: false, error: 'Not on an exportable page' });
      return true;
    }

    fetchGitHubData(
      pageInfo.owner,
      pageInfo.repo,
      pageInfo.type as 'issues' | 'discussions',
      pageInfo.number,
      pageInfo.displayType
    )
      .then(data => {
        const isPR = pageInfo.displayType === 'pull';
        const converterOptions = {
          includeComments: options.includeComments ?? true,
          includeMetadata: options.includeMetadata ?? true,
          // Default to including diff for PRs
          includeDiff: options.includeDiff ?? isPR,
        };

        let content: string;
        switch (format) {
          case 'json':
            content = convertToJSON(data, converterOptions);
            break;
          case 'html':
            content = convertToHTML(data, converterOptions);
            break;
          default:
            content = convertToMarkdown(data, converterOptions);
        }

        const typeLabel = isPR ? 'pr' : pageInfo.displayType;
        const filename = `${pageInfo.repo}-${typeLabel}-${pageInfo.number}`;
        handleContent(content, filename);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }

  if (request.action === 'getMarkdown') {
    // Get markdown content for AI export
    const pageInfo = pageDetect.getPageInfo();
    const options = request.options || {};

    if (!pageInfo) {
      sendResponse({ success: false, error: 'Not on an exportable page' });
      return true;
    }

    // Handle wiki pages differently - use DOM extraction
    if (pageInfo.displayType === 'wiki') {
      try {
        const wikiBody = selectors.selectFirst(['.markdown-body', '.wiki-body']);
        if (!wikiBody) {
          sendResponse({ success: false, error: 'Could not find wiki content' });
          return true;
        }

        const titleElement = selectors.selectFirst(selectors.wikiTitle);
        const title = titleElement?.textContent?.trim() || pageInfo.pageName || 'Wiki Page';

        const markdown = htmlToMarkdown(wikiBody.innerHTML, title, {
          owner: pageInfo.owner,
          repo: pageInfo.repo,
        });

        sendResponse({ success: true, markdown });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
      return true;
    }

    // For issues/PRs/discussions, use API
    if (!pageInfo.number) {
      sendResponse({ success: false, error: 'Not on an exportable page' });
      return true;
    }

    // Fetch and convert to markdown
    fetchGitHubData(
      pageInfo.owner,
      pageInfo.repo,
      pageInfo.type as 'issues' | 'discussions',
      pageInfo.number,
      pageInfo.displayType
    )
      .then(data => {
        const isPR = pageInfo.displayType === 'pull';
        const markdown = convertToMarkdown(data, {
          includeComments: options.includeComments ?? true,
          includeMetadata: options.includeMetadata ?? true,
          // Default to including diff for PRs
          includeDiff: options.includeDiff ?? isPR,
        });
        sendResponse({ success: true, markdown });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }

  if (request.action === 'bulkExport') {
    const options = request.options || {};

    // Handle wiki bulk export
    if (options.type === 'wiki') {
      handleWikiBulkExport(options)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    // Handle issues/PRs/discussions bulk export
    if (['issues', 'pulls', 'discussions'].includes(options.type)) {
      handleItemsBulkExport(options)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    // Unknown type
    sendResponse({ success: false, error: 'Unknown export type' });
    return true;
  }

  return true; // Keep message channel open for async response
});

// ============================================================================
// Helper Functions for Wiki Export
// ============================================================================

/**
 * Collect all wiki page slugs from the _pages endpoint
 * This is more reliable than scraping the sidebar
 */
async function collectWikiPageSlugs(owner: string, repo: string): Promise<Array<{ slug: string; title: string }>> {
  const pages: Array<{ slug: string; title: string }> = [];

  try {
    // Fetch the _pages endpoint which lists all wiki pages
    const pagesUrl = `https://github.com/${owner}/${repo}/wiki/_pages`;
    const response = await fetch(pagesUrl, { redirect: 'follow' });

    if (response.ok && response.url.includes('/wiki/')) {
      const html = await response.text();

      // Parse page links from the _pages HTML
      const linkPattern = new RegExp(
        `<a\\s+href="/${owner}/${repo}/wiki/([^"_][^"]*)"[^>]*>([^<]+)</a>`,
        'gi'
      );

      let match;
      const seen = new Set<string>();

      while ((match = linkPattern.exec(html)) !== null) {
        const slug = decodeURIComponent(match[1]);
        const title = match[2].trim();
        if (!seen.has(slug) && !slug.startsWith('_') && !slug.includes('#') && !slug.includes('?')) {
          seen.add(slug);
          pages.push({ slug, title });
        }
      }
    }

    // Fallback to sidebar scraping if _pages didn't work
    if (pages.length === 0) {
      const wikiLinks = document.querySelectorAll(selectors.wikiPageLinks.join(', '));
      const seen = new Set<string>();

      wikiLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/wiki')) {
          const match = href.match(/\/wiki\/([^?#_]+)/);
          if (match) {
            const slug = decodeURIComponent(match[1]);
            if (!seen.has(slug)) {
              seen.add(slug);
              const title = link.textContent?.trim() || slug.replace(/-/g, ' ');
              pages.push({ slug, title });
            }
          }
        }
      });
    }
  } catch {
    // Silent fail - will return whatever we have
  }

  // Always ensure Home page is included
  if (!pages.find(p => p.slug === 'Home')) {
    pages.unshift({ slug: 'Home', title: 'Home' });
  }

  return pages;
}

/**
 * Collect all wiki page URLs from the sidebar (legacy - used for compatibility)
 */
function collectWikiPageUrls(): Set<string> {
  const pageUrls = new Set<string>();

  // Add current page
  pageUrls.add(window.location.pathname);

  // Get links from sidebar
  const wikiLinks = document.querySelectorAll(selectors.wikiPageLinks.join(', '));

  wikiLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes('/wiki')) {
      // Filter out edit/history pages
      if (!href.includes('/_')) {
        pageUrls.add(href);
      }
    }
  });

  return pageUrls;
}

/**
 * Fetch a single wiki page content from raw.githubusercontent.com
 * This is more reliable than scraping HTML
 */
async function fetchWikiPageContent(
  url: string,
  owner: string,
  repo: string
): Promise<{ title: string; content: string } | null> {
  try {
    // Extract page slug from URL
    // URL format: https://github.com/owner/repo/wiki/PageName or /owner/repo/wiki/PageName
    const wikiMatch = url.match(/\/wiki\/([^?#]+)/);
    if (!wikiMatch) return null;

    const pageSlug = decodeURIComponent(wikiMatch[1]);

    // Fetch raw markdown from raw.githubusercontent.com
    const rawUrl = `https://raw.githubusercontent.com/wiki/${owner}/${repo}/${pageSlug}.md`;
    const response = await fetch(rawUrl);

    if (!response.ok) {
      // Try without .md extension (some wikis use different extensions)
      const altUrl = `https://raw.githubusercontent.com/wiki/${owner}/${repo}/${pageSlug}.markdown`;
      const altResponse = await fetch(altUrl);

      if (!altResponse.ok) {
        // Fallback to HTML scraping
        return fetchWikiPageFromHtml(url, owner, repo);
      }

      const content = await altResponse.text();
      const title = pageSlug.replace(/-/g, ' ');
      return { title, content };
    }

    const content = await response.text();
    const title = pageSlug.replace(/-/g, ' ');
    return { title, content };
  } catch {
    // Fallback to HTML scraping
    return fetchWikiPageFromHtml(url, owner, repo);
  }
}

/**
 * Fallback: Fetch wiki page content by scraping HTML
 */
async function fetchWikiPageFromHtml(
  url: string,
  owner: string,
  repo: string
): Promise<{ title: string; content: string } | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://github.com${url}`;
    const response = await fetch(fullUrl);

    if (!response.ok) return null;

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const wikiBody = doc.querySelector('.markdown-body, .wiki-body');
    const titleEl = doc.querySelector('#wiki-wrapper h1, .gh-header-title, .wiki-title');

    if (!wikiBody) return null;

    const title = titleEl?.textContent?.trim() || url.split('/').pop() || 'Home';
    const content = htmlToMarkdown(wikiBody.innerHTML, title, { owner, repo });

    return { title, content };
  } catch {
    return null;
  }
}

interface WikiPage {
  id: string;
  title: string;
  content: string;
  url: string;
}

interface WikiBulkExportOptions {
  type: 'wiki';
  owner: string;
  repo: string;
  format: 'markdown' | 'json' | 'html';
  selectionMode: 'all' | 'custom';
  selectedItems?: Array<{ id: string; url: string; title: string }>;
}

/**
 * Parse wiki content into structured sections
 */
function parseWikiContent(markdown: string): { sections: Array<{ heading: string; content: string; level: number }> } {
  const sections: Array<{ heading: string; content: string; level: number }> = [];
  const lines = markdown.split('\n');

  let currentSection: { heading: string; content: string[]; level: number } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        sections.push({
          heading: currentSection.heading,
          content: currentSection.content.join('\n').trim(),
          level: currentSection.level,
        });
      }

      // Start new section
      currentSection = {
        heading: headingMatch[2],
        content: [],
        level: headingMatch[1].length,
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections.push({
      heading: currentSection.heading,
      content: currentSection.content.join('\n').trim(),
      level: currentSection.level,
    });
  }

  return { sections };
}

/**
 * Handle wiki bulk export
 */
async function handleWikiBulkExport(
  options: WikiBulkExportOptions
): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
  const { owner, repo, format, selectionMode, selectedItems } = options;

  try {
    const pages: WikiPage[] = [];

    if (selectionMode === 'custom' && selectedItems) {
      // Fetch selected pages
      for (const item of selectedItems) {
        const pageContent = await fetchWikiPageContent(item.url, owner, repo);
        if (pageContent) {
          pages.push({
            id: item.id,
            title: pageContent.title,
            content: pageContent.content,
            url: item.url,
          });
        }
      }
    } else {
      // Fetch all pages from sidebar
      const pageUrls = collectWikiPageUrls();
      for (const url of pageUrls) {
        const pageContent = await fetchWikiPageContent(url, owner, repo);
        if (pageContent) {
          const pageName = url.split('/wiki/').pop() || 'Home';
          pages.push({
            id: pageName,
            title: pageContent.title,
            content: pageContent.content,
            url: `https://github.com${url}`,
          });
        }
      }
    }

    if (pages.length === 0) {
      return { success: false, error: 'No wiki pages found' };
    }

    // Sort pages: Home first, then alphabetically
    pages.sort((a, b) => {
      if (a.id === 'Home') return -1;
      if (b.id === 'Home') return 1;
      return a.title.localeCompare(b.title);
    });

    let output: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      // Create structured JSON with parsed content
      const jsonData = {
        repository: `${owner}/${repo}`,
        exportedAt: new Date().toISOString(),
        pageCount: pages.length,
        pages: pages.map(page => {
          const parsed = parseWikiContent(page.content);
          return {
            id: page.id,
            title: page.title,
            url: page.url,
            sections: parsed.sections,
            rawContent: page.content,
          };
        }),
      };
      output = JSON.stringify(jsonData, null, 2);
      filename = `${owner}-${repo}-wiki.json`;
      mimeType = 'application/json';
    } else if (format === 'html') {
      // Create HTML document
      output = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${owner}/${repo} - Wiki</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-top: 24px; }
    pre { background: #f6f8fa; padding: 16px; overflow: auto; border-radius: 6px; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    pre code { background: none; padding: 0; }
    .toc { background: #f6f8fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .toc ul { margin: 0; padding-left: 20px; }
    .page-section { border-top: 2px solid #eaecef; padding-top: 24px; margin-top: 48px; }
  </style>
</head>
<body>
  <h1>${owner}/${repo} - Wiki Documentation</h1>
  <p><em>Exported on: ${new Date().toLocaleDateString()}</em></p>
  
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      ${pages.map((p, i) => `<li><a href="#page-${i}">${p.title}</a></li>`).join('\n      ')}
    </ul>
  </div>
  
  ${pages.map((page, i) => `
  <div class="page-section" id="page-${i}">
    <h2>${page.title}</h2>
    ${markdownToSimpleHtml(page.content)}
  </div>
  `).join('\n')}
</body>
</html>`;
      filename = `${owner}-${repo}-wiki.html`;
      mimeType = 'text/html';
    } else {
      // Default: Markdown with table of contents
      output = `# ${owner}/${repo} - Wiki Documentation\n\n`;
      output += `> Exported on: ${new Date().toLocaleDateString()}\n\n`;
      output += `## Table of Contents\n\n`;

      pages.forEach((page, i) => {
        const anchor = page.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        output += `${i + 1}. [${page.title}](#${anchor})\n`;
      });

      output += '\n---\n\n';

      for (const page of pages) {
        output += `## ${page.title}\n\n`;
        output += `> Wiki page from: **${owner}/${repo}**\n\n`;
        output += page.content + '\n\n---\n\n';
      }

      filename = `${owner}-${repo}-wiki.md`;
      mimeType = 'text/markdown';
    }

    // Download the file
    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      count: pages.length,
      message: `Successfully exported ${pages.length} wiki pages!`
    };
  } catch (error) {
    console.error('[WikiBulkExport] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

/**
 * Simple markdown to HTML converter for wiki export
 */
function markdownToSimpleHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')  // Use h4 for h2 since we're in a section
    .replace(/^#\s+(.+)$/gm, '<h3>$1</h3>')    // Use h3 for h1
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return match;
    });
}

// ============================================================================
// Bulk Export for Issues/PRs/Discussions
// ============================================================================

interface ItemsBulkExportOptions {
  type: 'issues' | 'pulls' | 'discussions';
  owner: string;
  repo: string;
  format: 'markdown' | 'json' | 'html';
  selectionMode: 'all' | 'custom';
  selectedItems?: Array<{
    id: string;
    number: number;
    url: string;
    title: string;
  }>;
  state?: 'all' | 'open' | 'closed';
  limit?: number;
  includeComments?: boolean;
  includeDiff?: boolean;
}

/**
 * Fetch item content (issue/PR/discussion) from GitHub API
 */
async function fetchItemContent(
  type: string,
  owner: string,
  repo: string,
  number: number,
  token: string,
  includeComments: boolean,
  includeDiff: boolean
): Promise<{ title: string; content: string; state: string } | null> {
  try {
    // Get the item data
    const apiType = type === 'pulls' ? 'pulls' : type;
    const itemResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/${apiType}/${number}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!itemResponse.ok) return null;

    const item = await itemResponse.json();

    // Build markdown content
    let content = '';

    // Title and metadata
    const typeLabel = type === 'pulls' ? 'Pull Request' : type === 'issues' ? 'Issue' : 'Discussion';
    content += `# ${item.title}\n\n`;
    content += `> **${typeLabel} #${number}** | `;
    content += `State: **${item.state}** | `;
    content += `Created: ${new Date(item.created_at).toLocaleDateString()} | `;
    content += `Author: [@${item.user?.login || 'unknown'}](https://github.com/${item.user?.login || ''})\n\n`;

    if (item.labels && item.labels.length > 0) {
      content += `Labels: ${item.labels.map((l: { name: string }) => `\`${l.name}\``).join(', ')}\n\n`;
    }

    content += '---\n\n';

    // Body
    if (item.body) {
      content += item.body + '\n\n';
    }

    // Comments
    if (includeComments) {
      const commentsUrl = item.comments_url ||
        `https://api.github.com/repos/${owner}/${repo}/${apiType}/${number}/comments`;

      const commentsResponse = await fetch(commentsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        if (comments.length > 0) {
          content += '---\n\n## Comments\n\n';

          for (const comment of comments) {
            content += `### Comment by [@${comment.user?.login || 'unknown'}](https://github.com/${comment.user?.login || ''})`;
            content += ` on ${new Date(comment.created_at).toLocaleDateString()}\n\n`;
            content += (comment.body || '') + '\n\n';
          }
        }
      }
    }

    // Diff for PRs
    if (type === 'pulls' && includeDiff) {
      const diffResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3.diff',
          },
        }
      );

      if (diffResponse.ok) {
        const diff = await diffResponse.text();
        content += '---\n\n## Changes (Diff)\n\n';
        content += '```diff\n' + diff + '\n```\n\n';
      }
    }

    return {
      title: item.title,
      content,
      state: item.state,
    };
  } catch (error) {
    console.error(`[BulkExport] Failed to fetch ${type} #${number}:`, error);
    return null;
  }
}

/**
 * Handle bulk export for issues/PRs/discussions
 */
async function handleItemsBulkExport(
  options: ItemsBulkExportOptions
): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
  const { type, owner, repo, format, selectionMode, selectedItems, state, limit, includeComments, includeDiff } = options;

  // Get token from storage
  const result = await chrome.storage.sync.get('githubToken');
  const token = result.githubToken;

  if (!token) {
    return { success: false, error: 'GitHub token required for bulk export' };
  }

  try {
    const items: Array<{ number: number; title: string; content: string; state: string }> = [];

    if (selectionMode === 'custom' && selectedItems) {
      // Fetch selected items
      for (const selected of selectedItems) {
        const itemContent = await fetchItemContent(
          type, owner, repo, selected.number, token,
          includeComments ?? true, includeDiff ?? false
        );
        if (itemContent) {
          items.push({
            number: selected.number,
            title: itemContent.title,
            content: itemContent.content,
            state: itemContent.state,
          });
        }
      }
    } else {
      // Fetch items from API
      const apiType = type === 'pulls' ? 'pulls' : type;
      const perPage = 100;
      let page = 1;
      let hasMore = true;
      const effectiveLimit = limit && limit > 0 ? limit : 1000; // Default max 1000 if no limit

      while (hasMore && items.length < effectiveLimit) {
        const stateParam = state && state !== 'all' ? `&state=${state}` : '&state=all';
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${apiType}?per_page=${perPage}&page=${page}${stateParam}`;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.length === 0) {
          hasMore = false;
          break;
        }

        // Fetch full content for each item
        for (const item of data) {
          if (items.length >= effectiveLimit) break;

          const itemContent = await fetchItemContent(
            type, owner, repo, item.number, token,
            includeComments ?? true, includeDiff ?? false
          );
          if (itemContent) {
            items.push({
              number: item.number,
              title: itemContent.title,
              content: itemContent.content,
              state: itemContent.state,
            });
          }
        }

        page++;
        hasMore = data.length === perPage && items.length < effectiveLimit;
      }
    }

    if (items.length === 0) {
      return { success: false, error: `No ${type} found` };
    }

    // Sort by number descending
    items.sort((a, b) => b.number - a.number);

    // Build output
    const typeLabel = type === 'pulls' ? 'Pull Requests' : type === 'issues' ? 'Issues' : 'Discussions';
    let output = '';
    let filename = '';
    let mimeType = 'text/plain';

    if (format === 'json') {
      const jsonData = {
        repository: `${owner}/${repo}`,
        exportDate: new Date().toISOString(),
        type: typeLabel,
        count: items.length,
        items: items.map(item => ({
          number: item.number,
          title: item.title,
          state: item.state,
          content: item.content,
        })),
      };
      output = JSON.stringify(jsonData, null, 2);
      filename = `${owner}-${repo}-${type}.json`;
      mimeType = 'application/json';
    } else if (format === 'html') {
      output = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${owner}/${repo} - ${typeLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .item { margin-bottom: 40px; padding: 20px; border: 1px solid #e1e4e8; border-radius: 6px; }
    .item-header { margin-bottom: 16px; }
    .item-title { font-size: 1.5em; font-weight: 600; margin: 0; }
    .item-meta { color: #586069; font-size: 0.9em; margin-top: 8px; }
    .state-open { color: #22863a; }
    .state-closed { color: #cb2431; }
    .state-merged { color: #6f42c1; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: 'SFMono-Regular', Consolas, monospace; }
  </style>
</head>
<body>
  <h1>${owner}/${repo} - ${typeLabel}</h1>
  <p><em>Exported on: ${new Date().toLocaleDateString()}</em></p>
  <p>Total: ${items.length} items</p>
  
  ${items.map(item => `
  <div class="item">
    <div class="item-header">
      <h2 class="item-title">#${item.number}: ${item.title}</h2>
      <div class="item-meta">State: <span class="state-${item.state}">${item.state}</span></div>
    </div>
    <div class="item-content">
      ${markdownToSimpleHtml(item.content)}
    </div>
  </div>
  `).join('\n')}
</body>
</html>`;
      filename = `${owner}-${repo}-${type}.html`;
      mimeType = 'text/html';
    } else {
      // Default: Markdown with table of contents
      output = `# ${owner}/${repo} - ${typeLabel}\n\n`;
      output += `> Exported on: ${new Date().toLocaleDateString()}\n`;
      output += `> Total: ${items.length} items\n\n`;
      output += `## Table of Contents\n\n`;

      items.forEach((item, i) => {
        const stateIcon = item.state === 'open' ? '🟢' : item.state === 'merged' ? '🟣' : '🔴';
        output += `${i + 1}. ${stateIcon} [#${item.number}: ${item.title}](#item-${item.number})\n`;
      });

      output += '\n---\n\n';

      for (const item of items) {
        output += `<a name="item-${item.number}"></a>\n\n`;
        output += item.content + '\n\n---\n\n';
      }

      filename = `${owner}-${repo}-${type}.md`;
      mimeType = 'text/markdown';
    }

    // Download the file
    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      count: items.length,
      message: `Successfully exported ${items.length} ${type}!`
    };
  } catch (error) {
    console.error('[BulkExport] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

console.log('[GitHub Markdown Exporter] Content script loaded');
