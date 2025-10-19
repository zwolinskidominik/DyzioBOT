import { describe, it, expect, beforeAll, afterEach, afterAll, jest } from '@jest/globals';
import { setupMSW, server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { IStreamData, IUserData } from '../../../src/interfaces/api/Twitch';

// Setup MSW for all tests
setupMSW();

describe('Twitch API Integration Tests', () => {
  describe('Stream Data Fetching', () => {
    it('should fetch live stream data successfully', async () => {
      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer', {
        headers: {
          'Client-ID': 'test-client-id',
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { data: IStreamData[] };
      
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: '123456789',
        user_login: 'teststreamer',
        user_name: 'TestStreamer',
        title: 'Test Stream Title',
        viewer_count: 1337,
        is_mature: false,
      });
    });

    it('should return empty data for offline streamer', async () => {
      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=offline_streamer', {
        headers: {
          'Client-ID': 'test-client-id',
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { data: IStreamData[] };
      expect(data.data).toHaveLength(0);
    });

    it('should handle 404 error for non-existent user', async () => {
      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=error_test', {
        headers: {
          'Client-ID': 'test-client-id',
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(404);
      const error = await response.json() as { error: string };
      expect(error).toHaveProperty('error');
      expect(error.error).toBe('User not found');
    });

    it('should parse stream thumbnail URL correctly', async () => {
      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer');
      const data = await response.json() as { data: IStreamData[] };
      
      const stream = data.data[0];
      expect(stream.thumbnail_url).toContain('{width}');
      expect(stream.thumbnail_url).toContain('{height}');
      
      // Test thumbnail URL replacement
      const thumbnailUrl = stream.thumbnail_url
        .replace('{width}', '1280')
        .replace('{height}', '720');
      
      expect(thumbnailUrl).toBe('https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-1280x720.jpg');
    });
  });

  describe('User Data Fetching', () => {
    it('should fetch user data successfully', async () => {
      const response = await fetch('https://api.twitch.tv/helix/users?login=teststreamer', {
        headers: {
          'Client-ID': 'test-client-id',
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { data: IUserData[] };
      
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: '987654321',
        login: 'teststreamer',
        display_name: 'TestStreamer',
        broadcaster_type: 'partner',
        view_count: 50000,
      });
    });

    it('should return empty data for non-existent user', async () => {
      const response = await fetch('https://api.twitch.tv/helix/users?login=nonexistent_user');
      
      expect(response.status).toBe(200);
      const data = await response.json() as { data: IUserData[] };
      expect(data.data).toHaveLength(0);
    });

    it('should handle 404 error properly', async () => {
      const response = await fetch('https://api.twitch.tv/helix/users?login=error_test');
      
      expect(response.status).toBe(404);
      const error = await response.json() as { error: string };
      expect(error).toHaveProperty('error');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit response with retry headers', async () => {
      const response = await fetch('https://api.twitch.tv/helix/rate-limit-test');
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('800');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Too Many Requests');
    });

    it('should implement retry logic for rate limited requests', async () => {
      let callCount = 0;
      
      // Override handler to simulate rate limit then success
      server.use(
        http.get('https://api.twitch.tv/helix/streams', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: 'Too Many Requests' },
              { 
                status: 429,
                headers: { 'Retry-After': '1' }
              }
            );
          }
          return HttpResponse.json({
            data: [{
              id: '123456789',
              user_login: 'teststreamer',
              title: 'Retry Success',
              viewer_count: 100,
            }],
          });
        })
      );

      // First request should fail with 429
      const firstResponse = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer');
      expect(firstResponse.status).toBe(429);
      
      // Wait for retry delay (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second request should succeed
      const secondResponse = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer');
      expect(secondResponse.status).toBe(200);
      
      const data = await secondResponse.json() as { data: IStreamData[] };
      expect(data.data[0].title).toBe('Retry Success');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      await expect(async () => {
        await fetch('https://api.test.com/network-error');
      }).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      // Test timeout by making MSW handler delay
      server.use(
        http.get('https://api.test.com/timeout-test', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json({ message: 'This should timeout' });
        })
      );
      
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 500); // Abort after 500ms
      
      await expect(async () => {
        await fetch('https://api.test.com/timeout-test', {
          signal: controller.signal,
        });
      }).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get('https://api.twitch.tv/helix/malformed', () => {
          return new Response('invalid json{', { status: 200 });
        })
      );

      const response = await fetch('https://api.twitch.tv/helix/malformed');
      expect(response.status).toBe(200);
      
      await expect(async () => {
        await response.json();
      }).rejects.toThrow();
    });
  });

  describe('Authentication Errors', () => {
    it('should handle invalid token error', async () => {
      server.use(
        http.get('https://api.twitch.tv/helix/streams', () => {
          return HttpResponse.json(
            { error: 'Unauthorized', status: 401, message: 'Invalid access token' },
            { status: 401 }
          );
        })
      );

      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Unauthorized');
    });

    it('should handle missing client ID error', async () => {
      server.use(
        http.get('https://api.twitch.tv/helix/streams', ({ request }) => {
          const clientId = request.headers.get('Client-ID');
          if (!clientId) {
            return HttpResponse.json(
              { error: 'Missing Client-ID header', status: 400 },
              { status: 400 }
            );
          }
          return HttpResponse.json({ data: [] });
        })
      );

      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer');
      expect(response.status).toBe(400);
      
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Missing Client-ID header');
    });
  });

  describe('Data Validation', () => {
    it('should validate stream data structure', async () => {
      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer');
      const data = await response.json() as { data: IStreamData[] };
      
      const stream = data.data[0];
      
      // Required fields
      expect(typeof stream.id).toBe('string');
      expect(typeof stream.user_id).toBe('string');
      expect(typeof stream.user_login).toBe('string');
      expect(typeof stream.user_name).toBe('string');
      expect(typeof stream.title).toBe('string');
      expect(typeof stream.viewer_count).toBe('number');
      expect(typeof stream.started_at).toBe('string');
      expect(typeof stream.language).toBe('string');
      expect(typeof stream.thumbnail_url).toBe('string');
      expect(typeof stream.is_mature).toBe('boolean');
      
      // Validate date format
      expect(new Date(stream.started_at).getTime()).not.toBeNaN();
    });

    it('should validate user data structure', async () => {
      const response = await fetch('https://api.twitch.tv/helix/users?login=teststreamer');
      const data = await response.json() as { data: IUserData[] };
      
      const user = data.data[0];
      
      // Required fields
      expect(typeof user.id).toBe('string');
      expect(typeof user.login).toBe('string');
      expect(typeof user.display_name).toBe('string');
      expect(typeof user.type).toBe('string');
      expect(typeof user.broadcaster_type).toBe('string');
      expect(typeof user.description).toBe('string');
      expect(typeof user.profile_image_url).toBe('string');
      expect(typeof user.offline_image_url).toBe('string');
      expect(typeof user.view_count).toBe('number');
      expect(typeof user.created_at).toBe('string');
      
      // Validate date format
      expect(new Date(user.created_at).getTime()).not.toBeNaN();
    });
  });

  describe('Multiple Stream Queries', () => {
    it('should handle multiple user queries in single request', async () => {
      server.use(
        http.get('https://api.twitch.tv/helix/streams', ({ request }) => {
          const url = new URL(request.url);
          const userLogins = url.searchParams.getAll('user_login');
          
          const streams = userLogins
            .filter(login => login === 'teststreamer')
            .map(login => ({
              id: '123456789',
              user_login: login,
              user_name: 'TestStreamer',
              title: 'Multiple Query Test',
              viewer_count: 500,
            }));
          
          return HttpResponse.json({ data: streams });
        })
      );

      const response = await fetch('https://api.twitch.tv/helix/streams?user_login=teststreamer&user_login=offline_streamer');
      const data = await response.json() as { data: IStreamData[] };
      
      expect(data.data).toHaveLength(1);
      expect(data.data[0].user_login).toBe('teststreamer');
    });
  });
});