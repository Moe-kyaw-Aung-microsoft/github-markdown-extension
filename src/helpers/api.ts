/**
 * GitHub API Helper
 * 
 * Provides clean abstraction for GitHub API calls with:
 * - Token management
 * - Error handling
 * - Pagination support
 */

export interface GitHubIssue {
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  updated_at?: string;
  labels?: { name: string }[];
  assignees?: { login: string }[];
  user: {
    login: string;
    html_url: string;
  };
}

export interface GitHubComment {
  body: string;
  created_at: string;
  user: {
    login: string;
    html_url: string;
  };
}

export interface FetchResult {
  issue: GitHubIssue;
  comments: GitHubComment[];
  diff?: string;
  metadata: {
    total_comments: number;
    fetched_at: string;
    issue_number: number;
    repository: string;
    has_diff: boolean;
  };
}

/**
 * Get the stored GitHub token
 */
export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.sync.get(['githubToken']);
  return result.githubToken || null;
}

/**
 * Build request headers with optional auth
 */
async function buildHeaders(acceptType = 'application/vnd.github+json'): Promise<Headers> {
  const headers = new Headers({
    'Accept': acceptType,
    'User-Agent': 'GitHub-Markdown-Exporter',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

/**
 * Handle API error responses
 */
function handleApiError(response: Response, type: string, hasToken: boolean): never {
  const status = response.status;

  if (status === 404) {
    if (hasToken) {
      throw new Error(`${type} not found. Check if the repository exists and your token has access to it.`);
    } else {
      throw new Error(`${type} not found or private. Try adding a GitHub token in the extension popup.`);
    }
  }

  if (status === 403) {
    if (hasToken) {
      throw new Error('Access forbidden. Check if your token has the required permissions for this repository.');
    } else {
      throw new Error('Rate limit exceeded. Please add a GitHub token in the extension popup.');
    }
  }

  if (status === 401) {
    throw new Error('Authentication failed. Please check your GitHub token in the extension popup.');
  }

  if (status === 301) {
    throw new Error(`${type} was moved to another repository.`);
  }

  if (status === 410) {
    throw new Error(`${type} was deleted from the repository.`);
  }

  throw new Error(`Failed to fetch ${type}: ${status} ${response.statusText}`);
}

/**
 * Fetch all comments with pagination
 */
async function fetchAllComments(
  owner: string,
  repo: string,
  type: string,
  number: number,
  headers: Headers
): Promise<GitHubComment[]> {
  const allComments: GitHubComment[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/${type}/${number}/comments?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
    }

    const comments = await response.json() as GitHubComment[];

    if (comments.length === 0) break;

    allComments.push(...comments);

    if (comments.length < perPage) break;

    page++;
  }

  return allComments;
}

/**
 * Fetch issue/PR/discussion data from GitHub API
 */
export async function fetchGitHubData(
  owner: string,
  repo: string,
  type: 'issues' | 'discussions',
  number: number,
  displayType: 'issue' | 'pull' | 'discussion'
): Promise<FetchResult> {
  const headers = await buildHeaders();
  const hasToken = headers.has('Authorization');

  console.log(`[API] Fetching ${displayType} #${number} from ${owner}/${repo}`);

  // Fetch main issue/discussion
  const mainUrl = `https://api.github.com/repos/${owner}/${repo}/${type}/${number}`;
  const mainResponse = await fetch(mainUrl, { headers });

  if (!mainResponse.ok) {
    handleApiError(mainResponse, type.slice(0, -1), hasToken);
  }

  const issue = await mainResponse.json() as GitHubIssue;
  console.log(`[API] Fetched: ${issue.title}`);

  // Fetch comments
  const comments = await fetchAllComments(owner, repo, type, number, headers);
  console.log(`[API] Fetched ${comments.length} comments`);

  // Fetch diff for pull requests
  let diff: string | undefined;
  if (displayType === 'pull') {
    try {
      const diffHeaders = await buildHeaders('application/vnd.github.v3.diff');
      const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
      const diffResponse = await fetch(diffUrl, { headers: diffHeaders });

      if (diffResponse.ok) {
        diff = await diffResponse.text();
        console.log(`[API] Fetched diff (${diff.length} chars)`);
      }
    } catch (error) {
      console.warn('[API] Could not fetch diff:', error);
    }
  }

  return {
    issue,
    comments,
    diff,
    metadata: {
      total_comments: comments.length,
      fetched_at: new Date().toISOString().split('T')[0],
      issue_number: number,
      repository: `${owner}/${repo}`,
      has_diff: !!diff,
    },
  };
}
