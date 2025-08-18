<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->

[![GitHub Issues][issues-shield]][issues-url]
[![GitHub License][license-shield]][license-url]
[![Chrome Web Store][chrome-shield]][chrome-url]
[![Firefox Add-ons][firefox-shield]][firefox-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/your-username/github-markdown-extension">
    <img src="src/icons/icon128-dark.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">GitHub Markdown Exporter</h3>

  <p align="center">
    Export GitHub issues, discussions, and pull requests to markdown with one click! ✨
    <br />
    <a href="#usage"><strong>See it in action »</strong></a>
    <br />
    <br />
    <a href="#installation">Quick Install</a>
    ·
    <a href="https://github.com/your-username/github-markdown-extension/issues">Report Bug</a>
    ·
    <a href="https://github.com/your-username/github-markdown-extension/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

<div align="center">
  <img src="demo.gif" alt="GitHub Markdown Exporter Demo" width="600">
</div>

Ever wanted to save GitHub issues, discussions, or pull requests for offline reading or documentation? This browser extension adds a "Copy to Markdown" button with powerful export options - including complete content, comments, metadata, and even pull request diffs!

**Why this extension?**

- 🚀 **One-click export** - Copy to clipboard or download as file
- 📱 **Works everywhere** - Issues, discussions, and pull requests
- 🎨 **Beautiful output** - Clean, readable markdown with full formatting
- 🤖 **AI Integration** - Open directly in ChatGPT, Claude, or T3 Chat
- 📊 **Complete Data** - Includes all comments, metadata, and PR diffs
- 🌗 **Theme-aware** - Extension icon adapts to your browser theme
- 🔒 **Privacy-first** - No data collection, everything stays local

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Features

### ✨ Core Features

- **🎯 Smart Detection** - Automatically detects GitHub issues, discussions, and pull requests
- **📋 Multiple Export Options** - Copy to clipboard, download as file, or open in AI platforms
- **🤖 AI Platform Integration** - One-click export to ChatGPT, Claude, or T3 Chat for analysis
- **🔄 Real-time Navigation** - Works with GitHub's single-page app navigation
- **🌙 Theme-Aware Icons** - Extension icon automatically matches your browser theme

### 🛠️ Advanced Features

- **🔐 Private Repository Support** - Optional GitHub token for private repos
- **📊 Complete Content Export** - Includes all comments, metadata, and pull request diffs
- **⚡ Rate Limit Protection** - Built-in handling for GitHub API limits
- **🎨 Professional Markdown** - Clean formatting with proper structure and metadata
- **🔧 Cross-Browser Support** - Works on Chrome, Firefox, and Safari
- **📱 Mobile Responsive** - Button placement adapts to mobile and desktop layouts

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Installation

### Chrome

1. Download the extension from the [Chrome Web Store][chrome-url]
2. Click "Add to Chrome"
3. You're ready to go! 🎉

### Firefox

1. Download from [Firefox Add-ons][firefox-url]
2. Click "Add to Firefox"
3. Start exporting! 🔥

### Manual Installation (Developer Mode)

<details>
<summary>Click to expand manual installation steps</summary>

#### Chrome

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `src` folder
5. The extension is now installed! ✅

#### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the `src` folder
6. Ready to use! 🚀

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

### Basic Usage

1. **Navigate to any GitHub issue, discussion, or pull request**

   ```
   https://github.com/owner/repo/issues/123
   https://github.com/owner/repo/discussions/456
   https://github.com/owner/repo/pull/789
   ```

2. **Look for the "Copy to Markdown" button**

   - Appears automatically near other action buttons
   - Has a dropdown arrow for additional options
   - Button adapts to mobile and desktop layouts

3. **Choose your export option:**

   - **Main button**: Copy to clipboard instantly 📋
   - **Dropdown menu**:
     - 💾 **Save as File** - Download markdown file
     - 🤖 **Open in ChatGPT** - Send content to ChatGPT for analysis
     - 🧠 **Open in Claude** - Open in Claude AI
     - 💬 **Open in T3 Chat** - Export to T3 Chat platform

4. **For Pull Requests**: Automatically includes diff information along with comments and discussions

### Extension Popup Features

Access additional functionality through the extension popup:

1. **Token Management** - Set up GitHub tokens for private repositories
2. **Current Page Export** - Export the current page you're viewing
3. **Quick Access** - All export options available from the popup

### Private Repositories

For private repositories, you'll need a GitHub token:

1. Click the extension icon in your browser toolbar
2. Enter your [GitHub Personal Access Token](https://github.com/settings/tokens)
3. Click "Save Token"

**Token Requirements:**

- `repo` scope for private repositories
- `public_repo` scope for public repositories only

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Example Output

The extension generates clean, professional markdown with complete content:

```markdown
# [Amazing Feature Request](https://github.com/owner/repo/issues/123)

> state: **open** opened by: **johndoe** on: **15/01/2024**

This would be an amazing feature to add...

### Pull Request Diff

```diff
@@ -1,3 +1,4 @@
 function example() {
+  // Added new functionality
   return true;
 }
```

### Comments

---

> from: [**contributor**](https://github.com/contributor) on: **16/01/2024**

Great idea! I think we should also consider...
```

**Features included in export:**
- 📋 **Complete metadata** - State, author, dates, and links
- 💬 **All comments** - Including author information and timestamps  
- 🔄 **Pull request diffs** - Full code changes when exporting PRs
- 🎨 **Clean formatting** - Professional markdown structure
- 🔗 **Preserved links** - All GitHub links remain functional

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions make the open source community amazing! Any contributions are **greatly appreciated** 🙌

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/github-markdown-extension.git

# Load the extension in developer mode
# Chrome: chrome://extensions/ → Enable Developer Mode → Load unpacked
# Firefox: about:debugging → Load Temporary Add-on
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<div align="center">
  <p>Made with ❤️ for the GitHub community</p>
  <p>
    <a href="#readme-top">↑ Back to top</a>
  </p>
</div>

<!-- MARKDOWN LINKS & IMAGES -->

[issues-shield]: https://img.shields.io/github/issues/your-username/github-markdown-extension.svg?style=for-the-badge
[issues-url]: https://github.com/your-username/github-markdown-extension/issues
[license-shield]: https://img.shields.io/github/license/your-username/github-markdown-extension.svg?style=for-the-badge
[license-url]: https://github.com/your-username/github-markdown-extension/blob/main/LICENSE
[chrome-shield]: https://img.shields.io/chrome-web-store/v/your-extension-id?style=for-the-badge&logo=googlechrome
[chrome-url]: https://chrome.google.com/webstore/detail/your-extension-id
[firefox-shield]: https://img.shields.io/amo/v/your-extension-id?style=for-the-badge&logo=firefox
[firefox-url]: https://addons.mozilla.org/firefox/addon/your-extension-slug/
