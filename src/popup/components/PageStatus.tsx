import React from 'react';

interface PageInfo {
  url: string;
  isGitHub: boolean;
  pageType: 'issue' | 'pr' | 'discussion' | 'wiki' | 'repo' | 'other';
  owner?: string;
  repo?: string;
  number?: string;
  title?: string;
}

interface PageStatusProps {
  pageInfo: PageInfo | null;
}

const pageTypeLabels: Record<string, { label: string; icon: JSX.Element }> = {
  issue: {
    label: 'Issue',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        />
        <path
          fill="currentColor"
          d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"
        />
      </svg>
    ),
  },
  pr: {
    label: 'Pull Request',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"
        />
      </svg>
    ),
  },
  discussion: {
    label: 'Discussion',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"
        />
      </svg>
    ),
  },
  wiki: {
    label: 'Wiki',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"
        />
      </svg>
    ),
  },
  repo: {
    label: 'Repository',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"
        />
      </svg>
    ),
  },
  other: {
    label: 'GitHub Page',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
    ),
  },
};

export function PageStatus({ pageInfo }: PageStatusProps) {
  if (!pageInfo) {
    return (
      <div className="page-status error">
        <p>Unable to detect current page</p>
      </div>
    );
  }

  if (!pageInfo.isGitHub) {
    return (
      <div className="page-status warning">
        <svg viewBox="0 0 16 16" width="24" height="24" className="status-icon">
          <path
            fill="currentColor"
            d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
          />
        </svg>
        <p>Navigate to a GitHub page to use this extension</p>
      </div>
    );
  }

  const typeInfo = pageTypeLabels[pageInfo.pageType];

  return (
    <div className="page-status success">
      <div className="page-type">
        <span className="type-icon">{typeInfo.icon}</span>
        <span className="type-label">{typeInfo.label}</span>
      </div>

      {pageInfo.owner && pageInfo.repo && (
        <div className="repo-info">
          <span className="owner">{pageInfo.owner}</span>
          <span className="separator">/</span>
          <span className="repo">{pageInfo.repo}</span>
          {pageInfo.number && (
            <>
              <span className="separator">#</span>
              <span className="number">{pageInfo.number}</span>
            </>
          )}
        </div>
      )}

      {pageInfo.title && (
        <div className="page-title" title={pageInfo.title}>
          {pageInfo.title}
        </div>
      )}
    </div>
  );
}
