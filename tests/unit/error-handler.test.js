import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ErrorHandler } from '../../src/services/error-handler.js';

describe('ErrorHandler', () => {
  let errorHandler;
  let mockUIManager;
  let originalAddEventListener;
  let originalLocalStorage;

  beforeEach(() => {
    // Mock UI Manager
    mockUIManager = {
      showErrorToast: jest.fn(),
      showErrorModal: jest.fn(),
    };

    // Mock window.addEventListener
    originalAddEventListener = window.addEventListener;
    window.addEventListener = jest.fn();

    // Mock localStorage
    originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      keys: jest.fn().mockReturnValue([]),
    };

    // Mock navigator
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Test Browser',
      configurable: true
    });

    errorHandler = new ErrorHandler(mockUIManager);
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    global.localStorage = originalLocalStorage;
    if (errorHandler) {
      errorHandler.clearErrorLog();
    }
  });

  describe('initialization', () => {
    test('should set up global error handling', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    test('should initialize with empty error log', () => {
      expect(errorHandler.errorLog).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    test('should handle basic errors', () => {
      const error = new Error('Test error');
      errorHandler.handleError(error, { type: 'test' });

      expect(errorHandler.errorLog).toHaveLength(1);
      expect(errorHandler.errorLog[0].message).toBe('Test error');
      expect(errorHandler.errorLog[0].context.type).toBe('test');
    });

    test('should handle errors without message', () => {
      errorHandler.handleError(null);

      expect(errorHandler.errorLog).toHaveLength(1);
      expect(errorHandler.errorLog[0].message).toBe('Unknown error');
    });

    test('should store error in localStorage', () => {
      const error = new Error('Test error');
      errorHandler.handleError(error);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'planningClub_errorLog',
        expect.stringContaining('Test error')
      );
    });
  });

  describe('user-friendly messages', () => {
    test('should categorize network errors', () => {
      const error = new Error('fetch failed');
      const message = errorHandler.getUserFriendlyMessage(error, {});

      expect(message.type).toBe('network');
      expect(message.title).toBe('Connection Issue');
      expect(message.action).toBe('retry');
    });

    test('should categorize peer connection errors', () => {
      const error = new Error('WebRTC connection failed');
      const message = errorHandler.getUserFriendlyMessage(error, {});

      expect(message.type).toBe('peer');
      expect(message.title).toBe('Connection Problem');
      expect(message.action).toBe('refresh');
    });

    test('should categorize storage errors', () => {
      const error = new Error('localStorage quota exceeded');
      const message = errorHandler.getUserFriendlyMessage(error, {});

      expect(message.type).toBe('storage');
      expect(message.title).toBe('Storage Full');
      expect(message.action).toBe('clear_data');
    });

    test('should categorize application errors', () => {
      const error = new Error('TypeError in planning code');
      const context = { type: 'javascript', filename: 'planning-club.js' };
      const message = errorHandler.getUserFriendlyMessage(error, context);

      expect(message.type).toBe('application');
      expect(message.title).toBe('Application Error');
      expect(message.action).toBe('auto_refresh');
    });

    test('should provide generic message for unknown errors', () => {
      const error = new Error('Some random error');
      const message = errorHandler.getUserFriendlyMessage(error, {});

      expect(message.type).toBe('generic');
      expect(message.title).toBe('Something went wrong');
      expect(message.action).toBe('dismiss');
    });
  });

  describe('error display', () => {
    test('should show toast for warnings', () => {
      const error = new Error('fetch failed');
      errorHandler.handleError(error);

      expect(mockUIManager.showErrorToast).toHaveBeenCalled();
      expect(mockUIManager.showErrorModal).not.toHaveBeenCalled();
    });

    test('should show modal for critical errors', () => {
      const error = new Error('critical application error');
      const context = { type: 'javascript', filename: 'planning-club.js' };
      errorHandler.handleError(error, context);

      expect(mockUIManager.showErrorModal).toHaveBeenCalled();
    });

    test('should fall back to alert when no UI manager', () => {
      const errorHandlerNoUI = new ErrorHandler();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      const error = new Error('Test error');
      errorHandlerNoUI.handleError(error);

      expect(alertSpy).toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('safe operation wrappers', () => {
    test('should handle async operations safely', async () => {
      const successfulOperation = jest.fn().mockResolvedValue('success');
      const result = await errorHandler.safeAsync(successfulOperation);

      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalled();
    });

    test('should handle async operation failures', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Async error'));
      const result = await errorHandler.safeAsync(failingOperation, { test: true });

      expect(result).toBeNull();
      expect(errorHandler.errorLog).toHaveLength(1);
      expect(errorHandler.errorLog[0].message).toBe('Async error');
      expect(errorHandler.errorLog[0].context.test).toBe(true);
    });

    test('should handle sync operations safely', () => {
      const successfulOperation = jest.fn().mockReturnValue('success');
      const result = errorHandler.safeSync(successfulOperation);

      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalled();
    });

    test('should handle sync operation failures with fallback', () => {
      const failingOperation = jest.fn(() => { throw new Error('Sync error'); });
      const result = errorHandler.safeSync(failingOperation, { test: true }, 'fallback');

      expect(result).toBe('fallback');
      expect(errorHandler.errorLog).toHaveLength(1);
      expect(errorHandler.errorLog[0].message).toBe('Sync error');
    });
  });

  describe('error statistics', () => {
    beforeEach(() => {
      // Add some test errors
      errorHandler.handleError(new Error('Network error'), { type: 'network' });
      errorHandler.handleError(new Error('Peer error'), { type: 'peer' });
      errorHandler.handleError(new Error('Another network error'), { type: 'network' });
    });

    test('should provide error statistics', () => {
      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.network).toBe(2);
      expect(stats.byType.peer).toBe(1);
      expect(stats.recent).toHaveLength(3);
    });

    test('should export error log', () => {
      const exported = errorHandler.exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.errors).toHaveLength(3);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.userAgent).toBe('Test Browser');
    });
  });

  describe('error log management', () => {
    test('should limit error log size', () => {
      errorHandler.maxErrorLogSize = 3;

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError(new Error(`Error ${i}`));
      }

      expect(errorHandler.errorLog).toHaveLength(3);
      // Should keep the most recent errors
      expect(errorHandler.errorLog[0].message).toBe('Error 4');
    });

    test('should clear error log', () => {
      errorHandler.handleError(new Error('Test error'));
      expect(errorHandler.errorLog).toHaveLength(1);

      errorHandler.clearErrorLog();

      expect(errorHandler.errorLog).toHaveLength(0);
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('planningClub_errorLog');
    });
  });

  describe('data clearing', () => {
    test('should clear planning club data', () => {
      Object.defineProperty(global.localStorage, 'keys', {
        value: jest.fn().mockReturnValue([
          'planningClub_session1',
          'planningClub_session2',
          'otherApp_data',
          'planningClub_errorLog'
        ])
      });

      errorHandler.clearStoredData();

      expect(global.localStorage.removeItem).toHaveBeenCalledWith('planningClub_session1');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('planningClub_session2');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('planningClub_errorLog');
      expect(global.localStorage.removeItem).not.toHaveBeenCalledWith('otherApp_data');
    });
  });
});