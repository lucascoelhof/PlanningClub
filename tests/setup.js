// Jest setup file for global test configuration
import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock PeerJS
global.Peer = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  destroy: jest.fn(),
  open: true,
  id: 'mock-peer-id'
}));

// Mock CryptoJS
global.CryptoJS = {
  MD5: jest.fn().mockReturnValue({ toString: () => 'mock-hash' })
};

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});