import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConnectionManager } from '../../src/services/connection-manager.js';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('ConnectionManager', () => {
  let connectionManager;
  let mockEventListeners = {};

  beforeEach(() => {
    // Clear any existing mocks first
    jest.clearAllMocks();
    
    // Mock window event listeners
    global.window.addEventListener = jest.fn((event, handler) => {
      mockEventListeners[event] = handler;
    });
    global.window.removeEventListener = jest.fn();
    
    // Mock document event listeners
    global.document.addEventListener = jest.fn();
    global.document.removeEventListener = jest.fn();
    
    // Mock document visibility
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible',
    });
    
    connectionManager = new ConnectionManager();
  });

  afterEach(() => {
    if (connectionManager) {
      connectionManager.destroy();
    }
  });

  describe('initialization', () => {
    test('should initialize with online status', () => {
      expect(connectionManager.isOnline).toBe(true);
      expect(connectionManager.connectionQuality).toBe('good');
      expect(connectionManager.retryAttempts).toBe(0);
    });

    test('should set up event listeners', () => {
      expect(global.window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(global.window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(global.document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('online/offline handling', () => {
    test('should handle going offline', () => {
      const statusChangeSpy = jest.fn();
      const connectionLostSpy = jest.fn();
      
      connectionManager.on('statusChange', statusChangeSpy);
      connectionManager.on('connectionLost', connectionLostSpy);
      
      // Simulate going offline
      navigator.onLine = false;
      connectionManager.handleOnlineStatusChange(false);
      
      expect(connectionManager.isOnline).toBe(false);
      expect(connectionManager.connectionQuality).toBe('offline');
      expect(connectionLostSpy).toHaveBeenCalled();
      expect(statusChangeSpy).toHaveBeenCalledWith({
        isOnline: false,
        quality: 'offline'
      });
    });

    test('should handle coming online', () => {
      // Start offline
      connectionManager.isOnline = false;
      connectionManager.connectionQuality = 'offline';
      connectionManager.retryAttempts = 3;
      
      const statusChangeSpy = jest.fn();
      const connectionRestoredSpy = jest.fn();
      
      connectionManager.on('statusChange', statusChangeSpy);
      connectionManager.on('connectionRestored', connectionRestoredSpy);
      
      // Simulate coming online
      navigator.onLine = true;
      connectionManager.handleOnlineStatusChange(true);
      
      expect(connectionManager.isOnline).toBe(true);
      expect(connectionManager.connectionQuality).toBe('good');
      expect(connectionManager.retryAttempts).toBe(0);
      expect(connectionRestoredSpy).toHaveBeenCalled();
    });
  });

  describe('connection quality', () => {
    test('should detect good connection', () => {
      connectionManager.handleConnectionTest(true, 500);
      expect(connectionManager.connectionQuality).toBe('good');
    });

    test('should detect poor connection', () => {
      connectionManager.handleConnectionTest(true, 2000);
      expect(connectionManager.connectionQuality).toBe('poor');
    });

    test('should detect very poor connection', () => {
      connectionManager.handleConnectionTest(true, 4000);
      expect(connectionManager.connectionQuality).toBe('very-poor');
    });

    test('should handle failed connection tests', () => {
      connectionManager.handleConnectionTest(false, 5000);
      expect(connectionManager.retryAttempts).toBe(1);
    });

    test('should set offline after max retry attempts', () => {
      const connectionDegradedSpy = jest.fn();
      connectionManager.on('connectionDegraded', connectionDegradedSpy);
      
      // Simulate multiple failed connection tests
      for (let i = 0; i < connectionManager.maxRetryAttempts; i++) {
        connectionManager.handleConnectionTest(false, 5000);
      }
      
      expect(connectionManager.connectionQuality).toBe('offline');
      expect(connectionDegradedSpy).toHaveBeenCalled();
    });
  });

  describe('status messages', () => {
    test('should return null for good connection (no status needed)', () => {
      connectionManager.connectionQuality = 'good';
      connectionManager.isOnline = true;
      
      const status = connectionManager.getStatusMessage();
      expect(status).toBe(null);
    });

    test('should return correct status message for offline', () => {
      connectionManager.isOnline = false;
      
      const status = connectionManager.getStatusMessage();
      expect(status.type).toBe('error');
      expect(status.message).toBe('You\'re offline. Some features may not work.');
      expect(status.icon).toBe('Offline');
    });

    test('should return correct status message for poor connection', () => {
      connectionManager.connectionQuality = 'poor';
      connectionManager.isOnline = true;
      
      const status = connectionManager.getStatusMessage();
      expect(status.type).toBe('warning');
      expect(status.message).toBe('Poor connection. Some delays expected.');
      expect(status.icon).toBe('Slow');
    });

    test('should return null for unknown connection quality', () => {
      connectionManager.connectionQuality = 'unknown';
      connectionManager.isOnline = true;
      
      const status = connectionManager.getStatusMessage();
      expect(status).toBe(null);
    });
  });

  describe('reconnection attempts', () => {
    test('should attempt reconnection with exponential backoff', (done) => {
      const mockCallback = jest.fn().mockResolvedValue();
      connectionManager.retryDelay = 10; // Short delay for testing
      
      connectionManager.attemptReconnection(mockCallback);
      
      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalled();
        done();
      }, 20);
    });

    test('should handle failed reconnection attempts', (done) => {
      const mockCallback = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const reconnectionFailedSpy = jest.fn();
      connectionManager.on('reconnectionFailed', reconnectionFailedSpy);
      
      connectionManager.retryDelay = 10;
      connectionManager.maxRetryAttempts = 1; // Fail quickly for testing
      
      connectionManager.attemptReconnection(mockCallback);
      
      setTimeout(() => {
        expect(reconnectionFailedSpy).toHaveBeenCalled();
        done();
      }, 50);
    });
  });

  describe('page visibility handling', () => {
    test('should handle page becoming visible', () => {
      const pageVisibleSpy = jest.fn();
      connectionManager.on('pageVisible', pageVisibleSpy);
      
      connectionManager.handlePageVisible();
      
      expect(pageVisibleSpy).toHaveBeenCalled();
    });

    test('should handle page becoming hidden', () => {
      const pageHiddenSpy = jest.fn();
      connectionManager.on('pageHidden', pageHiddenSpy);
      
      connectionManager.handlePageHidden();
      
      expect(pageHiddenSpy).toHaveBeenCalled();
    });
  });

  describe('event system', () => {
    test('should register and emit events', () => {
      const testHandler = jest.fn();
      connectionManager.on('test', testHandler);
      
      connectionManager.emit('test', { data: 'test' });
      
      expect(testHandler).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should remove event handlers', () => {
      const testHandler = jest.fn();
      connectionManager.on('test', testHandler);
      connectionManager.off('test', testHandler);
      
      connectionManager.emit('test', { data: 'test' });
      
      expect(testHandler).not.toHaveBeenCalled();
    });

    test('should handle errors in event handlers gracefully', () => {
      const errorHandler = jest.fn(() => { throw new Error('Handler error'); });
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      connectionManager.on('test', errorHandler);
      connectionManager.emit('test');
      
      expect(consoleWarn).toHaveBeenCalledWith('Error in connection manager event handler:', expect.any(Error));
      consoleWarn.mockRestore();
    });
  });

  describe('cleanup', () => {
    test('should clean up resources on destroy', () => {
      connectionManager.destroy();
      
      expect(global.window.removeEventListener).toHaveBeenCalledWith('online', connectionManager.handleOnlineStatusChange);
      expect(global.window.removeEventListener).toHaveBeenCalledWith('offline', connectionManager.handleOnlineStatusChange);
      expect(global.document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });
});