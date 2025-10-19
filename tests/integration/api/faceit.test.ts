import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { setupMSW, server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { IFaceitPlayer, ICS2Stats } from '../../../src/interfaces/api/Faceit';

// Setup MSW for all tests
setupMSW();

describe('Faceit API Integration Tests', () => {
  describe('Player Data Fetching', () => {
    it('should fetch player data successfully', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json() as IFaceitPlayer;
      
      expect(data).toMatchObject({
        player_id: 'test-player-id',
        nickname: 'TestPlayer',
        avatar: 'https://avatar.test.com/test.jpg',
        country: 'PL',
        steam_id_64: '76561198000000000',
        activated_at: '2020-01-01T00:00:00Z',
      });

      expect(data.games?.cs2).toMatchObject({
        skill_level: 7,
        faceit_elo: 1500,
      });
    });

    it('should validate player data structure', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
        headers: { 'Authorization': 'Bearer test-api-key' },
      });
      const player = await response.json() as IFaceitPlayer;
      
      // Required fields
      expect(typeof player.player_id).toBe('string');
      expect(typeof player.nickname).toBe('string');
      expect(typeof player.country).toBe('string');
      expect(typeof player.activated_at).toBe('string');
      
      // Optional fields
      if (player.avatar) {
        expect(typeof player.avatar).toBe('string');
        expect(player.avatar).toMatch(/^https?:\/\/.+/);
      }
      
      if (player.steam_id_64) {
        expect(typeof player.steam_id_64).toBe('string');
        expect(player.steam_id_64).toMatch(/^\d{17}$/); // Steam ID64 format
      }
      
      // Games data validation
      if (player.games?.cs2) {
        expect(typeof player.games.cs2.skill_level).toBe('number');
        expect(player.games.cs2.skill_level).toBeGreaterThanOrEqual(1);
        expect(player.games.cs2.skill_level).toBeLessThanOrEqual(10);
        
        if (player.games.cs2.faceit_elo) {
          expect(typeof player.games.cs2.faceit_elo).toBe('number');
          expect(player.games.cs2.faceit_elo).toBeGreaterThan(0);
        }
      }
      
      // Date validation
      expect(new Date(player.activated_at).getTime()).not.toBeNaN();
    });

    it('should handle player not found error', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=error_test', {
        headers: { 'Authorization': 'Bearer test-api-key' },
      });
      
      expect(response.status).toBe(404);
      const error = await response.json() as { errors: Array<{ message: string }> };
      expect(error.errors).toHaveLength(1);
      expect(error.errors[0].message).toBe('Player not found');
    });

    it('should handle authentication errors', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader) {
            return HttpResponse.json(
              { errors: [{ message: 'Missing Authorization header' }] },
              { status: 401 }
            );
          }
          
          if (authHeader === 'Bearer invalid-token') {
            return HttpResponse.json(
              { errors: [{ message: 'Invalid API token' }] },
              { status: 403 }
            );
          }
          
          return HttpResponse.json({
            player_id: 'test-auth-success',
            nickname: 'AuthTest',
            country: 'PL',
            activated_at: '2020-01-01T00:00:00Z',
          });
        })
      );

      // Test missing auth
      const noAuthResponse = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer');
      expect(noAuthResponse.status).toBe(401);

      // Test invalid token
      const invalidAuthResponse = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
        headers: { 'Authorization': 'Bearer invalid-token' },
      });
      expect(invalidAuthResponse.status).toBe(403);

      // Test valid auth
      const validAuthResponse = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });
      expect(validAuthResponse.status).toBe(200);
    });
  });

  describe('Player Stats Fetching', () => {
    it('should fetch CS2 player stats successfully', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players/test-player-id/stats/cs2', {
        headers: { 'Authorization': 'Bearer test-api-key' },
      });
      
      expect(response.status).toBe(200);
      const stats = await response.json() as ICS2Stats;
      
      expect(stats).toHaveProperty('lifetime');
      expect(stats.lifetime).toMatchObject({
        'Average K/D Ratio': '1.25',
        'Average Headshots %': '45%',
        'Total Headshots': '1250',
        'Win Rate %': '65%',
        'Matches': '100',
        'Wins': '65',
      });
    });

    it('should validate stats data types', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players/test-player-id/stats/cs2');
      const stats = await response.json() as ICS2Stats;
      
      expect(typeof stats.lifetime).toBe('object');
      
      // Check specific stat formats
      const lifetime = stats.lifetime;
      
      // K/D Ratio should be a decimal string
      expect(typeof lifetime['Average K/D Ratio']).toBe('string');
      expect(lifetime['Average K/D Ratio']).toMatch(/^\d+\.\d+$/);
      
      // Percentages should end with %
      expect(typeof lifetime['Average Headshots %']).toBe('string');
      expect(lifetime['Average Headshots %']).toMatch(/^\d+%$/);
      
      // Win Rate should be percentage
      expect(typeof lifetime['Win Rate %']).toBe('string');
      expect(lifetime['Win Rate %']).toMatch(/^\d+%$/);
      
      // Counts should be numeric strings
      expect(typeof lifetime['Matches']).toBe('string');
      expect(lifetime['Matches']).toMatch(/^\d+$/);
      
      expect(typeof lifetime['Wins']).toBe('string');
      expect(lifetime['Wins']).toMatch(/^\d+$/);
    });

    it('should handle stats not found error', async () => {
      const response = await fetch('https://open-api.faceit.com/data/v4/players/nonexistent-id/stats/cs2');
      
      expect(response.status).toBe(404);
      const error = await response.json() as { errors: Array<{ message: string }> };
      expect(error.errors[0].message).toBe('Stats not found');
    });

    it('should handle different game types', async () => {
      const gameTypes = ['cs2', 'csgo', 'dota2', 'lol'];
      
      for (const game of gameTypes) {
        server.use(
          http.get(`https://open-api.faceit.com/data/v4/players/test-player-id/stats/${game}`, () => {
            return HttpResponse.json({
              lifetime: {
                'Game Type': game,
                'Matches': '50',
                'Wins': '30',
                'Win Rate %': '60%',
              },
            });
          })
        );

        const response = await fetch(`https://open-api.faceit.com/data/v4/players/test-player-id/stats/${game}`);
        expect(response.status).toBe(200);
        
        const stats = await response.json() as ICS2Stats;
        expect(stats.lifetime['Game Type']).toBe(game);
      }
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle Faceit API rate limiting', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', () => {
          return HttpResponse.json(
            { errors: [{ message: 'Rate limit exceeded' }] },
            { 
              status: 429,
              headers: {
                'Retry-After': '300',
                'X-RateLimit-Limit': '20',
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 300),
              }
            }
          );
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer');
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('300');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('20');
    });

    it('should measure API response times', async () => {
      const startTime = Date.now();
      
      await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
        headers: { 'Authorization': 'Bearer test-api-key' },
      });
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const nicknames = ['Player1', 'Player2', 'Player3', 'Player4', 'Player5'];
      
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', ({ request }) => {
          const url = new URL(request.url);
          const nickname = url.searchParams.get('nickname');
          
          return HttpResponse.json({
            player_id: `id-${nickname}`,
            nickname: nickname,
            country: 'PL',
            activated_at: '2020-01-01T00:00:00Z',
          });
        })
      );

      const promises = nicknames.map(nickname => 
        fetch(`https://open-api.faceit.com/data/v4/players?nickname=${nickname}`, {
          headers: { 'Authorization': 'Bearer test-api-key' },
        })
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Data Processing and Transformation', () => {
    it('should handle skill level calculations', async () => {
      const skillLevels = [1, 3, 5, 7, 10];
      
      for (const skillLevel of skillLevels) {
        server.use(
          http.get('https://open-api.faceit.com/data/v4/players', () => {
            return HttpResponse.json({
              player_id: 'test-skill-level',
              nickname: 'SkillTest',
              country: 'PL',
              activated_at: '2020-01-01T00:00:00Z',
              games: {
                cs2: {
                  skill_level: skillLevel,
                  faceit_elo: 1000 + (skillLevel * 200), // Mock ELO calculation
                },
              },
            });
          })
        );

        const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=SkillTest');
        const player = await response.json() as IFaceitPlayer;
        
        expect(player.games?.cs2?.skill_level).toBe(skillLevel);
        expect(player.games?.cs2?.faceit_elo).toBe(1000 + (skillLevel * 200));
      }
    });

    it('should handle missing game data gracefully', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', () => {
          return HttpResponse.json({
            player_id: 'no-games-player',
            nickname: 'NoGames',
            country: 'PL',
            activated_at: '2020-01-01T00:00:00Z',
            // No games property
          });
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=NoGames');
      const player = await response.json() as IFaceitPlayer;
      
      expect(player.games).toBeUndefined();
      expect(player.nickname).toBe('NoGames');
    });

    it('should parse country codes correctly', async () => {
      const countries = ['PL', 'US', 'DE', 'SE', 'DK'];
      
      for (const country of countries) {
        server.use(
          http.get('https://open-api.faceit.com/data/v4/players', () => {
            return HttpResponse.json({
              player_id: `player-${country}`,
              nickname: `Player${country}`,
              country: country,
              activated_at: '2020-01-01T00:00:00Z',
            });
          })
        );

        const response = await fetch(`https://open-api.faceit.com/data/v4/players?nickname=Player${country}`);
        const player = await response.json() as IFaceitPlayer;
        
        expect(player.country).toBe(country);
        expect(player.country).toMatch(/^[A-Z]{2}$/); // Two-letter country code
      }
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle malformed API responses', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', () => {
          return new Response('invalid json{', { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer');
      expect(response.status).toBe(200);
      
      await expect(async () => {
        await response.json();
      }).rejects.toThrow();
    });

    it('should handle server errors gracefully', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', () => {
          return HttpResponse.json(
            { errors: [{ message: 'Internal server error' }] },
            { status: 500 }
          );
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer');
      expect(response.status).toBe(500);
      
      const error = await response.json() as { errors: Array<{ message: string }> };
      expect(error.errors[0].message).toBe('Internal server error');
    });

    it('should handle network timeouts', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json({});
        })
      );
      
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 500);
      
      await expect(async () => {
        await fetch('https://open-api.faceit.com/data/v4/players?nickname=TestPlayer', {
          signal: controller.signal,
        });
      }).rejects.toThrow();
    });

    it('should validate nickname input patterns', async () => {
      const invalidNicknames = ['', ' ', 'a', 'a'.repeat(100)];
      
      for (const nickname of invalidNicknames) {
        server.use(
          http.get('https://open-api.faceit.com/data/v4/players', ({ request }) => {
            const url = new URL(request.url);
            const nick = url.searchParams.get('nickname');
            
            if (!nick || nick.length < 2 || nick.length > 50) {
              return HttpResponse.json(
                { errors: [{ message: 'Invalid nickname format' }] },
                { status: 400 }
              );
            }
            
            return HttpResponse.json({
              player_id: 'valid-player',
              nickname: nick,
              country: 'PL',
              activated_at: '2020-01-01T00:00:00Z',
            });
          })
        );

        const response = await fetch(`https://open-api.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`);
        
        if (nickname === '' || nickname === ' ' || nickname.length === 1 || nickname.length > 50) {
          expect(response.status).toBe(400);
        }
      }
    });
  });

  describe('Advanced Features and Analytics', () => {
    it('should handle player search with multiple results', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/search/players', ({ request }) => {
          const url = new URL(request.url);
          const nickname = url.searchParams.get('nickname');
          
          return HttpResponse.json({
            items: [
              {
                player_id: 'player1',
                nickname: `${nickname}1`,
                country: 'PL',
              },
              {
                player_id: 'player2',
                nickname: `${nickname}2`,
                country: 'DE',
              },
            ],
          });
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/search/players?nickname=Test');
      expect(response.status).toBe(200);
      
      const results = await response.json() as { items: IFaceitPlayer[] };
      expect(results.items).toHaveLength(2);
      expect(results.items[0].nickname).toBe('Test1');
      expect(results.items[1].nickname).toBe('Test2');
    });

    it('should handle historical stats and trends', async () => {
      server.use(
        http.get('https://open-api.faceit.com/data/v4/players/test-player-id/history', () => {
          return HttpResponse.json({
            items: [
              {
                match_id: 'match1',
                game: 'cs2',
                stats: {
                  'K/D Ratio': '1.5',
                  'Headshots %': '50%',
                },
                created_at: '2025-09-20T10:00:00Z',
              },
              {
                match_id: 'match2',
                game: 'cs2',
                stats: {
                  'K/D Ratio': '1.2',
                  'Headshots %': '40%',
                },
                created_at: '2025-09-19T10:00:00Z',
              },
            ],
          });
        })
      );

      const response = await fetch('https://open-api.faceit.com/data/v4/players/test-player-id/history');
      expect(response.status).toBe(200);
      
      const history = await response.json() as { items: any[] };
      expect(history.items).toHaveLength(2);
      expect(history.items[0].stats['K/D Ratio']).toBe('1.5');
    });
  });
});