import { http, HttpResponse } from 'msw';
import { IStreamData, IUserData } from '../../../src/interfaces/api/Twitch';
import { IAnimalImageResponse } from '../../../src/interfaces/api/Animal';
import { IMemeData } from '../../../src/interfaces/api/Meme';
import { IFaceitPlayer, ICS2Stats } from '../../../src/interfaces/api/Faceit';

// Mock data for responses
const mockTwitchStreamData: IStreamData = {
  id: '123456789',
  user_id: '987654321',
  user_login: 'teststreamer',
  user_name: 'TestStreamer',
  game_id: '516575',
  type: 'live',
  title: 'Test Stream Title',
  viewer_count: 1337,
  started_at: '2025-09-20T10:00:00Z',
  language: 'en',
  thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-{width}x{height}.jpg',
  is_mature: false,
};

const mockTwitchUserData: IUserData = {
  id: '987654321',
  login: 'teststreamer',
  display_name: 'TestStreamer',
  type: '',
  broadcaster_type: 'partner',
  description: 'Test streamer description',
  profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/test-profile.png',
  offline_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/test-offline.png',
  view_count: 50000,
  created_at: '2020-01-01T00:00:00Z',
};

const mockAnimalImage: IAnimalImageResponse = {
  id: 'cat123',
  url: 'https://cdn2.thecatapi.com/images/test.jpg',
  width: 800,
  height: 600,
};

const mockMemeData: IMemeData = {
  title: 'Test Meme',
  url: 'https://i.imgur.com/test.jpg',
  isVideo: false,
  source: 'reddit',
};

const mockFaceitPlayer: IFaceitPlayer = {
  player_id: 'test-player-id',
  nickname: 'TestPlayer',
  avatar: 'https://avatar.test.com/test.jpg',
  country: 'PL',
  steam_id_64: '76561198000000000',
  activated_at: '2020-01-01T00:00:00Z',
  games: {
    cs2: {
      skill_level: 7,
      faceit_elo: 1500,
    },
  },
};

const mockCS2Stats: ICS2Stats = {
  lifetime: {
    'Average K/D Ratio': '1.25',
    'Average Headshots %': '45%',
    'Total Headshots': '1250',
    'Win Rate %': '65%',
    Matches: '100',
    Wins: '65',
  },
};

// MSW Request Handlers
export const handlers = [
  // Twitch CDN thumbnails and images (catch-all to avoid unhandled requests in tests)
  http.get('https://static-cdn.jtvnw.net/:rest*', () => {
    return HttpResponse.arrayBuffer(new ArrayBuffer(0));
  }),

  // Twitch API - Get Streams
  http.get('https://api.twitch.tv/helix/streams', ({ request }) => {
    const url = new URL(request.url);
    const userLogin = url.searchParams.get('user_login');
    
    if (userLogin === 'teststreamer') {
      return HttpResponse.json({
        data: [mockTwitchStreamData],
        pagination: {},
      });
    }
    
    if (userLogin === 'offline_streamer') {
      return HttpResponse.json({
        data: [],
        pagination: {},
      });
    }
    
    if (userLogin === 'error_test') {
      return HttpResponse.json(
        { error: 'User not found', status: 404, message: 'User not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({ data: [], pagination: {} });
  }),

  // Twitch API - Get Users
  http.get('https://api.twitch.tv/helix/users', ({ request }) => {
    const url = new URL(request.url);
    const login = url.searchParams.get('login');
    
    if (login === 'teststreamer') {
      return HttpResponse.json({
        data: [mockTwitchUserData],
      });
    }
    
    if (login === 'error_test') {
      return HttpResponse.json(
        { error: 'User not found', status: 404, message: 'User not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({ data: [] });
  }),

  // Cat API
  http.get('https://api.thecatapi.com/v1/images/search', () => {
    return HttpResponse.json([mockAnimalImage]);
  }),

  // Dog API
  http.get('https://api.thedogapi.com/v1/images/search', () => {
    return HttpResponse.json([
      {
        id: 'dog123',
        url: 'https://cdn2.thedogapi.com/images/test.jpg',
        width: 800,
        height: 600,
      },
    ]);
  }),

  // Fox API
  http.get('https://randomfox.ca/floof/', () => {
    return HttpResponse.json({
      image: 'https://randomfox.ca/images/test.jpg',
      link: 'https://randomfox.ca/?i=test',
    });
  }),

  // Reddit Memes
  http.get('https://www.reddit.com/r/memes/random.json', () => {
    return HttpResponse.json([
      {
        data: {
          children: [
            {
              data: {
                title: mockMemeData.title,
                url: mockMemeData.url,
                is_video: mockMemeData.isVideo,
                subreddit: 'memes',
              },
            },
          ],
        },
      },
    ]);
  }),

  // Faceit API - Get Player
  http.get('https://open-api.faceit.com/data/v4/players', ({ request }) => {
    const url = new URL(request.url);
    const nickname = url.searchParams.get('nickname');
    
    if (nickname === 'TestPlayer') {
      return HttpResponse.json(mockFaceitPlayer);
    }
    
    if (nickname === 'error_test') {
      return HttpResponse.json(
        { errors: [{ message: 'Player not found' }] },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(
      { errors: [{ message: 'Player not found' }] },
      { status: 404 }
    );
  }),

  // Faceit API - Get Player Stats
  http.get('https://open-api.faceit.com/data/v4/players/:playerId/stats/cs2', ({ params }) => {
    const { playerId } = params;
    
    if (playerId === 'test-player-id') {
      return HttpResponse.json(mockCS2Stats);
    }
    
    return HttpResponse.json(
      { errors: [{ message: 'Stats not found' }] },
      { status: 404 }
    );
  }),

  // Rate Limiting Test Endpoint
  http.get('https://api.twitch.tv/helix/rate-limit-test', () => {
    return HttpResponse.json(
      { error: 'Too Many Requests', status: 429, message: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '800',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
        }
      }
    );
  }),

  // Network Error Test
  http.get('https://api.test.com/network-error', () => {
    return HttpResponse.error();
  }),

  // Timeout Test (delayed response)
  http.get('https://api.test.com/timeout-test', async () => {
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10s delay
    return HttpResponse.json({ message: 'This should timeout' });
  }),
];