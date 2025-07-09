'use strict';

//
// CSS Loader Utility - Loads external CSS files into the page
//
(function () {
  // Track loaded CSS files to prevent duplicates
  const loadedCSS = new Set();

  // Export functions to global scope
  window.CSSLoader = {
    loadCSS: loadCSS,
    loadMultipleCSS: loadMultipleCSS,
    removeCSS: removeCSS,
    isLoaded: isLoaded,
  };

  /**
   * Load a single CSS file into the document head
   * @param {string} cssPath - Path to the CSS file
   * @param {string} id - Unique ID for the style element
   * @returns {Promise} - Resolves when CSS is loaded
   */
  function loadCSS(cssPath, id) {
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
      const fullPath = chrome.runtime
        ? chrome.runtime.getURL(cssPath)
        : cssPath;

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
          reject(error);
        });
    });
  }

  /**
   * Load multiple CSS files
   * @param {Array} cssFiles - Array of {path, id} objects
   * @returns {Promise} - Resolves when all CSS files are loaded
   */
  function loadMultipleCSS(cssFiles) {
    const promises = cssFiles.map(({ path, id }) => loadCSS(path, id));
    return Promise.all(promises);
  }

  /**
   * Remove a loaded CSS file
   * @param {string} id - ID of the CSS to remove
   */
  function removeCSS(id) {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
      loadedCSS.delete(id);
      console.log(`CSS removed: ${id}`);
    }
  }

  /**
   * Check if a CSS file is loaded
   * @param {string} id - ID of the CSS to check
   * @returns {boolean} - True if loaded
   */
  function isLoaded(id) {
    return loadedCSS.has(id);
  }

  console.log('CSSLoader utility initialized');
})();
