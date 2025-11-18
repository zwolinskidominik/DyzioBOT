import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CanvasRankCard } from '../../../src/utils/canvasRankCard';
import { CanvasLeaderboardCard } from '../../../src/utils/canvasLeaderboardCard';
import { createCanvas } from 'canvas';

// Mock loadImage to avoid network calls and timeouts
jest.mock('canvas', () => {
  const actual = jest.requireActual('canvas');
  return {
    ...actual,
    loadImage: jest.fn(async () => {
      // Return a simple 1x1 canvas as mock image
      const mockCanvas = actual.createCanvas(1, 1);
      return mockCanvas;
    }),
  };
});

describe('Canvas Utils - Smoke Tests', () => {
  describe('CanvasRankCard', () => {
    it('should create rank card instance without errors', () => {
      const options = {
        username: 'TestUser',
        level: 10,
        currentXP: 500,
        requiredXP: 1000,
        totalXP: 5500,
        rank: 5,
        avatarURL: 'https://cdn.discordapp.com/avatars/123/abc.png',
      };

      expect(() => new CanvasRankCard(options)).not.toThrow();
    });

    it('should generate canvas buffer', async () => {
      const card = new CanvasRankCard({
        username: 'TestUser',
        level: 1,
        currentXP: 0,
        requiredXP: 100,
        totalXP: 0,
        rank: 1,
        avatarURL: 'https://cdn.discordapp.com/avatars/123/abc.png',
      });

      const buffer = await card.build();
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle high level numbers', async () => {
      const card = new CanvasRankCard({
        username: 'HighLevelUser',
        level: 999,
        currentXP: 999999,
        requiredXP: 1000000,
        totalXP: 50000000,
        rank: 1,
        avatarURL: 'https://cdn.discordapp.com/avatars/123/abc.png',
      });

      const buffer = await card.build();
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle long usernames', async () => {
      const card = new CanvasRankCard({
        username: 'VeryLongUsernameWithManyCharacters',
        level: 5,
        currentXP: 50,
        requiredXP: 100,
        totalXP: 250,
        rank: 10,
        avatarURL: 'https://cdn.discordapp.com/avatars/123/abc.png',
      });

      const buffer = await card.build();
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle rank #1 (first place)', async () => {
      const card = new CanvasRankCard({
        username: 'TopPlayer',
        level: 50,
        currentXP: 800,
        requiredXP: 1000,
        totalXP: 100000,
        rank: 1,
        avatarURL: 'https://cdn.discordapp.com/avatars/123/abc.png',
      });

      const buffer = await card.build();
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('CanvasLeaderboardCard', () => {
    const botId = 'bot-123';

    it('should create leaderboard instance without errors', () => {
      const entries = [
        { rank: 1, username: 'Player1', level: 10, totalXP: 5000, avatarURL: 'https://cdn.discordapp.com/avatars/1/a.png' },
        { rank: 2, username: 'Player2', level: 9, totalXP: 4500, avatarURL: 'https://cdn.discordapp.com/avatars/2/b.png' },
        { rank: 3, username: 'Player3', level: 8, totalXP: 4000, avatarURL: 'https://cdn.discordapp.com/avatars/3/c.png' },
      ];

      expect(() => new CanvasLeaderboardCard({ entries, guildName: 'Test Server', page: 1, botId })).not.toThrow();
    });

    it('should generate leaderboard buffer', async () => {
      const entries = [
        { rank: 1, username: 'Player1', level: 10, totalXP: 5000, avatarURL: 'https://cdn.discordapp.com/avatars/1/a.png' },
        { rank: 2, username: 'Player2', level: 9, totalXP: 4500, avatarURL: 'https://cdn.discordapp.com/avatars/2/b.png' },
      ];

      const leaderboard = new CanvasLeaderboardCard({ entries, guildName: 'Test Server', page: 1, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty leaderboard', async () => {
      const leaderboard = new CanvasLeaderboardCard({ entries: [], guildName: 'Empty Server', page: 1, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle full 10-entry leaderboard', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        username: `Player${i + 1}`,
        level: 10 - i,
        totalXP: 5000 - i * 100,
        avatarURL: `https://cdn.discordapp.com/avatars/${i}/a.png`,
      }));

      const leaderboard = new CanvasLeaderboardCard({ entries, guildName: 'Full Server', page: 1, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle long server names', async () => {
      const entries = [{ 
        rank: 1, 
        username: 'Player1', 
        level: 5, 
        totalXP: 1000,
        avatarURL: 'https://cdn.discordapp.com/avatars/1/a.png'
      }];
      const longServerName = 'A'.repeat(50);

      const leaderboard = new CanvasLeaderboardCard({ entries, guildName: longServerName, page: 1, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle multiple pages', async () => {
      const entries = [
        { rank: 11, username: 'Player11', level: 5, totalXP: 1000, avatarURL: 'https://cdn.discordapp.com/avatars/11/a.png' },
        { rank: 12, username: 'Player12', level: 4, totalXP: 900, avatarURL: 'https://cdn.discordapp.com/avatars/12/a.png' },
      ];

      const leaderboard = new CanvasLeaderboardCard({ entries, guildName: 'Server', page: 2, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle Unicode characters in usernames', async () => {
      const entries = [
        { rank: 1, username: '🎮Player🎮', level: 10, totalXP: 5000, avatarURL: 'https://cdn.discordapp.com/avatars/1/a.png' },
        { rank: 2, username: 'Игрок', level: 9, totalXP: 4500, avatarURL: 'https://cdn.discordapp.com/avatars/2/a.png' },
        { rank: 3, username: '玩家', level: 8, totalXP: 4000, avatarURL: 'https://cdn.discordapp.com/avatars/3/a.png' },
      ];

      const leaderboard = new CanvasLeaderboardCard({ entries, guildName: 'Global', page: 1, botId });
      const buffer = await leaderboard.build();

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
