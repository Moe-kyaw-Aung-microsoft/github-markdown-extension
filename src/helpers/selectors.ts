/**
 * Centralized DOM Selectors
 * 
 * All CSS selectors used by the extension are defined here.
 * This makes maintenance easier and allows for testing.
 */

// ============================================================================
// Issue Page Selectors
// ============================================================================

/** Issue header actions container (desktop) */
export const issueActionsDesktop = [
  '[data-component="PH_Actions"] .HeaderMenu-module__menuActionsContainer--Gf9W9',
  '.prc-PageHeader-Actions-ygtmj .HeaderMenu-module__menuActionsContainer--Gf9W9',
  '.HeaderViewer-module__PageHeader_Actions--SRZVA .HeaderMenu-module__menuActionsContainer--Gf9W9',
] as const;

/** Issue header actions container (mobile) */
export const issueActionsMobile = [
  '.prc-PageHeader-ContextAreaActions-RTJRk .HeaderMenu-module__menuActionsContainer--Gf9W9',
  '.HeaderViewer-module__PageHeader_ContextAreaActions--zjX2m .HeaderMenu-module__menuActionsContainer--Gf9W9',
] as const;

/** New issue button container (to insert our button after) */
export const newIssueButtonContainer = '.HeaderMenu-module__buttonContainer--Nazjm';

/** New issue button link */
export const newIssueButton = 'a[href$="/issues/new"], a[data-hotkey="c"]';

// ============================================================================
// Pull Request Page Selectors
// ============================================================================

/** PR/Discussion header actions container */
export const prActionsContainer = '.gh-header-actions';

/** Code button container */
export const codeButtonContainer = 'get-repo, .flex-md-order-2';

/** Jump to bottom link */
export const jumpToBottomLink = '.flex-auto.text-right.d-block.d-md-none';

// ============================================================================
// Wiki Page Selectors  
// ============================================================================

/** Wiki sidebar containers */
export const wikiSidebar = [
  '.Layout-sidebar',
  '.wiki-pages-box',
  '.wiki-rightbar .wiki-pages-box',
] as const;

/** Wiki content areas */
export const wikiContent = [
  '#wiki-wrapper',
  '.repository-content .wiki-body',
  '.markdown-body',
] as const;

/** Wiki header areas */
export const wikiHeader = [
  '.gh-header-actions',
  '#wiki-wrapper .gh-header',
  '.repository-content .gh-header',
] as const;

/** Wiki page title */
export const wikiTitle = [
  '#wiki-wrapper h1',
  '.gh-header-title',
  '.wiki-title',
] as const;

/** Wiki page links in sidebar */
export const wikiPageLinks = [
  '.wiki-pages-box a',
  '.wiki-rightbar a[href*="/wiki/"]',
  '.Layout-sidebar a[href*="/wiki/"]',
] as const;

// ============================================================================
// Common Selectors
// ============================================================================

/** GitHub button component */
export const buttonComponent = '[data-component="Button"][data-size="medium"], [data-component="Button"]';

/** Edit button */
export const editButton = '[data-testid="edit-issue-title-button"], .js-title-edit-button, .js-details-target[aria-label*="Edit"]';

/** Title elements */
export const titleElements = [
  'h1[data-component="PH_Title"]',
  'h1[class*="prc-PageHeader-Title"]',
  'h1.gh-header-title',
  '.js-issue-title',
  '[data-testid="issue-title"]',
] as const;

/** Markdown body content */
export const markdownBody = '.markdown-body';

// ============================================================================
// Our Extension's Selectors
// ============================================================================

/** Prefix for all our element IDs */
export const EXTENSION_PREFIX = 'github-markdown-export';

/** Export button group */
export const exportButtonGroup = `[id^="${EXTENSION_PREFIX}-btn"][id$="-group"]`;

/** Export button (main button) */
export const exportButton = `[id^="${EXTENSION_PREFIX}-btn"]:not([id$="-group"]):not([id$="-dropdown"]):not([id$="-menu"])`;

/** Dropdown button */
export const exportDropdownButton = `[id$="-dropdown"]`;

/** Dropdown menu */
export const exportDropdownMenu = `[id$="-menu"]`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Try multiple selectors and return the first match
 */
export function selectFirst(selectors: readonly string[] | string[], context: ParentNode = document): Element | null {
  for (const selector of selectors) {
    const element = context.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Try multiple selectors and return all matches
 */
export function selectAllFrom(selectors: readonly string[] | string[], context: ParentNode = document): Element[] {
  const results: Element[] = [];
  for (const selector of selectors) {
    results.push(...context.querySelectorAll(selector));
  }
  return results;
}

/**
 * Check if any selector matches
 */
export function anyExists(selectors: readonly string[] | string[]): boolean {
  return selectFirst(selectors) !== null;
}
