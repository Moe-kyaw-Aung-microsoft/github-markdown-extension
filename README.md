# GitHub Markdown Exporter

A browser extension that adds a "Copy to Markdown" button to GitHub issues and discussions, allowing you to easily export them to markdown format.

## Features

- **Automatic Detection**: Automatically detects when you're viewing a GitHub issue or discussion
- **One-Click Export**: Adds a "Copy to Markdown" button that exports the content with one click
- **No Token Required**: Works with public repositories without any setup
- **Private Repository Support**: Optional GitHub token support for private repositories
- **Rate Limit Protection**: Built-in rate limit detection and user guidance
- **Clean Markdown Output**: Uses the same template format as the original Python/Node.js tools

## Installation

### Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this extension folder
4. The extension is now installed and ready to use

### Firefox
1. Open Firefox and go to `about:debugging`
2. Click "This Firefox" in the sidebar
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from this extension folder
5. The extension is now installed and ready to use

## Usage

1. **Navigate to any GitHub issue or discussion**
   - Example: `https://github.com/owner/repo/issues/123`
   - Example: `https://github.com/owner/repo/discussions/456`

2. **Look for the "Copy to Markdown" button**
   - The button will automatically appear near other action buttons
   - It has a download icon and says "Copy to Markdown"

3. **Click the button**
   - The extension will fetch the issue/discussion data via GitHub API
   - Convert it to markdown format
   - Copy the result to your clipboard
   - Show a success message

4. **Paste the markdown anywhere you need it**
   - The markdown includes the title, body, all comments, and metadata
   - Formatted exactly like the original Python/Node.js tools

## GitHub Token Setup (Optional)

For private repositories or to avoid rate limits:

1. Click the extension icon in your browser toolbar
2. Enter your GitHub Personal Access Token
3. Click "Save Token"

### Creating a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "Markdown Exporter"
4. Select scopes: `repo` (for private repos) or `public_repo` (for public repos only)
5. Click "Generate token"
6. Copy the token and paste it into the extension popup

## Supported Pages

- GitHub Issues: `https://github.com/owner/repo/issues/number`
- GitHub Discussions: `https://github.com/owner/repo/discussions/number`

## Output Format

The exported markdown follows this structure:

```markdown
# [Issue Title](https://github.com/owner/repo/issues/123)

> state: **open** opened by: **username** on: **1/1/2024**

Issue body content here...

### Comments

---
> from: [**commenter**](https://github.com/commenter) on: **1/2/2024**

Comment body here...
```

## Troubleshooting

### "Export Failed" Messages

- **404 Error**: Issue/discussion not found or private (add a GitHub token)
- **403 Error**: Rate limit exceeded (add a GitHub token)
- **Network Error**: Check your internet connection

### Button Not Appearing

- Make sure you're on a GitHub issue or discussion page
- Refresh the page
- Check that the extension is enabled in your browser

### Private Repository Access

- You need a GitHub token with appropriate permissions
- Make sure the token has `repo` scope for private repositories
- Test the token in the extension popup

## Permissions

The extension requests these permissions:

- `activeTab`: To detect GitHub pages and add the export button
- `storage`: To save your GitHub token (optional)
- `clipboardWrite`: To copy markdown to clipboard
- `https://github.com/*`: To access GitHub pages
- `https://api.github.com/*`: To fetch issue/discussion data

## Privacy

- No data is collected or transmitted to external servers
- Your GitHub token is stored locally in your browser only
- API calls are made directly to GitHub from your browser

## Development

The extension consists of:

- `manifest.json`: Extension configuration
- `content.js`: Main functionality for detecting pages and exporting
- `popup.html/js`: Extension popup for token management
- `styles.css`: Styling for the export button

Based on the original Python and Node.js tools for exporting GitHub issues to markdown.