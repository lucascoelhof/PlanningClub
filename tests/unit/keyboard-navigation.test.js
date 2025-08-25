import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UIManager } from '../../src/ui-manager.js';

describe('Keyboard Navigation', () => {
  let uiManager;
  let mockGameManager;
  let mockConnectionManager;

  beforeEach(() => {
    // Setup DOM with required elements
    document.body.innerHTML = `
      <div id="app">
        <div id="voting-cards"></div>
      </div>
    `;
    
    // Mock managers
    mockGameManager = {
      on: jest.fn(),
      emit: jest.fn()
    };
    
    mockConnectionManager = {
      on: jest.fn(),
      getStatusMessage: jest.fn().mockReturnValue({
        type: 'success',
        message: 'Connected',
        icon: '🟢'
      })
    };

    uiManager = new UIManager(mockGameManager, mockConnectionManager);
    
    // Mock the renderVoteCards method to avoid DOM errors
    jest.spyOn(uiManager, 'renderVoteCards').mockImplementation(() => {});
    
    // Spy on the emit method
    jest.spyOn(uiManager, 'emit').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    test('should setup keyboard navigation with vote options', () => {
      expect(uiManager.voteOptions).toEqual(['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']);
      expect(uiManager.keyBuffer).toBe('');
      expect(uiManager.keyTimeout).toBeNull();
      expect(uiManager.keyDelay).toBe(500);
    });
  });

  describe('keyboard event handling', () => {
    beforeEach(() => {
      uiManager.currentPage = 'game';
    });

    test('should handle Escape key to clear votes', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.selectedVote).toBeNull();
      expect(uiManager.emit).toHaveBeenCalledWith('clearVotes');
    });

    test('should handle Enter key to show votes', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.emit).toHaveBeenCalledWith('showVotes');
    });

    test('should handle + key to navigate to next vote', () => {
      uiManager.selectedVote = '1';
      const event = new KeyboardEvent('keydown', { key: '+' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.selectedVote).toBe('2');
    });

    test('should handle - key to navigate to previous vote', () => {
      uiManager.selectedVote = '2';
      const event = new KeyboardEvent('keydown', { key: '-' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.selectedVote).toBe('1');
    });

    test('should handle = key as + alternative', () => {
      uiManager.selectedVote = '0';
      const event = new KeyboardEvent('keydown', { key: '=' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.selectedVote).toBe('½');
    });

    test('should handle _ key as - alternative', () => {
      uiManager.selectedVote = '½';
      const event = new KeyboardEvent('keydown', { key: '_' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.selectedVote).toBe('0');
    });

    test('should not handle keys when not on game page', () => {
      uiManager.currentPage = 'home';
      jest.spyOn(uiManager, 'handleKeyboardInput').mockImplementation(() => {});
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      document.dispatchEvent(event);

      expect(uiManager.handleKeyboardInput).not.toHaveBeenCalled();
    });

    test('should not handle keys when typing in inputs', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(event, 'target', { value: input });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(uiManager.emit).not.toHaveBeenCalled();
    });
  });

  describe('number input handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      uiManager.currentPage = 'game';
      // Clear emit mock calls
      uiManager.emit.mockClear();
    });

    test('should handle single digit number input', () => {
      const event = new KeyboardEvent('keydown', { key: '5' });
      jest.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(uiManager.keyBuffer).toBe('5');

      // Fast forward time to trigger vote processing
      jest.advanceTimersByTime(500);

      expect(uiManager.selectedVote).toBe('5');
      expect(uiManager.keyBuffer).toBe('');
    });

    test('should handle multi-digit number input', () => {
      const event1 = new KeyboardEvent('keydown', { key: '1' });
      const event2 = new KeyboardEvent('keydown', { key: '0' });
      const event3 = new KeyboardEvent('keydown', { key: '0' });

      document.dispatchEvent(event1);
      document.dispatchEvent(event2);
      document.dispatchEvent(event3);

      expect(uiManager.keyBuffer).toBe('100');

      // Fast forward time to trigger vote processing
      jest.advanceTimersByTime(500);

      expect(uiManager.selectedVote).toBe('100');
    });

    test('should handle special characters ½ and ?', () => {
      const eventHalf = new KeyboardEvent('keydown', { key: '½' });
      document.dispatchEvent(eventHalf);
      jest.advanceTimersByTime(500);

      expect(uiManager.selectedVote).toBe('½');

      // Reset for next test
      uiManager.keyBuffer = '';
      uiManager.selectedVote = null;

      const eventQuestion = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(eventQuestion);
      jest.advanceTimersByTime(500);

      expect(uiManager.selectedVote).toBe('?');
    });

    test('should find closest match for invalid numbers', () => {
      const event1 = new KeyboardEvent('keydown', { key: '7' });
      document.dispatchEvent(event1);
      jest.advanceTimersByTime(500);

      // 7 should map to closest option which is 8
      expect(uiManager.selectedVote).toBe('8');
    });

    test('should handle invalid input gracefully', () => {
      const event1 = new KeyboardEvent('keydown', { key: '9' });
      const event2 = new KeyboardEvent('keydown', { key: '9' });
      const event3 = new KeyboardEvent('keydown', { key: '9' });

      document.dispatchEvent(event1);
      document.dispatchEvent(event2);
      document.dispatchEvent(event3);
      jest.advanceTimersByTime(500);

      // 999 should map to closest option which is 100
      expect(uiManager.selectedVote).toBe('100');
    });

    test('should reset timeout when typing continues', () => {
      const event1 = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event1);

      // Advance time partially (less than delay)
      jest.advanceTimersByTime(250);
      expect(uiManager.selectedVote).toBeNull();

      // Type another digit - this should reset the timeout
      const event2 = new KeyboardEvent('keydown', { key: '0' });
      document.dispatchEvent(event2);

      // Advance time partially again (should still not trigger)
      jest.advanceTimersByTime(250);
      expect(uiManager.selectedVote).toBeNull();

      // Now advance the remaining time to complete the full delay from the second keystroke
      jest.advanceTimersByTime(250);
      expect(uiManager.selectedVote).toBe('8'); // Closest match to "10"
    });
  });

  describe('vote navigation', () => {
    beforeEach(() => {
      uiManager.currentPage = 'game';
    });

    test('should navigate to first option when no vote selected and direction is positive', () => {
      uiManager.navigateVote(1);

      expect(uiManager.selectedVote).toBe('0');
    });

    test('should navigate to last option when no vote selected and direction is negative', () => {
      uiManager.navigateVote(-1);

      expect(uiManager.selectedVote).toBe('?');
    });

    test('should not navigate beyond first option', () => {
      uiManager.selectedVote = '0';
      uiManager.navigateVote(-1);

      expect(uiManager.selectedVote).toBe('0'); // Should stay at first
    });

    test('should not navigate beyond last option', () => {
      uiManager.selectedVote = '?';
      uiManager.navigateVote(1);

      expect(uiManager.selectedVote).toBe('?'); // Should stay at last
    });

    test('should handle invalid current vote gracefully', () => {
      uiManager.selectedVote = 'invalid';
      uiManager.navigateVote(1);

      expect(uiManager.selectedVote).toBe('invalid'); // Should remain unchanged
    });
  });
});