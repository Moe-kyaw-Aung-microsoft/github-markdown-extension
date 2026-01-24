/**
 * Feature Manager - Declarative feature registration system
 * 
 * Inspired by refined-github's architecture, this module provides:
 * - Declarative feature registration with include/exclude patterns
 * - Automatic cleanup via AbortSignal on SPA navigation
 * - Turbo/PJAX navigation handling for GitHub's SPA
 */

import * as pageDetect from './page-detect';

export type PageDetector = () => boolean;
export type FeatureInit = (signal: AbortSignal) => void | false | Promise<void | false>;

export interface FeatureConfig {
  /** Page detectors that must return true for feature to run */
  include?: PageDetector[];
  /** Page detectors that if any return true, feature won't run */
  exclude?: PageDetector[];
  /** Prerequisites that must all be true for feature to run */
  asLongAs?: PageDetector[];
  /** Feature initialization function, receives AbortSignal for cleanup */
  init: FeatureInit;
  /** Wait for DOMContentLoaded before running (default: true) */
  awaitDomReady?: boolean;
}

interface RegisteredFeature {
  id: string;
  config: FeatureConfig;
  controller: AbortController | null;
}

const registeredFeatures = new Map<string, RegisteredFeature>();
let navigationCleanupRegistered = false;

/**
 * Unload all features - aborts all active controllers
 */
function unloadAll(): void {
  for (const feature of registeredFeatures.values()) {
    if (feature.controller) {
      feature.controller.abort();
      feature.controller = null;
    }
  }
}

/**
 * Setup navigation listeners for GitHub's SPA
 */
function setupNavigationListeners(): void {
  if (navigationCleanupRegistered) return;
  navigationCleanupRegistered = true;

  let currentUrl = window.location.href;

  const handleNavigation = () => {
    unloadAll();
    setTimeout(() => runAllFeatures(), 800);
  };

  // Turbo navigation events (GitHub uses Turbo)
  document.addEventListener('turbo:before-fetch-request', unloadAll);
  document.addEventListener('turbo:visit', unloadAll);

  // Re-run features after navigation completes with delay for DOM to settle
  document.addEventListener('turbo:load', () => {
    currentUrl = window.location.href;
    setTimeout(() => runAllFeatures(), 800);
  });
  document.addEventListener('turbo:render', () => {
    currentUrl = window.location.href;
    setTimeout(() => runAllFeatures(), 800);
  });

  // Handle browser back/forward navigation
  window.addEventListener('popstate', handleNavigation);

  // Intercept pushState/replaceState for programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    currentUrl = window.location.href;
    handleNavigation();
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    currentUrl = window.location.href;
    handleNavigation();
    return result;
  };

  // MutationObserver to detect URL changes (backup method)
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      console.log('[FeatureManager] URL change detected via mutation:', window.location.href);
      currentUrl = window.location.href;
      handleNavigation();
    }
  });

  // Start observing once body is available
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Periodic URL check as final fallback
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      console.log('[FeatureManager] URL change detected via polling:', window.location.href);
      currentUrl = window.location.href;
      handleNavigation();
    }
  }, 2000);

  console.log('[FeatureManager] Navigation listeners registered');
}

/**
 * Check if a feature should run on the current page
 */
function shouldRunFeature(config: FeatureConfig): boolean {
  // Check prerequisites (all must be true)
  if (config.asLongAs && !config.asLongAs.every(fn => fn())) {
    return false;
  }

  // Check include (at least one must be true, if specified)
  if (config.include && config.include.length > 0) {
    if (!config.include.some(fn => fn())) {
      return false;
    }
  }

  // Check exclude (none must be true)
  if (config.exclude && config.exclude.some(fn => fn())) {
    return false;
  }

  return true;
}

/**
 * Run a single feature
 */
async function runFeature(feature: RegisteredFeature): Promise<void> {
  const { id, config } = feature;

  // Check if feature should run on this page
  if (!shouldRunFeature(config)) {
    return;
  }

  // Abort any existing controller for this feature
  if (feature.controller) {
    feature.controller.abort();
  }

  // Create new controller for this run
  const controller = new AbortController();
  feature.controller = controller;

  try {
    const result = await config.init(controller.signal);

    if (result === false) {
      // Feature indicated it didn't run (e.g., element not found)
      controller.abort();
      feature.controller = null;
    }
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[FeatureManager] Feature "${id}" failed:`, error);
    }
  }
}

/**
 * Run all registered features
 */
async function runAllFeatures(): Promise<void> {
  console.log('[FeatureManager] Running all features, readyState:', document.readyState);

  // Wait for body to exist
  if (!document.body) {
    await new Promise<void>(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
      } else {
        // DOM is ready but body might not be - use mutation observer
        const bodyCheck = setInterval(() => {
          if (document.body) {
            clearInterval(bodyCheck);
            resolve();
          }
        }, 10);
      }
    });
  }

  console.log('[FeatureManager] DOM ready, running features');

  for (const feature of registeredFeatures.values()) {
    runFeature(feature);
  }
}

/**
 * Add a new feature
 * 
 * @param id - Unique identifier for the feature (typically import.meta.url)
 * @param config - Feature configuration
 * 
 * @example
 * ```ts
 * features.add('issue-export', {
 *   include: [pageDetect.isIssue, pageDetect.isPR],
 *   exclude: [pageDetect.isArchivedRepo],
 *   init(signal) {
 *     observe('.issue-header', addExportButton, { signal });
 *   },
 * });
 * ```
 */
function add(id: string, config: FeatureConfig): void {
  // Extract feature name from path if using import.meta.url
  const featureId = id.includes('/')
    ? id.split('/').pop()?.replace(/\.[jt]sx?$/, '') ?? id
    : id;

  if (registeredFeatures.has(featureId)) {
    console.warn(`[FeatureManager] Feature "${featureId}" already registered, skipping`);
    return;
  }

  registeredFeatures.set(featureId, {
    id: featureId,
    config: {
      awaitDomReady: true, // Default to waiting for DOM
      ...config,
    },
    controller: null,
  });

  console.log(`[FeatureManager] Registered feature: ${featureId}`);

  // Setup navigation listeners on first feature registration
  setupNavigationListeners();

  // Run the feature - handle both immediate and delayed DOM availability
  const feature = registeredFeatures.get(featureId)!;

  if (document.readyState === 'loading') {
    // Wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      runFeature(feature);
    }, { once: true });
  } else if (!document.body) {
    // DOM is supposedly ready but body isn't - poll for it
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        runFeature(feature);
      }
    }, 10);
  } else {
    // Everything is ready, run immediately
    runFeature(feature);
  }
}

/**
 * Remove a feature
 */
function remove(id: string): void {
  const feature = registeredFeatures.get(id);
  if (feature) {
    if (feature.controller) {
      feature.controller.abort();
    }
    registeredFeatures.delete(id);
    console.log(`[FeatureManager] Removed feature: ${id}`);
  }
}

/**
 * Get list of registered feature IDs
 */
function list(): string[] {
  return Array.from(registeredFeatures.keys());
}

// Export the features API
export default {
  add,
  remove,
  list,
  unloadAll,
  pageDetect,
};

// Also export pageDetect for convenience
export { pageDetect };
