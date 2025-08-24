import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ThemeManager } from '../../src/services/theme-manager.js';

describe('ThemeManager', () => {
  let themeManager;
  let originalMatchMedia;
  let mockMatchMedia;

  beforeEach(() => {
    // Mock window.matchMedia
    mockMatchMedia = {
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => mockMatchMedia);

    // Setup DOM
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '';
    
    // Clear localStorage 
    localStorage.clear();

    themeManager = new ThemeManager();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('initialization', () => {
    test('should initialize with default auto theme', () => {
      expect(themeManager.currentTheme).toBe('auto');
    });

    test('should have all theme options available', () => {
      const expectedThemes = ['dark', 'light', 'auto'];
      expect(Object.keys(themeManager.themes)).toEqual(expectedThemes);
    });

    test('should set up media query listener', () => {
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    test('should load theme from localStorage if available', () => {
      localStorage.setItem('planningClub_theme', 'light');
      const newThemeManager = new ThemeManager();
      
      expect(newThemeManager.currentTheme).toBe('light');
      
      newThemeManager.destroy();
    });

    test('should default to auto theme when localStorage is not available', () => {
      localStorage.clear();
      const newThemeManager = new ThemeManager();
      
      expect(newThemeManager.currentTheme).toBe('auto');
      
      newThemeManager.destroy();
    });
  });

  describe('theme setting', () => {
    test('should set valid theme successfully', () => {
      const result = themeManager.setTheme('light');

      expect(result).toBe(true);
      expect(themeManager.currentTheme).toBe('light');
    });

    test('should reject invalid theme', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = themeManager.setTheme('invalid');

      expect(result).toBe(false);
      expect(themeManager.currentTheme).toBe('auto'); // Should remain unchanged
      expect(consoleSpy).toHaveBeenCalledWith('Unknown theme: invalid');
      
      consoleSpy.mockRestore();
    });

    test('should save theme to localStorage', () => {
      themeManager.setTheme('light');

      expect(localStorage.getItem('planningClub_theme')).toBe('light');
    });

    test('should emit themeChanged event', () => {
      const mockCallback = jest.fn();
      themeManager.on('themeChanged', mockCallback);

      themeManager.setTheme('light');

      expect(mockCallback).toHaveBeenCalledWith({
        theme: 'light',
        effectiveTheme: 'light'
      });
    });

    test('should apply CSS properties for light theme', () => {
      themeManager.setTheme('light');

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
      expect(root.style.getPropertyValue('--text-primary')).toBe('#1e293b');
    });

    test('should apply CSS properties for dark theme', () => {
      themeManager.setTheme('dark');

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--bg-primary')).toBe('#0c0c0c');
      expect(root.style.getPropertyValue('--text-primary')).toBe('#e2e8f0');
    });
  });

  describe('auto theme handling', () => {
    test('should return dark when system prefers dark', () => {
      mockMatchMedia.matches = true;
      
      const effectiveTheme = themeManager.getEffectiveTheme('auto');
      expect(effectiveTheme).toBe('dark');
    });

    test('should return light when system prefers light', () => {
      mockMatchMedia.matches = false;
      
      const effectiveTheme = themeManager.getEffectiveTheme('auto');
      expect(effectiveTheme).toBe('light');
    });

    test('should emit theme change when system theme changes and auto is selected', () => {
      themeManager.setTheme('auto');
      const mockCallback = jest.fn();
      themeManager.on('themeChanged', mockCallback);

      // Simulate system theme change
      const changeCallback = mockMatchMedia.addEventListener.mock.calls[0][1];
      changeCallback({ matches: true });

      expect(mockCallback).toHaveBeenCalledWith({
        theme: 'auto',
        effectiveTheme: 'dark'
      });
    });

    test('should not emit theme change when system changes but auto is not selected', () => {
      themeManager.setTheme('light');
      const mockCallback = jest.fn();
      themeManager.on('themeChanged', mockCallback);

      // Clear previous calls
      mockCallback.mockClear();

      // Simulate system theme change
      const changeCallback = mockMatchMedia.addEventListener.mock.calls[0][1];
      changeCallback({ matches: true });

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('theme toggling', () => {
    test('should cycle through all themes', () => {
      expect(themeManager.currentTheme).toBe('auto');

      let nextTheme = themeManager.toggleTheme();
      expect(nextTheme).toBe('dark');
      expect(themeManager.currentTheme).toBe('dark');

      nextTheme = themeManager.toggleTheme();
      expect(nextTheme).toBe('light');
      expect(themeManager.currentTheme).toBe('light');

      nextTheme = themeManager.toggleTheme();
      expect(nextTheme).toBe('auto');
      expect(themeManager.currentTheme).toBe('auto');
    });
  });

  describe('theme information', () => {
    test('should return current theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getCurrentTheme()).toBe('light');
    });

    test('should return effective theme info', () => {
      mockMatchMedia.matches = true;
      themeManager.setTheme('auto');

      const info = themeManager.getEffectiveThemeInfo();

      expect(info.current).toBe('auto');
      expect(info.effective).toBe('dark');
      expect(info.isAuto).toBe(true);
      expect(info.info.name).toBe('Dark');
    });

    test('should return theme list with current and effective markers', () => {
      mockMatchMedia.matches = false;
      themeManager.setTheme('auto');

      const themeList = themeManager.getThemeList();

      expect(themeList).toHaveLength(3);
      
      const autoTheme = themeList.find(t => t.key === 'auto');
      expect(autoTheme.isCurrent).toBe(true);
      expect(autoTheme.isEffective).toBe(false); // effective is light, not auto

      const lightTheme = themeList.find(t => t.key === 'light');
      expect(lightTheme.isCurrent).toBe(false);
      expect(lightTheme.isEffective).toBe(true);
    });
  });

  describe('background gradient updates', () => {
    test('should set light background gradient for light theme', () => {
      themeManager.setTheme('light');
      
      const expectedGradient = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)';
      expect(document.body.style.background).toBe(expectedGradient);
    });

    test('should set dark background gradient for dark theme', () => {
      themeManager.setTheme('dark');
      
      const expectedGradient = 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #0c0c0c 100%)';
      expect(document.body.style.background).toBe(expectedGradient);
    });
  });

  describe('event system', () => {
    test('should add and remove event listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      themeManager.on('test', callback1);
      themeManager.on('test', callback2);

      themeManager.emit('test', { data: 'test' });

      expect(callback1).toHaveBeenCalledWith({ data: 'test' });
      expect(callback2).toHaveBeenCalledWith({ data: 'test' });

      themeManager.off('test', callback1);
      callback1.mockClear();
      callback2.mockClear();

      themeManager.emit('test', { data: 'test2' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith({ data: 'test2' });
    });

    test('should handle errors in event callbacks gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const errorCallback = jest.fn(() => { throw new Error('Test error'); });
      const normalCallback = jest.fn();

      themeManager.on('test', errorCallback);
      themeManager.on('test', normalCallback);

      themeManager.emit('test', {});

      expect(consoleSpy).toHaveBeenCalledWith('Error in theme manager event handler:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalled(); // Should still execute

      consoleSpy.mockRestore();
    });
  });

  describe('localStorage error handling', () => {
    test('should handle localStorage read errors gracefully', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn(() => { throw new Error('Storage error'); });

      const theme = themeManager.getStoredTheme();

      expect(theme).toBe('auto'); // Should fall back to default

      localStorage.getItem = originalGetItem;
    });
  });

  describe('cleanup', () => {
    test('should remove media query listener on destroy', () => {
      themeManager.destroy();

      expect(mockMatchMedia.removeEventListener).toHaveBeenCalledWith('change', themeManager.handleSystemThemeChange);
    });
  });
});