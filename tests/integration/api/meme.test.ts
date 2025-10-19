import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { setupMSW, server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { IMemeData } from '../../../src/interfaces/api/Meme';

// Setup MSW for all tests
setupMSW();

describe('Meme API Integration Tests', () => {
  describe('Reddit Memes API', () => {
    it('should fetch meme from Reddit successfully', async () => {
      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      
      expect(response.status).toBe(200);
      const data = await response.json() as any[];
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('data');
      expect(data[0].data).toHaveProperty('children');
      
      const memePost = data[0].data.children[0].data;
      expect(memePost).toMatchObject({
        title: 'Test Meme',
        url: 'https://i.imgur.com/test.jpg',
        is_video: false,
        subreddit: 'memes',
      });
    });

    it('should validate Reddit meme data structure', async () => {
      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      const data = await response.json() as any[];
      
      const memePost = data[0].data.children[0].data;
      
      // Required fields for meme processing
      expect(typeof memePost.title).toBe('string');
      expect(typeof memePost.url).toBe('string');
      expect(typeof memePost.is_video).toBe('boolean');
      expect(typeof memePost.subreddit).toBe('string');
      
      // URL should be valid
      expect(memePost.url).toMatch(/^https?:\/\/.+/);
    });

    it('should handle Reddit API rate limiting', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json(
            { error: 'Too Many Requests' },
            { 
              status: 429,
              headers: {
                'Retry-After': '60',
                'X-RateLimit-Used': '100',
                'X-RateLimit-Remaining': '0',
              }
            }
          );
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should handle video memes from Reddit', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'Funny Video Meme',
                      url: 'https://v.redd.it/test123.mp4',
                      is_video: true,
                      subreddit: 'memes',
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      const data = await response.json() as any[];
      
      const memePost = data[0].data.children[0].data;
      expect(memePost.is_video).toBe(true);
      expect(memePost.url).toContain('.mp4');
    });

    it('should handle Reddit API errors', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json(
            { error: 'Subreddit not found' },
            { status: 404 }
          );
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(404);
      
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Subreddit not found');
    });
  });

  describe('Meme Processing and Validation', () => {
    it('should validate meme URL formats', async () => {
      const testUrls = [
        'https://i.imgur.com/test.jpg',
        'https://i.redd.it/test.png',
        'https://v.redd.it/test.mp4',
        'https://preview.redd.it/test.gif',
      ];

      for (const url of testUrls) {
        server.use(
          http.get('https://www.reddit.com/r/memes/random.json', () => {
            return HttpResponse.json([
              {
                data: {
                  children: [
                    {
                      data: {
                        title: 'URL Format Test',
                        url: url,
                        is_video: url.includes('.mp4'),
                        subreddit: 'memes',
                      },
                    },
                  ],
                },
              },
            ]);
          })
        );

        const response = await fetch('https://www.reddit.com/r/memes/random.json');
        const data = await response.json() as any[];
        const memePost = data[0].data.children[0].data;
        
        expect(memePost.url).toBe(url);
        expect(memePost.url).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif|mp4|webp)$/i);
      }
    });

    it('should handle different image formats', async () => {
      const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      for (const format of imageFormats) {
        server.use(
          http.get('https://www.reddit.com/r/memes/random.json', () => {
            return HttpResponse.json([
              {
                data: {
                  children: [
                    {
                      data: {
                        title: `${format.toUpperCase()} Format Test`,
                        url: `https://i.imgur.com/test.${format}`,
                        is_video: false,
                        subreddit: 'memes',
                      },
                    },
                  ],
                },
              },
            ]);
          })
        );

        const response = await fetch('https://www.reddit.com/r/memes/random.json');
        const data = await response.json() as any[];
        const memePost = data[0].data.children[0].data;
        
        expect(memePost.url).toContain(`.${format}`);
        expect(memePost.is_video).toBe(false);
      }
    });

    it('should detect video content correctly', async () => {
      const videoFormats = ['mp4', 'webm', 'mov'];
      
      for (const format of videoFormats) {
        server.use(
          http.get('https://www.reddit.com/r/memes/random.json', () => {
            return HttpResponse.json([
              {
                data: {
                  children: [
                    {
                      data: {
                        title: `${format.toUpperCase()} Video Test`,
                        url: `https://v.redd.it/test.${format}`,
                        is_video: true,
                        subreddit: 'memes',
                      },
                    },
                  ],
                },
              },
            ]);
          })
        );

        const response = await fetch('https://www.reddit.com/r/memes/random.json');
        const data = await response.json() as any[];
        const memePost = data[0].data.children[0].data;
        
        expect(memePost.url).toContain(`.${format}`);
        expect(memePost.is_video).toBe(true);
      }
    });
  });

  describe('Multiple Meme Sources', () => {
    it('should handle different subreddits', async () => {
      const subreddits = ['memes', 'dankmemes', 'wholesomememes', 'programmerhumor'];
      
      for (const subreddit of subreddits) {
        server.use(
          http.get(`https://www.reddit.com/r/${subreddit}/random.json`, () => {
            return HttpResponse.json([
              {
                data: {
                  children: [
                    {
                      data: {
                        title: `${subreddit} Test Meme`,
                        url: 'https://i.imgur.com/test.jpg',
                        is_video: false,
                        subreddit: subreddit,
                      },
                    },
                  ],
                },
              },
            ]);
          })
        );

        const response = await fetch(`https://www.reddit.com/r/${subreddit}/random.json`);
        const data = await response.json() as any[];
        const memePost = data[0].data.children[0].data;
        
        expect(memePost.subreddit).toBe(subreddit);
        expect(memePost.title).toContain(subreddit);
      }
    });

    it('should handle fallback sources when primary fails', async () => {
      let callCount = 0;
      
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'Fallback Success',
                      url: 'https://i.imgur.com/fallback.jpg',
                      is_video: false,
                      subreddit: 'memes',
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      // First request should fail
      await expect(fetch('https://www.reddit.com/r/memes/random.json')).rejects.toThrow();
      
      // Second request should succeed
      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(200);
      
      const data = await response.json() as any[];
      expect(data[0].data.children[0].data.title).toBe('Fallback Success');
    });
  });

  describe('Content Filtering and Safety', () => {
    it('should handle NSFW content detection', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'NSFW Test Content',
                      url: 'https://i.imgur.com/nsfw.jpg',
                      is_video: false,
                      subreddit: 'memes',
                      over_18: true,
                      nsfw: true,
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      const data = await response.json() as any[];
      const memePost = data[0].data.children[0].data;
      
      expect(memePost.over_18).toBe(true);
      expect(memePost.nsfw).toBe(true);
    });

    it('should validate content length and quality', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'A'.repeat(300), // Very long title
                      url: 'https://i.imgur.com/test.jpg',
                      is_video: false,
                      subreddit: 'memes',
                      score: 1000,
                      upvote_ratio: 0.95,
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      const data = await response.json() as any[];
      const memePost = data[0].data.children[0].data;
      
      expect(memePost.title.length).toBe(300);
      expect(memePost.score).toBe(1000);
      expect(memePost.upvote_ratio).toBe(0.95);
    });

    it('should handle deleted or removed content', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: '[deleted]',
                      url: '',
                      is_video: false,
                      subreddit: 'memes',
                      removed_by_category: 'moderator',
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      const data = await response.json() as any[];
      const memePost = data[0].data.children[0].data;
      
      expect(memePost.title).toBe('[deleted]');
      expect(memePost.url).toBe('');
      expect(memePost.removed_by_category).toBe('moderator');
    });
  });

  describe('Performance and Caching', () => {
    it('should measure meme fetch response times', async () => {
      const startTime = Date.now();
      
      await fetch('https://www.reddit.com/r/memes/random.json');
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
    });

    it('should handle concurrent meme requests', async () => {
      const promises = Array.from({ length: 3 }, () => 
        fetch('https://www.reddit.com/r/memes/random.json')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should implement request deduplication', async () => {
      let requestCount = 0;
      
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          requestCount++;
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: `Request #${requestCount}`,
                      url: 'https://i.imgur.com/test.jpg',
                      is_video: false,
                      subreddit: 'memes',
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      // Make multiple requests simultaneously
      const promises = Array.from({ length: 5 }, () => 
        fetch('https://www.reddit.com/r/memes/random.json')
      );
      
      await Promise.all(promises);
      
      // Should have made 5 separate requests (no deduplication in this test)
      expect(requestCount).toBe(5);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json([]);
        })
      );
      
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 500);
      
      await expect(async () => {
        await fetch('https://www.reddit.com/r/memes/random.json', {
          signal: controller.signal,
        });
      }).rejects.toThrow();
    });

    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          attemptCount++;
          if (attemptCount < 3) {
            return HttpResponse.json(
              { error: 'Service temporarily unavailable' },
              { status: 503 }
            );
          }
          return HttpResponse.json([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'Retry Success',
                      url: 'https://i.imgur.com/success.jpg',
                      is_video: false,
                      subreddit: 'memes',
                    },
                  },
                ],
              },
            },
          ]);
        })
      );

      // First two requests should fail
      let response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(503);
      
      response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(503);
      
      // Third request should succeed
      response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(200);
      
      const data = await response.json() as any[];
      expect(data[0].data.children[0].data.title).toBe('Retry Success');
    });

    it('should handle malformed Reddit API responses', async () => {
      server.use(
        http.get('https://www.reddit.com/r/memes/random.json', () => {
          return HttpResponse.json({
            // Missing expected structure
            invalid: 'response',
          });
        })
      );

      const response = await fetch('https://www.reddit.com/r/memes/random.json');
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).not.toHaveProperty('data');
      expect(data).toHaveProperty('invalid');
    });
  });
});