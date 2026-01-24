/**
 * Page Detection - GitHub page type detection utilities
 * 
 * Inspired by github-url-detection, this module provides functions
 * to detect what type of GitHub page the user is currently viewing.
 */

/**
 * Get the current URL pathname parts
 */
function getPathParts(): string[] {
  return window.location.pathname.split('/').filter(Boolean);
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return document.body.classList.contains('logged-in');
}

/**
 * Check if on any GitHub repository page
 */
export function isRepo(): boolean {
  const parts = getPathParts();
  // At minimum need owner/repo
  return parts.length >= 2 && !isGlobalPage();
}

/**
 * Check if on a global GitHub page (not a repo)
 */
function isGlobalPage(): boolean {
  const globalPaths = [
    'settings', 'notifications', 'explore', 'trending',
    'search', 'login', 'join', 'pricing', 'features',
    'marketplace', 'sponsors', 'organizations', 'codespaces'
  ];
  const firstPart = getPathParts()[0];
  return globalPaths.includes(firstPart);
}

/**
 * Check if on an issue page
 */
export function isIssue(): boolean {
  const parts = getPathParts();
  return parts.length >= 4 && parts[2] === 'issues' && /^\d+$/.test(parts[3]);
}

/**
 * Check if on the issues list page
 */
export function isIssueList(): boolean {
  const parts = getPathParts();
  return parts.length >= 3 && parts[2] === 'issues' && (parts.length === 3 || !(/^\d+$/.test(parts[3])));
}

/**
 * Check if on a pull request page
 */
export function isPR(): boolean {
  const parts = getPathParts();
  return parts.length >= 4 && parts[2] === 'pull' && /^\d+$/.test(parts[3]);
}

/**
 * Check if on the pull requests list page
 */
export function isPRList(): boolean {
  const parts = getPathParts();
  return parts.length >= 3 && parts[2] === 'pulls';
}

/**
 * Check if on a discussion page
 */
export function isDiscussion(): boolean {
  const parts = getPathParts();
  return parts.length >= 4 && parts[2] === 'discussions' && /^\d+$/.test(parts[3]);
}

/**
 * Check if on the discussions list page
 */
export function isDiscussionList(): boolean {
  const parts = getPathParts();
  return parts.length >= 3 && parts[2] === 'discussions' && (parts.length === 3 || !(/^\d+$/.test(parts[3])));
}

/**
 * Check if on a wiki page
 */
export function isWiki(): boolean {
  const parts = getPathParts();
  return parts.length >= 3 && parts[2] === 'wiki';
}

/**
 * Check if on an issue, PR, or discussion (any "thread" page)
 */
export function isThread(): boolean {
  return isIssue() || isPR() || isDiscussion();
}

/**
 * Check if on a page where we can export content
 */
export function isExportable(): boolean {
  return isThread() || isWiki();
}

/**
 * Check if the repository is archived
 */
export function isArchivedRepo(): boolean {
  return document.querySelector('.octicon-archive') !== null ||
    document.body.classList.contains('archived-repo');
}

/**
 * Check if on the repository root/homepage
 */
export function isRepoRoot(): boolean {
  const parts = getPathParts();
  return parts.length === 2;
}

/**
 * Check if on a file view page
 */
export function isFile(): boolean {
  const parts = getPathParts();
  return parts.length >= 4 && parts[2] === 'blob';
}

/**
 * Check if on a directory view page
 */
export function isDirectory(): boolean {
  const parts = getPathParts();
  return parts.length >= 3 && parts[2] === 'tree';
}

/**
 * Check if on any code view (file or directory)
 */
export function isCodeView(): boolean {
  return isFile() || isDirectory() || isRepoRoot();
}

/**
 * Get repository info from the current URL
 */
export function getRepoInfo(): { owner: string; repo: string } | null {
  const parts = getPathParts();
  if (parts.length < 2) return null;
  return {
    owner: parts[0],
    repo: parts[1],
  };
}

/**
 * Get the issue/PR/discussion number from the URL
 */
export function getThreadNumber(): number | null {
  const parts = getPathParts();
  if (parts.length < 4) return null;

  const type = parts[2];
  if (!['issues', 'pull', 'discussions'].includes(type)) return null;

  const number = parseInt(parts[3], 10);
  return isNaN(number) ? null : number;
}

/**
 * Get the wiki page name from the URL
 */
export function getWikiPageName(): string | null {
  const parts = getPathParts();
  if (parts.length < 3 || parts[2] !== 'wiki') return null;

  // Default to Home if no page specified
  if (parts.length === 3) return 'Home';

  // Join remaining parts (wiki pages can have slashes)
  return parts.slice(3).join('/');
}

/**
 * Get the current page type
 */
export function getPageType(): 'issue' | 'pr' | 'discussion' | 'wiki' | 'other' {
  if (isIssue()) return 'issue';
  if (isPR()) return 'pr';
  if (isDiscussion()) return 'discussion';
  if (isWiki()) return 'wiki';
  return 'other';
}

/**
 * Get full page info for exportable pages
 */
export function getPageInfo(): {
  owner: string;
  repo: string;
  type: 'issues' | 'discussions' | 'wiki';
  number?: number;
  pageName?: string;
  displayType: 'issue' | 'pull' | 'discussion' | 'wiki';
} | null {
  const repoInfo = getRepoInfo();
  if (!repoInfo) return null;

  if (isIssue()) {
    return {
      ...repoInfo,
      type: 'issues',
      number: getThreadNumber()!,
      displayType: 'issue',
    };
  }

  if (isPR()) {
    return {
      ...repoInfo,
      type: 'issues', // GitHub API treats PRs as issues
      number: getThreadNumber()!,
      displayType: 'pull',
    };
  }

  if (isDiscussion()) {
    return {
      ...repoInfo,
      type: 'discussions',
      number: getThreadNumber()!,
      displayType: 'discussion',
    };
  }

  if (isWiki()) {
    return {
      ...repoInfo,
      type: 'wiki',
      pageName: getWikiPageName()!,
      displayType: 'wiki',
    };
  }

  return null;
}
