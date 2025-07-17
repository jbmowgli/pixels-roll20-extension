'use strict';

//
// HTML Template Loader Utility - Loads external HTML files into components
//

// Track loaded templates to prevent duplicates
const loadedTemplates = new Map();

/**
 * Load a single HTML template file
 * @param {string} templatePath - Path to the HTML template file
 * @param {string} id - Unique ID for the template
 * @returns {Promise<string>} - Resolves with the HTML content
 */
export const loadTemplate = (templatePath, id) => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (loadedTemplates.has(id)) {
      console.log(`Template already loaded: ${id}`);
      resolve(loadedTemplates.get(id));
      return;
    }

    // For Chrome extensions, we need to get the full URL
    let fullPath;
    try {
      if (chrome && chrome.runtime && chrome.runtime.getURL) {
        fullPath = chrome.runtime.getURL(templatePath);
      } else {
        throw new Error('Chrome runtime not available');
      }
    } catch (error) {
      console.error('Error getting chrome extension URL:', error);
      reject(
        new Error(`Chrome extension context not available: ${error.message}`)
      );
      return;
    }

    console.log(`Loading template from: ${fullPath}`);

    // Fetch the HTML content
    fetch(fullPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.status}`);
        }
        return response.text();
      })
      .then(htmlContent => {
        loadedTemplates.set(id, htmlContent);
        console.log(`Template loaded successfully: ${id}`);
        resolve(htmlContent);
      })
      .catch(error => {
        console.error(`Failed to load template ${templatePath}:`, error);
        reject(error);
      });
  });
};

/**
 * Load multiple HTML templates
 * @param {Array} templates - Array of {path, id} objects
 * @returns {Promise} - Resolves when all templates are loaded
 */
export const loadMultipleTemplates = templates => {
  const promises = templates.map(({ path, id }) => loadTemplate(path, id));
  return Promise.all(promises);
};

/**
 * Check if a template is loaded
 * @param {string} id - ID of the template to check
 * @returns {boolean} - True if loaded
 */
export const isLoaded = id => {
  return loadedTemplates.has(id);
};

/**
 * Get a loaded template
 * @param {string} id - ID of the template to retrieve
 * @returns {string|null} - The HTML content or null if not loaded
 */
export const getTemplate = id => {
  return loadedTemplates.get(id) || null;
};

// Default export with all functions
const HTMLLoader = {
  loadTemplate,
  loadMultipleTemplates,
  isLoaded,
  getTemplate,
};

export default HTMLLoader;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.HTMLLoader = HTMLLoader;
}

console.log('HTMLLoader utility initialized');
