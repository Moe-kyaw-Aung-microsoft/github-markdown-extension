import React, { useState, useEffect, useCallback } from 'react';

interface PageInfo {
  url: string;
  isGitHub: boolean;
  pageType: 'issue' | 'pr' | 'discussion' | 'wiki' | 'repo' | 'other';
  owner?: string;
  repo?: string;
  number?: string;
  title?: string;
}

interface BulkExportProps {
  pageInfo: PageInfo | null;
  token: string | null;
}

type ExportType = 'issues' | 'pulls' | 'discussions' | 'wiki';
type SelectionMode = 'all' | 'custom';
type ExportFormat = 'markdown' | 'json' | 'html';

interface SelectableItem {
  id: string;
  number?: number;
  title: string;
  url: string;
  selected: boolean;
  state?: 'open' | 'closed' | 'merged' | 'draft';
}

export function BulkExport({ pageInfo, token }: BulkExportProps) {
  const [exportType, setExportType] = useState<ExportType>('issues');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Options for all mode
  const [state, setState] = useState<'all' | 'open' | 'closed'>('all');
  const [limit, setLimit] = useState(25);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeDiff, setIncludeDiff] = useState(false);

  // Items for custom selection
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // Pagination state for infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const itemsListRef = React.useRef<HTMLDivElement>(null);

  // Custom repository editing
  const [isEditingRepo, setIsEditingRepo] = useState(false);
  const [customOwner, setCustomOwner] = useState('');
  const [customRepo, setCustomRepo] = useState('');

  // Repository search suggestions
  const [repoSuggestions, setRepoSuggestions] = useState<Array<{
    full_name: string;
    description: string | null;
    stargazers_count: number;
  }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature availability
  const [repoFeatures, setRepoFeatures] = useState<{
    hasWiki: boolean;
    hasDiscussions: boolean;
    isLoading: boolean;
  }>({ hasWiki: true, hasDiscussions: true, isLoading: true });

  // Get effective owner/repo (custom or from pageInfo)
  const effectiveOwner = customOwner || pageInfo?.owner || '';
  const effectiveRepo = customRepo || pageInfo?.repo || '';

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Track if features have been checked for current repo
  const [featuresCheckedForRepo, setFeaturesCheckedForRepo] = useState<string>('');

  // Check repo features availability - only when repo changes (not on export type changes)
  useEffect(() => {
    const repoKey = `${effectiveOwner}/${effectiveRepo}`;

    // Skip if already checked for this repo
    if (featuresCheckedForRepo === repoKey) {
      return;
    }

    const checkFeatures = async () => {
      if (!effectiveOwner || !effectiveRepo) {
        setRepoFeatures({ hasWiki: true, hasDiscussions: true, isLoading: false });
        return;
      }

      setRepoFeatures(prev => ({ ...prev, isLoading: true }));

      try {
        // Check wiki by fetching the _pages endpoint
        // If wiki exists, it returns a list of pages
        // If wiki doesn't exist, it redirects to the main repo page
        const wikiPagesUrl = `https://github.com/${effectiveOwner}/${effectiveRepo}/wiki/_pages`;

        const wikiResponse = await fetch(wikiPagesUrl, {
          redirect: 'follow',
        });

        // Check if we got redirected away from wiki (means no wiki)
        const hasWiki = wikiResponse.ok && wikiResponse.url.includes('/wiki/');

        // Check discussions using the API (discussions don't have a similar page)
        let hasDiscussions = true;
        if (token) {
          const repoResponse = await fetch(
            `https://api.github.com/repos/${effectiveOwner}/${effectiveRepo}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );
          if (repoResponse.ok) {
            const data = await repoResponse.json();
            hasDiscussions = data.has_discussions ?? false;
          }
        }

        setRepoFeatures({
          hasWiki,
          hasDiscussions,
          isLoading: false,
        });

        // Mark this repo as checked
        setFeaturesCheckedForRepo(repoKey);
      } catch {
        setRepoFeatures({ hasWiki: true, hasDiscussions: true, isLoading: false });
      }
    };

    checkFeatures();
  }, [effectiveOwner, effectiveRepo, token, featuresCheckedForRepo]);

  // Auto-switch export type if current selection is disabled
  useEffect(() => {
    if (exportType === 'wiki' && !repoFeatures.hasWiki && !repoFeatures.isLoading) {
      setExportType('issues');
    } else if (exportType === 'discussions' && !repoFeatures.hasDiscussions && !repoFeatures.isLoading) {
      setExportType('issues');
    }
  }, [repoFeatures, exportType]);

  const canBulkExport = pageInfo?.isGitHub && effectiveOwner && effectiveRepo;

  // Load items when switching to custom selection mode
  const loadItems = useCallback(async () => {
    if (!canBulkExport || !effectiveOwner || !effectiveRepo || !token) return;

    setIsLoadingItems(true);
    setItems([]);

    try {
      if (exportType === 'wiki') {
        // Fetch wiki pages from the _pages endpoint
        // This gives us a reliable list of all wiki pages
        const wikiPagesUrl = `https://github.com/${effectiveOwner}/${effectiveRepo}/wiki/_pages`;

        const response = await fetch(wikiPagesUrl, {
          redirect: 'follow',
        });

        // Check if redirected away from wiki (means no wiki)
        if (!response.ok || !response.url.includes('/wiki/')) {
          setToast({ type: 'error', text: 'Wiki is not enabled or has no pages.' });
          setIsLoadingItems(false);
          return;
        }

        const html = await response.text();
        const pages: SelectableItem[] = [];

        // Parse the _pages HTML to extract page links
        // Links are in format: href="/owner/repo/wiki/PageName"
        const wikiLinkPattern = new RegExp(
          `<a\\s+href="/${effectiveOwner}/${effectiveRepo}/wiki/([^"_][^"]*)"[^>]*>([^<]+)</a>`,
          'gi'
        );

        const foundPages = new Map<string, string>(); // slug -> title
        let match;

        while ((match = wikiLinkPattern.exec(html)) !== null) {
          const pageSlug = decodeURIComponent(match[1]);
          const pageTitle = match[2].trim();
          // Skip special pages (starting with _) and anchors
          if (!pageSlug.startsWith('_') && !pageSlug.includes('#') && !pageSlug.includes('?')) {
            foundPages.set(pageSlug, pageTitle);
          }
        }

        // Convert to SelectableItem array
        for (const [pageSlug, pageTitle] of foundPages) {
          pages.push({
            id: pageSlug,
            title: pageTitle,
            url: `https://github.com/${effectiveOwner}/${effectiveRepo}/wiki/${pageSlug}`,
            selected: true,
          });
        }

        // Always ensure Home page is included
        if (!foundPages.has('Home')) {
          pages.push({
            id: 'Home',
            title: 'Home',
            url: `https://github.com/${effectiveOwner}/${effectiveRepo}/wiki/Home`,
            selected: true,
          });
        }

        // Sort: Home first, then alphabetically
        pages.sort((a, b) => {
          if (a.id === 'Home') return -1;
          if (b.id === 'Home') return 1;
          return a.title.localeCompare(b.title);
        });

        if (pages.length === 0) {
          setToast({ type: 'error', text: 'No wiki pages found.' });
        }

        setItems(pages);
        setHasMoreItems(false); // Wiki doesn't need pagination
      } else {
        // Fetch first 5 pages (500 items) from GitHub API
        const apiType = exportType === 'pulls' ? 'pulls' : exportType;
        const allItems: SelectableItem[] = [];
        const pagesPerBatch = 5;
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= pagesPerBatch) {
          const apiUrl = `https://api.github.com/repos/${effectiveOwner}/${effectiveRepo}/${apiType}?state=all&per_page=100&page=${page}`;

          const response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.length === 0) {
              hasMore = false;
            } else {
              const fetchedItems: SelectableItem[] = data.map((item: {
                number: number;
                title: string;
                html_url: string;
                state: 'open' | 'closed';
                merged_at?: string | null;
                draft?: boolean;
              }) => {
                // Determine PR/issue state
                let itemState: SelectableItem['state'] = item.state;
                if (item.draft) {
                  itemState = 'draft';
                } else if (item.merged_at) {
                  itemState = 'merged';
                }

                return {
                  id: String(item.number),
                  number: item.number,
                  title: item.title,
                  url: item.html_url,
                  selected: false,
                  state: itemState,
                };
              });
              allItems.push(...fetchedItems);
              page++;
              if (data.length < 100) {
                hasMore = false;
              }
            }
          } else {
            setToast({ type: 'error', text: `Failed to fetch ${exportType}. Check your token permissions.` });
            hasMore = false;
          }
        }

        setItems(allItems);
        setCurrentPage(pagesPerBatch);
        // Check if there might be more items
        setHasMoreItems(allItems.length === pagesPerBatch * 100);
      }
    } catch (error) {
      setToast({ type: 'error', text: `Failed to load items: ${(error as Error).message}` });
    } finally {
      setIsLoadingItems(false);
    }
  }, [canBulkExport, effectiveOwner, effectiveRepo, token, exportType]);

  // Load more items (infinite scroll)
  const loadMoreItems = useCallback(async () => {
    if (!canBulkExport || !effectiveOwner || !effectiveRepo || !token) return;
    if (isLoadingMore || !hasMoreItems || exportType === 'wiki') return;

    setIsLoadingMore(true);

    try {
      const apiType = exportType === 'pulls' ? 'pulls' : exportType;
      const newItems: SelectableItem[] = [];
      const pagesPerBatch = 5;
      let page = currentPage + 1;
      const maxPage = currentPage + pagesPerBatch;
      let hasMore = true;

      while (hasMore && page <= maxPage) {
        const apiUrl = `https://api.github.com/repos/${effectiveOwner}/${effectiveRepo}/${apiType}?state=all&per_page=100&page=${page}`;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.length === 0) {
            hasMore = false;
          } else {
            const fetchedItems: SelectableItem[] = data.map((item: {
              number: number;
              title: string;
              html_url: string;
              state: 'open' | 'closed';
              merged_at?: string | null;
              draft?: boolean;
            }) => {
              let itemState: SelectableItem['state'] = item.state;
              if (item.draft) {
                itemState = 'draft';
              } else if (item.merged_at) {
                itemState = 'merged';
              }

              return {
                id: String(item.number),
                number: item.number,
                title: item.title,
                url: item.html_url,
                selected: false,
                state: itemState,
              };
            });
            newItems.push(...fetchedItems);
            page++;
            if (data.length < 100) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }
      }

      setItems(prev => [...prev, ...newItems]);
      setCurrentPage(page - 1);
      setHasMoreItems(newItems.length === pagesPerBatch * 100);
    } catch (error) {
      console.error('Failed to load more items:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [canBulkExport, effectiveOwner, effectiveRepo, token, exportType, currentPage, hasMoreItems, isLoadingMore]);

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (bottom && hasMoreItems && !isLoadingMore) {
      loadMoreItems();
    }
  }, [hasMoreItems, isLoadingMore, loadMoreItems]);

  // Load items when switching to custom mode, changing export type, or changing repo
  useEffect(() => {
    if (selectionMode === 'custom' && canBulkExport && token) {
      setCurrentPage(1);
      setHasMoreItems(false);
      loadItems();
    }
  }, [selectionMode, exportType, loadItems, canBulkExport, token, effectiveOwner, effectiveRepo]);

  // Toggle item selection
  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // Select/deselect all
  const selectAll = (selected: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected })));
  };

  // Add item from URL input
  const addFromUrl = async () => {
    if (!urlInput.trim() || !token) return;

    // Parse GitHub URL to extract owner, repo, type, and number
    const match = urlInput.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull|discussions)\/(\d+)/);
    if (!match) {
      setToast({ type: 'error', text: 'Invalid GitHub URL format' });
      return;
    }

    const [, urlOwner, urlRepo, urlType, number] = match;

    // Validate same project
    if (urlOwner !== pageInfo?.owner || urlRepo !== pageInfo?.repo) {
      setToast({
        type: 'error',
        text: `URL must be from ${pageInfo?.owner}/${pageInfo?.repo}`
      });
      return;
    }

    // Check if already in list - if so, select it
    const existingItem = items.find(item => item.id === number);
    if (existingItem) {
      if (!existingItem.selected) {
        setItems(prev => prev.map(item =>
          item.id === number ? { ...item, selected: true } : item
        ));
        setToast({ type: 'success', text: `#${number} selected` });
      }
      setUrlInput('');
      return;
    }

    // Fetch the title from GitHub API
    try {
      const apiType = urlType === 'pull' ? 'pulls' : urlType;
      const apiUrl = `https://api.github.com/repos/${urlOwner}/${urlRepo}/${apiType}/${number}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      let title = `#${number}`;
      if (response.ok) {
        const data = await response.json();
        title = data.title || title;
      }

      setItems(prev => [...prev, {
        id: number,
        number: parseInt(number, 10),
        title,
        url: urlInput.trim(),
        selected: true,
      }]);
      setUrlInput('');
    } catch {
      // If API fails, still add with number as title
      setItems(prev => [...prev, {
        id: number,
        number: parseInt(number, 10),
        title: `#${number}`,
        url: urlInput.trim(),
        selected: true,
      }]);
      setUrlInput('');
    }
  };

  // Filter items by search query
  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.number && String(item.number).includes(searchQuery))
  );

  const selectedCount = items.filter(i => i.selected).length;

  const handleBulkExport = async () => {
    if (!canBulkExport || !effectiveOwner || !effectiveRepo || !token) return;

    setIsExporting(true);
    setToast(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      // Build options
      const options: Record<string, unknown> = {
        type: exportType,
        owner: effectiveOwner,
        repo: effectiveRepo,
        format,
        selectionMode,
      };

      if (selectionMode === 'all') {
        if (exportType !== 'wiki') {
          options.state = state;
          options.limit = limit;
          options.includeComments = includeComments;
          if (exportType === 'pulls') {
            options.includeDiff = includeDiff;
          }
        }
      } else {
        // Custom selection
        options.selectedItems = items.filter(i => i.selected).map(i => ({
          id: i.id,
          number: i.number,
          url: i.url,
          title: i.title,
        }));
        options.includeComments = includeComments;
        if (exportType === 'pulls') {
          options.includeDiff = includeDiff;
        }
      }

      // Send bulk export request to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'bulkExport',
        options,
      });

      if (response?.success) {
        setToast({
          type: 'success',
          text: response.message || `Successfully exported ${response.count || ''} items!`,
        });
      } else {
        throw new Error(response?.error || 'Bulk export failed');
      }
    } catch (error) {
      setToast({
        type: 'error',
        text: error instanceof Error ? error.message : 'Bulk export failed',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Not on GitHub or no repo context
  if (!canBulkExport) {
    return (
      <div className="bulk-export disabled">
        <p className="hint">
          Navigate to a GitHub repository to use bulk export.
        </p>
      </div>
    );
  }

  // No token configured
  if (!token) {
    return (
      <div className="bulk-export warning">
        <svg viewBox="0 0 16 16" width="24" height="24" className="warning-icon">
          <path
            fill="currentColor"
            d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
          />
        </svg>
        <p>A GitHub token is required for bulk export.</p>
        <p className="hint">Go to Settings to configure your token.</p>
      </div>
    );
  }

  // State for repo search
  const [repoSearchInput, setRepoSearchInput] = useState('');

  // Handle setting repo from search/URL input
  const handleSetRepoFromInput = () => {
    const input = repoSearchInput.trim();
    if (!input) return;

    // Check if it's a GitHub URL
    const urlMatch = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
    if (urlMatch) {
      const [, owner, repo] = urlMatch;
      // Remove .git suffix if present
      const cleanRepo = repo.replace(/\.git$/, '');
      setCustomOwner(owner);
      setCustomRepo(cleanRepo);
      setIsEditingRepo(false);
      setRepoSearchInput('');
      setItems([]);
      return;
    }

    // Check if it's owner/repo format
    const repoMatch = input.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      setCustomOwner(owner);
      setCustomRepo(repo);
      setIsEditingRepo(false);
      setRepoSearchInput('');
      setItems([]);
      return;
    }

    setToast({ type: 'error', text: 'Enter a valid owner/repo or GitHub URL' });
  };

  // Reset to current page repo
  const handleResetRepo = () => {
    setCustomOwner('');
    setCustomRepo('');
    setIsEditingRepo(false);
    setRepoSearchInput('');
    setItems([]);
    setRepoSuggestions([]);
    setShowSuggestions(false);
  };

  // Search for repositories as user types
  const searchRepositories = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !token) {
      setRepoSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't search if it looks like a complete owner/repo format
    if (query.match(/^[^/\s]+\/[^/\s]+$/)) {
      setRepoSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=8`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRepoSuggestions(data.items || []);
        setShowSuggestions(true);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [token]);

  // Handle input change with debounced search
  const handleRepoSearchChange = (value: string) => {
    setRepoSearchInput(value);

    // Clear previous debounce
    if (suggestionDebounceRef.current) {
      clearTimeout(suggestionDebounceRef.current);
    }

    // Debounce the search
    suggestionDebounceRef.current = setTimeout(() => {
      searchRepositories(value);
    }, 300);
  };

  // Select a suggestion
  const selectRepoSuggestion = (fullName: string) => {
    const [owner, repo] = fullName.split('/');
    setCustomOwner(owner);
    setCustomRepo(repo);
    setIsEditingRepo(false);
    setRepoSearchInput('');
    setItems([]);
    setRepoSuggestions([]);
    setShowSuggestions(false);
    setFeaturesCheckedForRepo(''); // Reset to trigger feature check
  };

  return (
    <div className="bulk-export">
      {/* Repository Header */}
      <div className="repo-header">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path
            fill="currentColor"
            d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"
          />
        </svg>
        <span className={customOwner ? 'repo-custom' : ''}>
          {effectiveOwner}/{effectiveRepo}
          {customOwner && <span className="repo-badge">custom</span>}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-icon btn-ghost"
          onClick={() => setIsEditingRepo(!isEditingRepo)}
          title={isEditingRepo ? 'Close' : 'Change repository'}
        >
          <svg viewBox="0 0 16 16" width="14" height="14">
            {isEditingRepo ? (
              <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            ) : (
              <path fill="currentColor" d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z" />
            )}
          </svg>
        </button>
      </div>

      {/* Repository Selector Panel */}
      {isEditingRepo && (
        <div className="repo-selector-panel">
          <div className="repo-search-container">
            <div className="repo-search-row">
              <input
                type="text"
                className="repo-search-input"
                placeholder="Search repositories or enter owner/repo..."
                value={repoSearchInput}
                onChange={(e) => handleRepoSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSetRepoFromInput();
                    setShowSuggestions(false);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                onFocus={() => {
                  if (repoSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {isLoadingSuggestions && (
                <span className="repo-search-spinner">
                  <svg viewBox="0 0 16 16" width="14" height="14" className="spin">
                    <path fill="currentColor" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" opacity="0.3" />
                    <path fill="currentColor" d="M8 0a8 8 0 0 1 8 8h-1.5A6.5 6.5 0 0 0 8 1.5V0Z" />
                  </svg>
                </span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  handleSetRepoFromInput();
                  setShowSuggestions(false);
                }}
                disabled={!repoSearchInput.trim()}
              >
                Set
              </button>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && repoSuggestions.length > 0 && (
              <div className="repo-suggestions">
                {repoSuggestions.map((repo) => (
                  <button
                    key={repo.full_name}
                    type="button"
                    className="repo-suggestion-item"
                    onClick={() => selectRepoSuggestion(repo.full_name)}
                  >
                    <div className="repo-suggestion-name">
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
                      </svg>
                      <span>{repo.full_name}</span>
                    </div>
                    {repo.description && (
                      <div className="repo-suggestion-desc">{repo.description}</div>
                    )}
                    <div className="repo-suggestion-stars">
                      <svg viewBox="0 0 16 16" width="10" height="10">
                        <path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                      </svg>
                      <span>{repo.stargazers_count.toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick options */}
          <div className="repo-quick-options">
            {pageInfo?.owner && pageInfo?.repo && (customOwner || customRepo) && (
              <button
                type="button"
                className="repo-quick-option"
                onClick={handleResetRepo}
              >
                <svg viewBox="0 0 16 16" width="12" height="12">
                  <path fill="currentColor" d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z" />
                </svg>
                <span>Current page: {pageInfo.owner}/{pageInfo.repo}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Export Type Selection */}
      <div className="option-group">
        <label className="option-label">Export Type</label>
        <div className="segmented-control">
          <button
            type="button"
            className={`segment ${exportType === 'issues' ? 'active' : ''}`}
            onClick={() => setExportType('issues')}
            disabled={isExporting || repoFeatures.isLoading}
          >
            Issues
          </button>
          <button
            type="button"
            className={`segment ${exportType === 'pulls' ? 'active' : ''}`}
            onClick={() => setExportType('pulls')}
            disabled={isExporting || repoFeatures.isLoading}
          >
            PRs
          </button>
          <button
            type="button"
            className={`segment ${exportType === 'discussions' ? 'active' : ''} ${!repoFeatures.hasDiscussions ? 'disabled' : ''}`}
            onClick={() => repoFeatures.hasDiscussions && setExportType('discussions')}
            disabled={isExporting || repoFeatures.isLoading || !repoFeatures.hasDiscussions}
            title={!repoFeatures.hasDiscussions ? 'Discussions are not enabled for this repository' : undefined}
          >
            Discussions
          </button>
          <button
            type="button"
            className={`segment ${exportType === 'wiki' ? 'active' : ''} ${!repoFeatures.hasWiki ? 'disabled' : ''}`}
            onClick={() => repoFeatures.hasWiki && setExportType('wiki')}
            disabled={isExporting || repoFeatures.isLoading || !repoFeatures.hasWiki}
            title={!repoFeatures.hasWiki ? 'Wiki is not enabled for this repository' : undefined}
          >
            Wiki
          </button>
        </div>
      </div>

      {/* Selection Mode */}
      <div className="option-group">
        <label className="option-label">Selection</label>
        <div className="segmented-control">
          <button
            type="button"
            className={`segment ${selectionMode === 'all' ? 'active' : ''}`}
            onClick={() => setSelectionMode('all')}
            disabled={isExporting}
          >
            {exportType === 'wiki' ? 'All pages' : `All ${exportType}`}
          </button>
          <button
            type="button"
            className={`segment ${selectionMode === 'custom' ? 'active' : ''}`}
            onClick={() => setSelectionMode('custom')}
            disabled={isExporting}
          >
            Custom selection
          </button>
        </div>
      </div>

      {/* Custom Selection List */}
      {selectionMode === 'custom' && (
        <div className="option-group selection-list">
          <div className="list-header">
            <span className="selected-count">{selectedCount} selected</span>
            <div className="list-actions">
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => selectAll(true)}
                disabled={isExporting || isLoadingItems}
              >
                All
              </button>
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => selectAll(false)}
                disabled={isExporting || isLoadingItems}
              >
                None
              </button>
            </div>
          </div>

          {/* Search and URL input */}
          {exportType !== 'wiki' && (
            <div className="search-add-row">
              <input
                type="text"
                className="search-input"
                placeholder="Search or enter URL..."
                value={searchQuery || urlInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes('github.com')) {
                    setUrlInput(val);
                    setSearchQuery('');
                  } else {
                    setSearchQuery(val);
                    setUrlInput('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlInput) {
                    addFromUrl();
                  }
                }}
                disabled={isExporting || isLoadingItems}
              />
              {urlInput && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={addFromUrl}
                  disabled={isExporting}
                >
                  Add
                </button>
              )}
            </div>
          )}

          {/* Items list */}
          <div
            className="items-list"
            ref={itemsListRef}
            onScroll={handleScroll}
          >
            {isLoadingItems ? (
              <div className="loading-items">
                <svg className="spinner" viewBox="0 0 16 16" width="16" height="16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
                </svg>
                <span>Loading...</span>
              </div>
            ) : filteredItems.length > 0 ? (
              <>
                {filteredItems.map(item => (
                  <label key={item.id} className="checkbox-label item-row">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(item.id)}
                      disabled={isExporting}
                    />
                    <span className="checkbox-control"></span>
                    <span className="item-info">
                      {item.number && <span className="item-number">#{item.number}</span>}
                      {item.state && (
                        <span
                          className={`item-state item-state--${item.state}`}
                          title={item.state.charAt(0).toUpperCase() + item.state.slice(1)}
                        />
                      )}
                      <span className="item-title">{item.title}</span>
                    </span>
                  </label>
                ))}
                {/* Load more indicator */}
                {isLoadingMore && (
                  <div className="loading-more">
                    <svg className="spinner" viewBox="0 0 16 16" width="14" height="14">
                      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
                    </svg>
                    <span>Loading more...</span>
                  </div>
                )}
                {hasMoreItems && !isLoadingMore && (
                  <div className="load-more-hint">
                    Scroll for more items ({items.length} loaded)
                  </div>
                )}
              </>
            ) : (
              <p className="hint">No items found</p>
            )}
          </div>
        </div>
      )}

      {/* State filter - only for "all" mode, not for wiki */}
      {selectionMode === 'all' && exportType !== 'wiki' && (
        <div className="option-group">
          <label className="option-label">State</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segment ${state === 'all' ? 'active' : ''}`}
              onClick={() => setState('all')}
              disabled={isExporting}
            >
              All
            </button>
            <button
              type="button"
              className={`segment ${state === 'open' ? 'active' : ''}`}
              onClick={() => setState('open')}
              disabled={isExporting}
            >
              Open
            </button>
            <button
              type="button"
              className={`segment ${state === 'closed' ? 'active' : ''}`}
              onClick={() => setState('closed')}
              disabled={isExporting}
            >
              Closed
            </button>
          </div>
        </div>
      )}

      {/* Limit - only for "all" mode, not for wiki */}
      {selectionMode === 'all' && exportType !== 'wiki' && (
        <div className="option-group">
          <label className="option-label">Limit</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segment ${limit === 10 ? 'active' : ''}`}
              onClick={() => setLimit(10)}
              disabled={isExporting}
            >
              10
            </button>
            <button
              type="button"
              className={`segment ${limit === 25 ? 'active' : ''}`}
              onClick={() => setLimit(25)}
              disabled={isExporting}
            >
              25
            </button>
            <button
              type="button"
              className={`segment ${limit === 50 ? 'active' : ''}`}
              onClick={() => setLimit(50)}
              disabled={isExporting}
            >
              50
            </button>
            <button
              type="button"
              className={`segment ${limit === 100 ? 'active' : ''}`}
              onClick={() => setLimit(100)}
              disabled={isExporting}
            >
              100
            </button>
            <button
              type="button"
              className={`segment ${limit === 0 ? 'active' : ''}`}
              onClick={() => setLimit(0)}
              disabled={isExporting}
            >
              All
            </button>
          </div>
        </div>
      )}

      {/* Format selection */}
      <div className="option-group">
        <label className="option-label">Format</label>
        <div className="segmented-control">
          <button
            type="button"
            className={`segment ${format === 'markdown' ? 'active' : ''}`}
            onClick={() => setFormat('markdown')}
            disabled={isExporting}
          >
            Markdown
          </button>
          <button
            type="button"
            className={`segment ${format === 'json' ? 'active' : ''}`}
            onClick={() => setFormat('json')}
            disabled={isExporting}
          >
            JSON
          </button>
          <button
            type="button"
            className={`segment ${format === 'html' ? 'active' : ''}`}
            onClick={() => setFormat('html')}
            disabled={isExporting}
          >
            HTML
          </button>
        </div>
      </div>

      {/* Include comments option - not for wiki */}
      {exportType !== 'wiki' && (
        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeComments}
              onChange={(e) => setIncludeComments(e.target.checked)}
              disabled={isExporting}
            />
            <span className="checkbox-control"></span>
            Include comments
          </label>
        </div>
      )}

      {/* Include diff option for PRs */}
      {exportType === 'pulls' && (
        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeDiff}
              onChange={(e) => setIncludeDiff(e.target.checked)}
              disabled={isExporting}
            />
            <span className="checkbox-control"></span>
            Include diff (may be large)
          </label>
        </div>
      )}

      {/* Export Button */}
      <button
        className="btn btn-primary full-width"
        onClick={handleBulkExport}
        disabled={isExporting || (selectionMode === 'custom' && selectedCount === 0)}
      >
        {isExporting ? (
          <>
            <svg className="spinner" viewBox="0 0 16 16" width="16" height="16">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg viewBox="0 0 16 16" width="16" height="16">
              <path
                fill="currentColor"
                d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"
              />
              <path
                fill="currentColor"
                d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06Z"
              />
            </svg>
            Export {selectionMode === 'custom' ? `${selectedCount} ` : ''}{exportType === 'pulls' ? 'Pull Requests' : exportType.charAt(0).toUpperCase() + exportType.slice(1)}
          </>
        )}
      </button>

      {/* Toast notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.text}
        </div>
      )}

      <p className="hint">
        Exports will be downloaded as a ZIP file containing markdown files.
      </p>
    </div>
  );
}
