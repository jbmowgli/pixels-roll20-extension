'use strict';

//
// CSS Loader Utility - Loads external CSS files into the page
//

// Track loaded CSS files to prevent duplicates
const loadedCSS = new Set<string>();

/**
 * Load a single CSS file into the document head
 */
export const loadCSS = (cssPath: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (loadedCSS.has(id)) {
      console.log(`CSS already loaded: ${id}`);
      resolve();
      return;
    }

    // Remove existing element if it exists
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    // For Chrome extensions, we need to get the full URL
    const fullPath = chrome.runtime ? chrome.runtime.getURL(cssPath) : cssPath;

    // Fetch the CSS content and inject it
    fetch(fullPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load CSS: ${response.status}`);
        }
        return response.text();
      })
      .then(cssText => {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = cssText;
        document.head.appendChild(style);

        loadedCSS.add(id);
        console.log(`CSS loaded successfully: ${id}`);
        resolve();
      })
      .catch(error => {
        console.error(`Failed to load CSS ${cssPath}:`, error);
        reject(error as Error);
      });
  });
};

interface CSSFileDescriptor {
  path: string;
  id: string;
}

/**
 * Load multiple CSS files
 */
export const loadMultipleCSS = (
  cssFiles: CSSFileDescriptor[]
): Promise<void[]> => {
  const promises = cssFiles.map(({ path, id }) => loadCSS(path, id));
  return Promise.all(promises);
};

/**
 * Remove a loaded CSS file
 */
export const removeCSS = (id: string): void => {
  const element = document.getElementById(id);
  if (element) {
    element.remove();
    loadedCSS.delete(id);
    console.log(`CSS removed: ${id}`);
  }
};

/**
 * Check if a CSS file is loaded
 */
export const isLoaded = (id: string): boolean => {
  return loadedCSS.has(id);
};

// Default export with all functions
const CSSLoader = {
  loadCSS,
  loadMultipleCSS,
  removeCSS,
  isLoaded,
};

export default CSSLoader;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.CSSLoader = CSSLoader;
}

console.log('CSSLoader utility initialized');
