/**
 * Markdown Converter
 * 
 * Converts GitHub API data and HTML content to markdown format.
 */

import type { FetchResult } from './api';

export interface MarkdownOptions {
  includeComments?: boolean;
  includeMetadata?: boolean;
  includeDiff?: boolean;
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Convert GitHub API data to markdown
 */
export function convertToMarkdown(data: FetchResult, options: MarkdownOptions = {}): string {
  const { issue, comments, diff } = data;
  const {
    includeComments = true,
    includeMetadata = true,
    includeDiff = false
  } = options;

  // Build markdown content
  let markdown = `# [${issue.title}](${issue.html_url})\n\n`;

  if (includeMetadata) {
    markdown += `> state: **${issue.state}** opened by: **${issue.user.login}** on: **${formatDate(issue.created_at)}**\n\n`;
  }

  markdown += `${issue.body || ''}\n\n`;

  // Add diff content for pull requests
  if (includeDiff && diff) {
    markdown += `### Pull Request Diff\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
  }

  // Add comments
  if (includeComments && comments && comments.length > 0) {
    markdown += `### Comments\n\n`;

    for (const comment of comments) {
      markdown += `---\n`;
      markdown += `> from: [**${comment.user.login}**](${comment.user.html_url}) on: **${formatDate(comment.created_at)}**\n\n`;
      markdown += `${comment.body}\n`;
    }
  }

  return markdown;
}

/**
 * Convert HTML content to markdown (for wiki pages)
 */
export function htmlToMarkdown(html: string, title: string, repoInfo: { owner: string; repo: string }): string {
  // Create a temporary container
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Build markdown with header
  let markdown = `# ${title}\n\n`;
  markdown += `> Wiki page from: **${repoInfo.owner}/${repoInfo.repo}**\n\n`;

  // Process the content
  markdown += processHtmlNode(temp);

  return markdown;
}

/**
 * Recursively process HTML nodes and convert to markdown
 */
function processHtmlNode(node: Node): string {
  let result = '';

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
          result += `\n# ${element.textContent?.trim()}\n\n`;
          break;
        case 'h2':
          result += `\n## ${element.textContent?.trim()}\n\n`;
          break;
        case 'h3':
          result += `\n### ${element.textContent?.trim()}\n\n`;
          break;
        case 'h4':
          result += `\n#### ${element.textContent?.trim()}\n\n`;
          break;
        case 'h5':
          result += `\n##### ${element.textContent?.trim()}\n\n`;
          break;
        case 'h6':
          result += `\n###### ${element.textContent?.trim()}\n\n`;
          break;
        case 'p':
          result += `${processHtmlNode(element)}\n\n`;
          break;
        case 'br':
          result += '\n';
          break;
        case 'strong':
        case 'b':
          result += `**${element.textContent}**`;
          break;
        case 'em':
        case 'i':
          result += `*${element.textContent}*`;
          break;
        case 'code':
          if (element.parentElement?.tagName.toLowerCase() === 'pre') {
            // Skip, handled by pre
          } else {
            result += `\`${element.textContent}\``;
          }
          break;
        case 'pre': {
          const codeBlock = element.querySelector('code');
          const langMatch = codeBlock?.className.match(/language-(\w+)/);
          const lang = langMatch ? langMatch[1] : '';
          const code = codeBlock?.textContent || element.textContent;
          result += `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
          break;
        }
        case 'a': {
          const href = element.getAttribute('href') || '';
          result += `[${element.textContent}](${href})`;
          break;
        }
        case 'img': {
          const src = element.getAttribute('src') || '';
          const alt = element.getAttribute('alt') || '';
          result += `![${alt}](${src})`;
          break;
        }
        case 'ul':
          result += '\n';
          for (const li of element.querySelectorAll(':scope > li')) {
            result += `- ${processHtmlNode(li).trim()}\n`;
          }
          result += '\n';
          break;
        case 'ol': {
          result += '\n';
          let num = 1;
          for (const li of element.querySelectorAll(':scope > li')) {
            result += `${num}. ${processHtmlNode(li).trim()}\n`;
            num++;
          }
          result += '\n';
          break;
        }
        case 'blockquote': {
          const lines = processHtmlNode(element).trim().split('\n');
          result += lines.map(line => `> ${line}`).join('\n') + '\n\n';
          break;
        }
        case 'table':
          result += processTable(element);
          break;
        case 'hr':
          result += '\n---\n\n';
          break;
        case 'div':
        case 'span':
        case 'section':
        case 'article':
          result += processHtmlNode(element);
          break;
        default:
          result += processHtmlNode(element);
      }
    }
  }

  return result;
}

/**
 * Convert an HTML table to markdown
 */
function processTable(table: Element): string {
  let result = '\n';
  const rows = table.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    const cellContents = Array.from(cells).map(cell => cell.textContent?.trim() || '');
    result += '| ' + cellContents.join(' | ') + ' |\n';

    // Add header separator after first row
    if (rowIndex === 0) {
      result += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
    }
  });

  result += '\n';
  return result;
}

/**
 * Convert GitHub API data to JSON format
 */
export function convertToJSON(data: FetchResult, options: MarkdownOptions = {}): string {
  const { issue, comments, diff } = data;
  const {
    includeComments = true,
    includeMetadata = true,
    includeDiff = false
  } = options;

  const output: Record<string, unknown> = {
    title: issue.title,
    url: issue.html_url,
    body: issue.body || '',
  };

  if (includeMetadata) {
    output.metadata = {
      state: issue.state,
      author: issue.user.login,
      authorUrl: issue.user.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      labels: issue.labels?.map((l: { name: string }) => l.name) || [],
      assignees: issue.assignees?.map((a: { login: string }) => a.login) || [],
    };
  }

  if (includeComments && comments && comments.length > 0) {
    output.comments = comments.map(comment => ({
      author: comment.user.login,
      authorUrl: comment.user.html_url,
      createdAt: comment.created_at,
      body: comment.body,
    }));
  }

  if (includeDiff && diff) {
    output.diff = diff;
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Convert GitHub API data to HTML format
 */
export function convertToHTML(data: FetchResult, options: MarkdownOptions = {}): string {
  const { issue, comments, diff } = data;
  const {
    includeComments = true,
    includeMetadata = true,
    includeDiff = false
  } = options;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(issue.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 a { color: #0969da; text-decoration: none; }
    h1 a:hover { text-decoration: underline; }
    .metadata { background: #f6f8fa; padding: 12px; border-radius: 6px; margin-bottom: 20px; color: #656d76; }
    .metadata strong { color: #1f2328; }
    .body { margin-bottom: 30px; }
    .comments { border-top: 1px solid #d0d7de; padding-top: 20px; }
    .comment { border-bottom: 1px solid #d0d7de; padding: 16px 0; }
    .comment-header { color: #656d76; margin-bottom: 8px; }
    .comment-header a { color: #0969da; text-decoration: none; }
    .diff { background: #161b22; color: #e6edf3; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; font-family: monospace; }
    .diff-add { color: #3fb950; }
    .diff-remove { color: #f85149; }
  </style>
</head>
<body>
  <h1><a href="${escapeHtml(issue.html_url)}">${escapeHtml(issue.title)}</a></h1>
`;

  if (includeMetadata) {
    html += `  <div class="metadata">
    State: <strong>${escapeHtml(issue.state)}</strong> | 
    Opened by: <strong>${escapeHtml(issue.user.login)}</strong> | 
    Created: <strong>${new Date(issue.created_at).toLocaleDateString()}</strong>
  </div>
`;
  }

  html += `  <div class="body">${issue.body ? escapeHtml(issue.body).replace(/\n/g, '<br>') : ''}</div>
`;

  if (includeDiff && diff) {
    const formattedDiff = escapeHtml(diff)
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return `<span class="diff-add">${line}</span>`;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          return `<span class="diff-remove">${line}</span>`;
        }
        return line;
      })
      .join('\n');
    html += `  <h2>Diff</h2>
  <pre class="diff">${formattedDiff}</pre>
`;
  }

  if (includeComments && comments && comments.length > 0) {
    html += `  <div class="comments">
    <h2>Comments (${comments.length})</h2>
`;
    for (const comment of comments) {
      html += `    <div class="comment">
      <div class="comment-header">
        <a href="${escapeHtml(comment.user.html_url)}">${escapeHtml(comment.user.login)}</a> 
        commented on ${new Date(comment.created_at).toLocaleDateString()}
      </div>
      <div class="comment-body">${escapeHtml(comment.body || '').replace(/\n/g, '<br>')}</div>
    </div>
`;
    }
    html += `  </div>
`;
  }

  html += `</body>
</html>`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}
