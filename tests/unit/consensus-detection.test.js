import { describe, test, expect, beforeEach } from '@jest/globals';
import { GameManager } from '../../src/game-manager.js';

describe('Consensus Detection', () => {
  let gameManager;

  beforeEach(() => {
    gameManager = new GameManager();
    // Mock localPeerId to avoid issues
    gameManager.localPeerId = 'test-peer-1';
  });

  describe('detectConsensus', () => {
    test('should detect insufficient votes', () => {
      const consensus = gameManager.detectConsensus([]);
      expect(consensus.type).toBe('insufficient');
      expect(consensus.message).toBe('Need more votes');
    });

    test('should detect insufficient votes with single vote', () => {
      const consensus = gameManager.detectConsensus(['5']);
      expect(consensus.type).toBe('insufficient');
      expect(consensus.message).toBe('Need more votes');
    });

    test('should detect perfect consensus', () => {
      const consensus = gameManager.detectConsensus(['5', '5', '5']);
      expect(consensus.type).toBe('perfect');
      expect(consensus.message).toBe('Perfect consensus on 5!');
      expect(consensus.highlight).toBe(true);
    });

    test('should detect perfect consensus with non-numeric votes', () => {
      const consensus = gameManager.detectConsensus(['?', '?']);
      expect(consensus.type).toBe('perfect');
      expect(consensus.message).toBe('Perfect consensus on ?!');
      expect(consensus.highlight).toBe(true);
    });

    test('should detect close consensus (range <= 2)', () => {
      const consensus = gameManager.detectConsensus(['3', '5', '3']);
      expect(consensus.type).toBe('close');
      expect(consensus.message).toBe('Close consensus (range: 2)');
      expect(consensus.highlight).toBe(false);
    });

    test('should detect divergent consensus (range >= 10)', () => {
      const consensus = gameManager.detectConsensus(['1', '20', '5']);
      expect(consensus.type).toBe('divergent');
      expect(consensus.message).toBe('Wide range of estimates (1-20)');
      expect(consensus.highlight).toBe(false);
    });

    test('should detect majority consensus (>60% same vote)', () => {
      const consensus = gameManager.detectConsensus(['5', '5', '5', '8', '3']); // 3/5 = 60% not >60%
      const consensus2 = gameManager.detectConsensus(['5', '5', '5', '8']); // 3/4 = 75% > 60%
      
      expect(consensus2.type).toBe('majority');
      expect(consensus2.message).toBe('Majority consensus on 5 (3/4)');
      expect(consensus2.highlight).toBe(false);
    });

    test('should handle half point votes in numeric calculations', () => {
      const consensus = gameManager.detectConsensus(['½', '1', '2']);
      expect(consensus.type).toBe('close');
      expect(consensus.message).toBe('Close consensus (range: 1.5)');
    });

    test('should detect no consensus when votes are spread', () => {
      const consensus = gameManager.detectConsensus(['1', '5', '13', '?']);
      expect(consensus.type).toBe('none');
      expect(consensus.message).toBe('No consensus - discussion needed');
      expect(consensus.highlight).toBe(false);
    });

    test('should handle mixed numeric and non-numeric votes for majority', () => {
      const consensus = gameManager.detectConsensus(['?', '?', '?', '5', '8']); // 3/5 = 60% not >60%
      const consensus2 = gameManager.detectConsensus(['?', '?', '?', '5']); // 3/4 = 75% > 60%
      
      expect(consensus2.type).toBe('majority');
      expect(consensus2.message).toBe('Majority consensus on ? (3/4)');
    });
  });

  describe('getVotingSummary', () => {
    beforeEach(() => {
      // Add some test players with votes
      gameManager.players.set('player1', { id: 'player1', name: 'Player 1', vote: '5', isLocal: false });
      gameManager.players.set('player2', { id: 'player2', name: 'Player 2', vote: '8', isLocal: false });
      gameManager.players.set('player3', { id: 'player3', name: 'Player 3', vote: '5', isLocal: false });
    });

    test('should include consensus in voting summary', () => {
      const summary = gameManager.getVotingSummary();
      
      expect(summary.consensus).toBeDefined();
      expect(summary.consensus.type).toBe('majority'); // 2/3 voted '5'
      expect(summary.total).toBe(3);
      expect(summary.votes).toEqual({ '5': 2, '8': 1 });
    });

    test('should handle empty votes', () => {
      gameManager.players.clear();
      const summary = gameManager.getVotingSummary();
      
      expect(summary.consensus.type).toBe('insufficient');
      expect(summary.total).toBe(0);
    });

    test('should calculate average correctly', () => {
      const summary = gameManager.getVotingSummary();
      expect(summary.average).toBe('6.0'); // (5 + 8 + 5) / 3 = 6
    });
  });
});

describe('GameManager Integration', () => {
  let gameManager;

  beforeEach(() => {
    gameManager = new GameManager();
    gameManager.localPeerId = 'test-peer-1';
    gameManager.sessionId = 'test-session';
    gameManager.playerData = { name: 'Test Player', email: 'test@example.com' };
  });

  test('should add local player and detect consensus', () => {
    gameManager.addLocalPlayer();
    
    // Cast a vote
    gameManager.castVote('5');
    
    const summary = gameManager.getVotingSummary();
    expect(summary.consensus.type).toBe('insufficient'); // Only 1 vote
    
    // Add another player
    gameManager.players.set('player2', { id: 'player2', name: 'Player 2', vote: '5', isLocal: false });
    
    const summary2 = gameManager.getVotingSummary();
    expect(summary2.consensus.type).toBe('perfect'); // Both voted '5'
  });
});