import React, { useState, useEffect, useCallback } from 'react';
import { PageStatus } from './components/PageStatus';
import { ExportActions } from './components/ExportActions';
import { BulkExport } from './components/BulkExport';
import { Settings } from './components/Settings';

// Hook to detect system color scheme
function useColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setScheme(e.matches ? 'dark' : 'light');

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return scheme;
}

interface PageInfo {
  url: string;
  isGitHub: boolean;
  pageType: 'issue' | 'pr' | 'discussion' | 'wiki' | 'repo' | 'other';
  owner?: string;
  repo?: string;
  number?: string;
  title?: string;
}

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'export' | 'bulk' | 'settings'>('export');
  const colorScheme = useColorScheme();

  // Get the appropriate logo based on color scheme
  const logoSrc = colorScheme === 'dark' ? '/icons/icon32-dark.png' : '/icons/icon32.png';

  // Load token and page info on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Get stored token
        const result = await chrome.storage.sync.get(['githubToken']);
        setToken(result.githubToken || null);

        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const info = parsePageInfo(tab.url, tab.title);
          setPageInfo(info);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleTokenSave = useCallback(async (newToken: string) => {
    await chrome.storage.sync.set({ githubToken: newToken });
    setToken(newToken);
  }, []);

  const handleTokenRemove = useCallback(async () => {
    await chrome.storage.sync.remove(['githubToken']);
    setToken(null);
  }, []);

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>
          <img src={logoSrc} alt="" className="logo" />
          GitHub Markdown Exporter
        </h1>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
        <button
          className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          Bulk Export
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="popup-content">
        {activeTab === 'export' && (
          <div className="tab-content">
            <PageStatus pageInfo={pageInfo} />
            {pageInfo?.isGitHub && (
              <ExportActions pageInfo={pageInfo} />
            )}
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="tab-content">
            <BulkExport pageInfo={pageInfo} token={token} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-content">
            <Settings
              token={token}
              onTokenSave={handleTokenSave}
              onTokenRemove={handleTokenRemove}
            />
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <div className="made-by">
          <img
            src="https://avatars.githubusercontent.com/u/80718477?s=60&v=4"
            alt="Fefe_du_973"
            className="avatar"
          />
          <span>Made by <a href="https://github.com/fefedu973" target="_blank" rel="noopener noreferrer">Fefe_du_973</a></span>
        </div>
      </footer>
    </div>
  );
}

function parsePageInfo(url: string, title?: string): PageInfo {
  const info: PageInfo = {
    url,
    isGitHub: url.includes('github.com'),
    pageType: 'other',
    title,
  };

  if (!info.isGitHub) return info;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2) {
      info.owner = pathParts[0];
      info.repo = pathParts[1];
    }

    // Check for wiki first (can be /owner/repo/wiki or /owner/repo/wiki/Page-Name)
    if (pathParts.length >= 3 && pathParts[2] === 'wiki') {
      info.pageType = 'wiki';
      if (pathParts.length >= 4) {
        info.number = pathParts[3]; // Wiki page name
      }
      return info;
    }

    if (pathParts.length >= 4) {
      const type = pathParts[2];
      info.number = pathParts[3];

      switch (type) {
        case 'issues':
          info.pageType = 'issue';
          break;
        case 'pull':
          info.pageType = 'pr';
          break;
        case 'discussions':
          info.pageType = 'discussion';
          break;
      }
    } else if (pathParts.length === 2) {
      info.pageType = 'repo';
    }
  } catch {
    // URL parsing failed
  }

  return info;
}
