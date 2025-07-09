// Theme detection utility for Roll20
// This file contains functions to detect Roll20's current theme and monitor changes

(function () {
  'use strict';

  // Roll20 theme detection
  const ThemeDetector = {
    // Detect current Roll20 theme
    detectTheme() {
      // First priority: Check Roll20's localStorage colorTheme setting
      try {
        const roll20Theme = localStorage.getItem('colorTheme');
        if (roll20Theme === 'dark' || roll20Theme === 'light') {
          console.log(`Theme detected from Roll20 localStorage: ${roll20Theme}`);
          return roll20Theme;
        } else if (roll20Theme) {
          console.log(`Unexpected Roll20 theme value: ${roll20Theme}, falling back to other detection`);
        } else {
          console.log('No colorTheme found in localStorage, falling back to other detection');
        }
      } catch (error) {
        console.warn('Could not access Roll20 localStorage colorTheme:', error);
      }

      // Second priority: Check for Roll20's theme classes on body or html
      const body = document.body;
      const html = document.documentElement;

      // Roll20 typically uses these selectors for themes
      if (
        body.classList.contains('darkmode') ||
        html.classList.contains('darkmode')
      ) {
        return 'dark';
      }
      if (
        body.classList.contains('lightmode') ||
        html.classList.contains('lightmode')
      ) {
        return 'light';
      }

      // Check for data attributes
      if (body.dataset.theme) {
        return body.dataset.theme;
      }
      if (html.dataset.theme) {
        return html.dataset.theme;
      }

      // Check CSS custom properties
      const computedStyle = getComputedStyle(document.documentElement);
      const bgColor =
        computedStyle.getPropertyValue('--background-color') ||
        computedStyle.getPropertyValue('--main-bg') ||
        computedStyle.backgroundColor;

      // Analyze background color to determine theme
      if (bgColor) {
        const rgb = this.parseColor(bgColor);
        if (rgb) {
          const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
          return brightness < 128 ? 'dark' : 'light';
        }
      }

      // Check Roll20's chat container styles as fallback
      const chatContainer = document.querySelector(
        '.textchatcontainer, #textchat'
      );
      if (chatContainer) {
        const chatStyle = getComputedStyle(chatContainer);
        const chatBg = chatStyle.backgroundColor;
        if (chatBg) {
          const rgb = this.parseColor(chatBg);
          if (rgb) {
            const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
            return brightness < 128 ? 'dark' : 'light';
          }
        }
      }

      // Default fallback
      return 'dark';
    },

    // Parse color string to RGB values
    parseColor(colorStr) {
      if (!colorStr) return null;

      // Handle rgb() format
      const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        return {
          r: parseInt(rgbMatch[1]),
          g: parseInt(rgbMatch[2]),
          b: parseInt(rgbMatch[3]),
        };
      }

      // Handle rgba() format
      const rgbaMatch = colorStr.match(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/
      );
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1]),
          g: parseInt(rgbaMatch[2]),
          b: parseInt(rgbaMatch[3]),
        };
      }

      // Handle hex format
      const hexMatch = colorStr.match(
        /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
      );
      if (hexMatch) {
        return {
          r: parseInt(hexMatch[1], 16),
          g: parseInt(hexMatch[2], 16),
          b: parseInt(hexMatch[3], 16),
        };
      }

      return null;
    },

    // Get Roll20 theme colors
    getThemeColors() {
      const theme = this.detectTheme();
      console.log(`Getting theme colors for detected theme: ${theme}`);

      // Define static, clean theme colors
      const colors = theme === 'dark' ? {
        theme: 'dark',
        primary: '#4CAF50',
        background: '#2b2b2b',
        surface: '#1e1e1e',
        border: '#444444',
        text: '#ffffff',
        textSecondary: '#cccccc',
        input: '#333333',
        inputBorder: '#555555',
        button: '#404040',
        buttonHover: '#505050',
      } : {
        theme: 'light',
        primary: '#4CAF50',
        background: '#ffffff',
        surface: '#f8f9fa',
        border: '#dee2e6',
        text: '#212529',
        textSecondary: '#6c757d',
        input: '#ffffff',
        inputBorder: '#ced4da',
        button: 'rgb(248, 249, 250)',
        buttonHover: '#e9ecef',
      };

      console.log('Final theme colors:', colors);
      return colors;
    },

    // Monitor theme changes
    onThemeChange(callback) {
      let currentTheme = this.detectTheme();

      // Monitor localStorage changes for Roll20's colorTheme
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        if (key === 'colorTheme' && (value === 'dark' || value === 'light')) {
          const newTheme = value;
          if (newTheme !== currentTheme) {
            currentTheme = newTheme;
            console.log(`Theme changed via localStorage: ${newTheme}`);
            callback(newTheme, ThemeDetector.getThemeColors());
          }
        }
        return originalSetItem.apply(this, arguments);
      };

      // Listen for storage events (changes from other tabs/windows)
      window.addEventListener('storage', (e) => {
        if (e.key === 'colorTheme' && (e.newValue === 'dark' || e.newValue === 'light')) {
          const newTheme = e.newValue;
          if (newTheme !== currentTheme) {
            currentTheme = newTheme;
            console.log(`Theme changed via storage event: ${newTheme}`);
            callback(newTheme, ThemeDetector.getThemeColors());
          }
        }
      });

      // Create mutation observer to watch for theme changes (fallback)
      const observer = new MutationObserver(mutations => {
        const newTheme = this.detectTheme();
        if (newTheme !== currentTheme) {
          currentTheme = newTheme;
          callback(newTheme, this.getThemeColors());
        }
      });

      // Watch for class changes on body and html
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });

      // Also watch for style changes in head
      const head = document.head;
      if (head) {
        observer.observe(head, {
          childList: true,
          subtree: true,
        });
      }

      return observer;
    },
  };

  // Export to global scope
  window.ThemeDetector = ThemeDetector;

  console.log('ThemeDetector module initialized');
})();
