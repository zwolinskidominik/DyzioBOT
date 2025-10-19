import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { setupMSW, server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { IAnimalImageResponse } from '../../../src/interfaces/api/Animal';

// Setup MSW for all tests
setupMSW();

describe('Animal API Integration Tests', () => {
  describe('Cat API', () => {
    it('should fetch cat image successfully', async () => {
      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      
      expect(response.status).toBe(200);
      const data = await response.json() as IAnimalImageResponse[];
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 'cat123',
        url: 'https://cdn2.thecatapi.com/images/test.jpg',
        width: 800,
        height: 600,
      });
    });

    it('should validate cat image data structure', async () => {
      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json() as IAnimalImageResponse[];
      
      const cat = data[0];
      
      // Required fields
      expect(typeof cat.id).toBe('string');
      expect(typeof cat.url).toBe('string');
      expect(cat.url).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i);
      
      // Optional fields
      if (cat.width !== undefined) {
        expect(typeof cat.width).toBe('number');
        expect(cat.width).toBeGreaterThan(0);
      }
      
      if (cat.height !== undefined) {
        expect(typeof cat.height).toBe('number');
        expect(cat.height).toBeGreaterThan(0);
      }
    });

    it('should handle empty response from cat API', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.json([]);
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      expect(response.status).toBe(200);
      
      const data = await response.json() as IAnimalImageResponse[];
      expect(data).toHaveLength(0);
    });

    it('should handle cat API rate limiting', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.json(
            { message: 'Too Many Requests' },
            { 
              status: 429,
              headers: {
                'Retry-After': '60',
                'X-RateLimit-Limit': '1000',
                'X-RateLimit-Remaining': '0',
              }
            }
          );
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Dog API', () => {
    it('should fetch dog image successfully', async () => {
      const response = await fetch('https://api.thedogapi.com/v1/images/search');
      
      expect(response.status).toBe(200);
      const data = await response.json() as IAnimalImageResponse[];
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 'dog123',
        url: 'https://cdn2.thedogapi.com/images/test.jpg',
        width: 800,
        height: 600,
      });
    });

    it('should validate dog image URL format', async () => {
      const response = await fetch('https://api.thedogapi.com/v1/images/search');
      const data = await response.json() as IAnimalImageResponse[];
      
      const dog = data[0];
      expect(dog.url).toMatch(/^https?:\/\/.+/);
      expect(dog.url).toMatch(/\.(jpg|jpeg|png|gif|webp)$/i);
    });

    it('should handle dog API server error', async () => {
      server.use(
        http.get('https://api.thedogapi.com/v1/images/search', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );

      const response = await fetch('https://api.thedogapi.com/v1/images/search');
      expect(response.status).toBe(500);
      
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Internal Server Error');
    });
  });

  describe('Fox API', () => {
    it('should fetch fox image successfully', async () => {
      const response = await fetch('https://randomfox.ca/floof/');
      
      expect(response.status).toBe(200);
      const data = await response.json() as { image: string; link: string };
      
      expect(data).toHaveProperty('image');
      expect(data).toHaveProperty('link');
      expect(data.image).toBe('https://randomfox.ca/images/test.jpg');
      expect(data.link).toBe('https://randomfox.ca/?i=test');
    });

    it('should validate fox API response structure', async () => {
      const response = await fetch('https://randomfox.ca/floof/');
      const data = await response.json() as { image: string; link: string };
      
      expect(typeof data.image).toBe('string');
      expect(typeof data.link).toBe('string');
      expect(data.image).toMatch(/^https?:\/\//);
      expect(data.link).toMatch(/^https?:\/\//);
    });

    it('should handle fox API timeout', async () => {
      server.use(
        http.get('https://randomfox.ca/floof/', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json({ image: 'test', link: 'test' });
        })
      );

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 500);
      
      await expect(async () => {
        await fetch('https://randomfox.ca/floof/', {
          signal: controller.signal,
        });
      }).rejects.toThrow();
    });
  });

  describe('API Fallback Mechanisms', () => {
    it('should handle API unavailability gracefully', async () => {
      // Test multiple APIs returning errors
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.error();
        }),
        http.get('https://api.thedogapi.com/v1/images/search', () => {
          return HttpResponse.error();
        }),
        http.get('https://randomfox.ca/floof/', () => {
          return HttpResponse.error();
        })
      );

      // Test that all APIs fail appropriately
      await expect(fetch('https://api.thecatapi.com/v1/images/search')).rejects.toThrow();
      await expect(fetch('https://api.thedogapi.com/v1/images/search')).rejects.toThrow();
      await expect(fetch('https://randomfox.ca/floof/')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return new Response('invalid json{', { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      expect(response.status).toBe(200);
      
      await expect(async () => {
        await response.json();
      }).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.json([
            {
              // Missing 'id' field
              url: 'https://example.com/cat.jpg',
              width: 800,
              height: 600,
            }
          ]);
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      expect(response.status).toBe(200);
      
      const data = await response.json() as Partial<IAnimalImageResponse>[];
      expect(data[0]).not.toHaveProperty('id');
      expect(data[0]).toHaveProperty('url');
    });
  });

  describe('Image URL Validation', () => {
    it('should validate image URLs are accessible', async () => {
      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json() as IAnimalImageResponse[];
      
      const imageUrl = data[0].url;
      
      // Test that we get a valid URL structure
      expect(imageUrl).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i);
      expect(data[0].id).toBeTruthy();
    });

    it('should handle broken image URLs', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.json([{
            id: 'broken123',
            url: 'https://broken.example.com/nonexistent.jpg',
          }]);
        }),
        http.get('https://broken.example.com/nonexistent.jpg', () => {
          return HttpResponse.json(
            { error: 'Not Found' },
            { status: 404 }
          );
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json() as IAnimalImageResponse[];
      
      const imageResponse = await fetch(data[0].url);
      expect(imageResponse.ok).toBe(false);
      expect(imageResponse.status).toBe(404);
    });
  });

  describe('API Performance', () => {
    it('should measure API response times', async () => {
      const startTime = Date.now();
      
      await fetch('https://api.thecatapi.com/v1/images/search');
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        fetch('https://api.thecatapi.com/v1/images/search')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large response payloads', async () => {
      // Mock large response
      const largeResponse = Array.from({ length: 100 }, (_, i) => ({
        id: `cat${i}`,
        url: `https://example.com/cat${i}.jpg`,
        width: 800,
        height: 600,
      }));

      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', () => {
          return HttpResponse.json(largeResponse);
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json() as IAnimalImageResponse[];
      
      expect(data).toHaveLength(100);
      expect(data.every(item => item.id && item.url)).toBe(true);
    });
  });

  describe('Authentication and Headers', () => {
    it('should handle API key authentication', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', ({ request }) => {
          const apiKey = request.headers.get('x-api-key');
          
          if (!apiKey) {
            return HttpResponse.json(
              { message: 'API key required' },
              { status: 401 }
            );
          }
          
          if (apiKey === 'invalid') {
            return HttpResponse.json(
              { message: 'Invalid API key' },
              { status: 403 }
            );
          }
          
          return HttpResponse.json([{
            id: 'authenticated-cat',
            url: 'https://example.com/premium-cat.jpg',
          }]);
        })
      );

      // Test without API key
      const noKeyResponse = await fetch('https://api.thecatapi.com/v1/images/search');
      expect(noKeyResponse.status).toBe(401);

      // Test with invalid API key
      const invalidKeyResponse = await fetch('https://api.thecatapi.com/v1/images/search', {
        headers: { 'x-api-key': 'invalid' }
      });
      expect(invalidKeyResponse.status).toBe(403);

      // Test with valid API key
      const validKeyResponse = await fetch('https://api.thecatapi.com/v1/images/search', {
        headers: { 'x-api-key': 'valid-key' }
      });
      expect(validKeyResponse.status).toBe(200);
    });

    it('should include proper user agent headers', async () => {
      server.use(
        http.get('https://api.thecatapi.com/v1/images/search', ({ request }) => {
          const userAgent = request.headers.get('user-agent');
          
          return HttpResponse.json([{
            id: 'user-agent-test',
            url: 'https://example.com/cat.jpg',
            userAgent: userAgent || 'none',
          }]);
        })
      );

      const response = await fetch('https://api.thecatapi.com/v1/images/search', {
        headers: {
          'User-Agent': 'DyzioBot/2.1.0 Animal Command Integration Test'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as any[];
      expect(data[0].userAgent).toContain('DyzioBot');
    });
  });
});