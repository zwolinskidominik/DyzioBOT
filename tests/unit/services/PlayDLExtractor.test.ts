/* ── Mocks ─────────────────────────────────────────── */
const mockExecFile = jest.fn();
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  execFileSync: jest.fn(), // detectPythonCmd() — returns undefined (truthy not needed, just no throw)
  spawn: (...args: any[]) => mockSpawn(...args),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(false), // no cookies.txt in tests
  copyFileSync: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/utils/timeHelpers', () => ({
  formatClock: jest.fn((ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }),
}));

/* Mock Node.js https module used by resolveSpotifyQuery and proxy APIs */
const mockHttpsGet = jest.fn();
const mockHttpsRequest = jest.fn();
jest.mock('https', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockHttpsGet(...args),
    request: (...args: any[]) => mockHttpsRequest(...args),
  },
}));

/**
 * Simulate a successful HTTPS GET response.
 * Call before the code under test invokes https.get().
 */
function simulateHttpsResponse(statusCode: number, body: string) {
  mockHttpsGet.mockImplementation((_url: any, _opts: any, callback: any) => {
    const dataHandlers: Function[] = [];
    const endHandlers: Function[] = [];
    const res: any = {
      statusCode,
      setEncoding: jest.fn(),
      on: jest.fn((event: string, cb: Function): any => {
        if (event === 'data') dataHandlers.push(cb);
        if (event === 'end') endHandlers.push(cb);
        return res;
      }),
      resume: jest.fn(),
    };

    // Call the response callback (registers data/end handlers)
    callback(res);

    // Trigger events — only emit data if status is OK
    if (statusCode >= 200 && statusCode < 300) {
      dataHandlers.forEach(h => h(body));
    }
    endHandlers.forEach(h => h());

    // Return mock request object
    return { on: jest.fn().mockReturnThis(), destroy: jest.fn() };
  });
}

/** Simulate an HTTPS network error (before response). */
function simulateHttpsError(error: Error) {
  mockHttpsGet.mockImplementation((_url: any, _opts: any, _callback: any) => {
    const errorHandlers: Function[] = [];
    const req: any = {
      on: jest.fn((event: string, cb: Function): any => {
        if (event === 'error') errorHandlers.push(cb);
        return req;
      }),
      destroy: jest.fn(),
    };
    // Fire error asynchronously (after req.on handlers are registered)
    Promise.resolve().then(() => errorHandlers.forEach(h => h(error)));
    return req;
  });
}

// Mock discord-player
const mockTrackInstances: any[] = [];
jest.mock('discord-player', () => ({
  BaseExtractor: class {
    context = { player: { id: 'mock-player' } };
    protocols: string[] = [];
    createResponse(playlist: any, tracks: any[]) {
      return { playlist, tracks };
    }
  },
  Track: jest.fn().mockImplementation((_player: any, data: any) => {
    const t = { ...data, extractor: null };
    mockTrackInstances.push(t);
    return t;
  }),
  Playlist: jest.fn().mockImplementation((_player: any, data: any) => ({
    ...data,
    tracks: data.tracks || [],
  })),
  GuildQueueHistory: jest.fn(),
}));

import { PlayDLExtractor } from '../../../src/services/PlayDLExtractor';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

/* ── Helpers ──────────────────────────────────────── */

function simulateExecFile(stdout: string, error: Error | null = null) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
    cb(error, stdout, '');
  });
}

function simulateExecFileError(error: Error) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
    cb(error, '', 'error');
  });
}

/** Create a mock child process for spawn() that emits audio data on stdout. */
function createMockChildProcess(options: { audioData?: string; exitCode?: number; stderrData?: string }) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as any;
  child.stdout = stdout;
  child.stderr = stderr;
  child.killed = false;
  child.kill = jest.fn(() => { child.killed = true; });

  // Schedule events asynchronously
  process.nextTick(() => {
    if (options.stderrData) stderr.write(options.stderrData);
    if (options.audioData) {
      stdout.write(Buffer.from(options.audioData));
    }
    if (options.exitCode !== undefined && !options.audioData) {
      // Only emit close if there's no data (error case)
      stdout.end();
      stderr.end();
      child.emit('close', options.exitCode);
    } else if (options.audioData) {
      // Normal end after data
      setTimeout(() => {
        stdout.end();
        stderr.end();
        child.emit('close', 0);
      }, 10);
    }
  });

  return child;
}

/** Make spawn return a successful audio stream. */
function simulateSpawnSuccess(audioData = 'fake-audio-data') {
  mockSpawn.mockImplementation(() => createMockChildProcess({ audioData }));
}

/** Make spawn return a failed process. */
function simulateSpawnError(stderrMsg = 'yt-dlp error', exitCode = 1) {
  mockSpawn.mockImplementation(() => createMockChildProcess({ exitCode, stderrData: stderrMsg }));
}

describe('PlayDLExtractor', () => {
  let extractor: PlayDLExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackInstances.length = 0;
    extractor = new PlayDLExtractor({ player: { id: 'mock-player' } } as any, {});
  });

  /* ── activate / deactivate ──────────────────────── */
  describe('activate', () => {
    it('sets protocols to https and http and logs yt-dlp version', async () => {
      simulateExecFile('2025.01.15');
      await extractor.activate();
      expect((extractor as any).protocols).toEqual(['https', 'http']);
    });

    it('activates even if yt-dlp version check fails', async () => {
      simulateExecFileError(new Error('yt-dlp not found'));
      await extractor.activate();
      expect((extractor as any).protocols).toEqual(['https', 'http']);
    });
  });

  describe('deactivate', () => {
    it('resolves without error', async () => {
      await expect(extractor.deactivate()).resolves.toBeUndefined();
    });
  });

  /* ── validate ───────────────────────────────────── */
  describe('validate', () => {
    it('returns true for youtube.com URL', async () => {
      expect(await extractor.validate('https://youtube.com/watch?v=abc')).toBe(true);
    });

    it('returns true for youtu.be URL', async () => {
      expect(await extractor.validate('https://youtu.be/abc')).toBe(true);
    });

    it('returns true for search query (non-URL)', async () => {
      expect(await extractor.validate('never gonna give you up')).toBe(true);
    });

    it('returns true for youtubeSearch type', async () => {
      expect(await extractor.validate('test', 'youtubeSearch' as any)).toBe(true);
    });

    it('returns false for non-string input', async () => {
      expect(await extractor.validate(123 as any)).toBe(false);
    });

    it('returns true for Spotify URL', async () => {
      expect(await extractor.validate('https://open.spotify.com/track/abc123')).toBe(true);
    });

    it('returns true for SoundCloud URL', async () => {
      expect(await extractor.validate('https://soundcloud.com/artist/track')).toBe(true);
    });

    it('returns true for any HTTP URL (yt-dlp supports 1000+ sites)', async () => {
      expect(await extractor.validate('https://example.com/video', 'spotifySong' as any)).toBe(true);
    });
  });

  /* ── handle: single video URL ───────────────────── */
  describe('handle - single video URL', () => {
    it('returns track for a single YouTube video URL', async () => {
      const videoJson = JSON.stringify({
        title: 'Test Video',
        channel: 'TestChannel',
        webpage_url: 'https://youtube.com/watch?v=abc',
        thumbnail: 'https://img.youtube.com/vi/abc/0.jpg',
        duration: 240,
        view_count: 1000,
      });
      simulateExecFile(videoJson);

      const result = await extractor.handle('https://youtube.com/watch?v=abc', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(1);
      expect(result.tracks[0].title).toBe('Test Video');
      expect(result.playlist).toBeNull();
    });

    it('handles yt-dlp error for video URL', async () => {
      simulateExecFileError(new Error('yt-dlp failed'));

      const result = await extractor.handle('https://youtube.com/watch?v=abc', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: playlist ───────────────────────────── */
  describe('handle - playlist', () => {
    it('returns tracks for a playlist URL', async () => {
      const line1 = JSON.stringify({
        title: 'Video 1', channel: 'Ch1', webpage_url: 'https://youtube.com/watch?v=1',
        duration: 120, view_count: 100, playlist_title: 'My Playlist',
      });
      const line2 = JSON.stringify({
        title: 'Video 2', channel: 'Ch2', webpage_url: 'https://youtube.com/watch?v=2',
        duration: 180, view_count: 200,
      });
      simulateExecFile(`${line1}\n${line2}`);

      const result = await extractor.handle('https://youtube.com/playlist?list=PLtest', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(2);
      expect(result.playlist).not.toBeNull();
    });

    it('falls back to single video when playlist fails and URL has video ID', async () => {
      // First call (playlist) fails, second call (video) succeeds
      let callCount = 0;
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        callCount++;
        if (callCount === 1) {
          cb(new Error('playlist failed'), '', 'error');
        } else {
          const videoJson = JSON.stringify({
            title: 'Fallback Video', channel: 'Ch', webpage_url: 'https://youtube.com/watch?v=abc',
            duration: 120, view_count: 50,
          });
          cb(null, videoJson, '');
        }
      });

      const result = await extractor.handle('https://youtube.com/watch?v=abc&list=PLtest', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(1);
      expect(result.tracks[0].title).toBe('Fallback Video');
    });
  });

  /* ── handle: search ─────────────────────────────── */
  describe('handle - search', () => {
    it('returns tracks for a search query', async () => {
      const line1 = JSON.stringify({
        title: 'Result 1', channel: 'Ch1', webpage_url: 'https://youtube.com/watch?v=r1',
        duration: 200, view_count: 5000,
      });
      const line2 = JSON.stringify({
        title: 'Result 2', channel: 'Ch2', url: 'https://youtube.com/watch?v=r2',
        duration: 300, view_count: 3000,
      });
      simulateExecFile(`${line1}\n${line2}`);

      const result = await extractor.handle('never gonna give you up', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(2);
      expect(result.playlist).toBeNull();
    });

    it('handles search error', async () => {
      simulateExecFileError(new Error('search failed'));

      const result = await extractor.handle('broken search', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: URL normalization ──────────────────── */
  describe('handle - URL normalization', () => {
    it('normalizes URL starting with //', async () => {
      const videoJson = JSON.stringify({
        title: 'Normalized', channel: 'Ch', duration: 100,
      });
      simulateExecFile(videoJson);

      const result = await extractor.handle('//www.youtube.com/watch?v=abc', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(1);
    });

    it('normalizes URL without protocol', async () => {
      const videoJson = JSON.stringify({
        title: 'NoProto', channel: 'Ch', duration: 100,
      });
      simulateExecFile(videoJson);

      const result = await extractor.handle('youtube.com/watch?v=abc', {
        requestedBy: { id: 'user1' },
      } as any);

      expect(result.tracks.length).toBe(1);
    });
  });

  /* ── stream ─────────────────────────────────────── */
  describe('stream', () => {
    // In tests: no cookies → strategies = [ios, tv_embedded, mweb] (3 strategies).
    // stream() tries: pipe → Piped API → URL (first 2) → search (first 2).
    // Test URLs use short IDs (<11 chars) so Piped API is skipped unless specified.

    it('returns a stream when pipe approach succeeds on first try', async () => {
      simulateSpawnSuccess('audio-bytes');

      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=abc' } as any);
      expect(result).toBeInstanceOf(PassThrough);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('succeeds on a later player-client strategy when first fails', async () => {
      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        if (spawnCount === 1) {
          return createMockChildProcess({ exitCode: 1, stderrData: 'bot detected' });
        }
        return createMockChildProcess({ audioData: 'audio-ok' });
      });

      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=abc' } as any);
      expect(result).toBeInstanceOf(PassThrough);
      expect(spawnCount).toBe(2);
    });

    it('falls back to Cobalt API when all pipe attempts fail', async () => {
      simulateSpawnError('pipe failed');
      // Mock https.request for Cobalt POST
      mockHttpsRequest.mockImplementation((_opts: any, callback: any) => {
        const res: any = {
          statusCode: 200,
          setEncoding: jest.fn(),
          on: jest.fn((event: string, cb: Function): any => {
            if (event === 'data') setTimeout(() => cb(JSON.stringify({
              status: 'tunnel',
              url: 'https://cobalt-cdn.example.com/audio.opus',
            })), 0);
            if (event === 'end') setTimeout(() => cb(), 1);
            return res;
          }),
          resume: jest.fn(),
        };
        callback(res);
        return { on: jest.fn().mockReturnThis(), destroy: jest.fn(), write: jest.fn(), end: jest.fn() };
      });

      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } as any);
      expect(result).toBe('https://cobalt-cdn.example.com/audio.opus');
    });

    it('falls back to Piped API when pipe and Cobalt fail', async () => {
      simulateSpawnError('pipe failed');
      // Make Cobalt fail (https.request)
      mockHttpsRequest.mockImplementation((_opts: any, callback: any) => {
        const res: any = { statusCode: 500, resume: jest.fn(), setEncoding: jest.fn(), on: jest.fn().mockReturnThis() };
        callback(res);
        return { on: jest.fn().mockReturnThis(), destroy: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      // Make Piped succeed (https.get)
      simulateHttpsResponse(200, JSON.stringify({
        audioStreams: [
          { url: 'https://pipedproxy.kavin.rocks/audioplayback?id=test', mimeType: 'audio/webm', bitrate: 128000 },
        ],
      }));

      // Use 11-char video ID so extractYouTubeId returns a valid ID
      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } as any);
      expect(result).toBe('https://pipedproxy.kavin.rocks/audioplayback?id=test');
    });

    it('falls back to Invidious when pipe and Piped fail', async () => {
      simulateSpawnError('pipe failed');
      // First 3 calls are Piped (fail with 403), next 3 are Invidious (first succeeds)
      let httpCallCount = 0;
      mockHttpsGet.mockImplementation((_url: any, _opts: any, callback: any) => {
        httpCallCount++;
        const urlStr = typeof _url === 'string' ? _url : '';
        if (urlStr.includes('/api/v1/videos/')) {
          // Invidious response
          const res: any = {
            statusCode: 200,
            setEncoding: jest.fn(),
            on: jest.fn((event: string, cb: Function): any => {
              if (event === 'data') setTimeout(() => cb(JSON.stringify({
                adaptiveFormats: [
                  { type: 'audio/webm; codecs="opus"', bitrate: 128000, url: 'https://inv.nadeko.net/latest_version?id=test' },
                ],
              })), 0);
              if (event === 'end') setTimeout(() => cb(), 1);
              return res;
            }),
            resume: jest.fn(),
          };
          callback(res);
        } else {
          // Piped response — return 403
          const res: any = { statusCode: 403, resume: jest.fn(), setEncoding: jest.fn(), on: jest.fn().mockReturnThis() };
          callback(res);
        }
        return { on: jest.fn().mockReturnThis(), destroy: jest.fn() };
      });

      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } as any);
      expect(result).toBe('https://inv.nadeko.net/latest_version?id=test');
    });

    it('falls back to URL approach when pipe and Piped fail', async () => {
      simulateSpawnError('pipe failed');
      simulateExecFile('https://cdn.audio.googlevideo.com/audio.webm');

      const result = await extractor.stream({ url: 'https://youtube.com/watch?v=abc' } as any);
      expect(result).toBe('https://cdn.audio.googlevideo.com/audio.webm');
    });

    it('falls back to search when pipe, Piped, and URL all fail', async () => {
      simulateSpawnError('pipe failed');
      simulateExecFileError(new Error('url failed'));

      // Override spawn: first 3 are pipe attempts (fail), next are search (succeed)
      let spawnCallCount = 0;
      const totalPipeAttempts = 3; // ios, tv_embedded, mweb
      mockSpawn.mockImplementation(() => {
        spawnCallCount++;
        if (spawnCallCount <= totalPipeAttempts) {
          return createMockChildProcess({ exitCode: 1, stderrData: 'pipe failed' });
        }
        return createMockChildProcess({ audioData: 'search-audio' });
      });

      const result = await extractor.stream({
        url: 'https://youtube.com/watch?v=abc',
        title: 'Test Song',
        author: 'Test Artist',
      } as any);
      expect(result).toBeInstanceOf(PassThrough);
    });

    it('throws when all stream attempts fail', async () => {
      simulateSpawnError('all failed');
      simulateExecFileError(new Error('all failed'));

      await expect(
        extractor.stream({ url: 'https://youtube.com/watch?v=abc', title: 'Test', author: 'A' } as any)
      ).rejects.toThrow('All stream attempts failed');
    });
  });

  /* ── getRelatedTracks ───────────────────────────── */
  describe('getRelatedTracks', () => {
    it('returns related tracks', async () => {
      const line = JSON.stringify({
        title: 'Related', channel: 'RelCh', duration: 180, view_count: 100,
      });
      simulateExecFile(line);

      const result = await extractor.getRelatedTracks(
        { title: 'Test', author: 'Author' } as any,
        {} as any
      );

      expect(result.tracks.length).toBe(1);
      expect(result.tracks[0].title).toBe('Related');
    });

    it('returns empty on error', async () => {
      simulateExecFileError(new Error('related failed'));

      const result = await extractor.getRelatedTracks(
        { title: 'Test', author: 'Author' } as any,
        {} as any
      );

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: Spotify track ────────────────────────── */
  describe('handle - Spotify track', () => {
    it('resolves Spotify track by parsing page <title> and searches YouTube', async () => {
      // Mock Spotify page HTML with title + artist
      const spotifyHtml = '<html><head><title>Never Gonna Give You Up - song and lyrics by Rick Astley | Spotify</title></head></html>';
      simulateHttpsResponse(200, spotifyHtml);

      // Mock yt-dlp YouTube search result
      const ytResult = JSON.stringify({
        title: 'Never Gonna Give You Up',
        channel: 'Rick Astley',
        webpage_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 213,
        view_count: 1_500_000_000,
      });
      simulateExecFile(ytResult);

      const result = await extractor.handle(
        'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8?si=abc',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.tracks[0].title).toBe('Never Gonna Give You Up');
      // Verify it fetched the Spotify page
      expect(mockHttpsGet).toHaveBeenCalledWith(
        expect.stringContaining('open.spotify.com/track/'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('handles protocol-stripped Spotify URL (//open.spotify.com/...)', async () => {
      // discord-player strips "https:" → query arrives as "//open.spotify.com/..."
      const spotifyHtml = '<html><head><title>Surface Tension - song and lyrics by Raje | Spotify</title></head></html>';
      simulateHttpsResponse(200, spotifyHtml);

      const ytResult = JSON.stringify({
        title: 'Surface Tension',
        channel: 'Raje',
        webpage_url: 'https://youtube.com/watch?v=xyz',
        duration: 200,
        view_count: 50000,
      });
      simulateExecFile(ytResult);

      const result = await extractor.handle(
        '//open.spotify.com/track/2riwBQpw3aFIcs9OTmZS1e?si=5ec6b1e090c447d2',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.tracks[0].title).toBe('Surface Tension');
    });

    it('uses fallback title if page title has no "by" pattern', async () => {
      // Spotify page with non-standard title
      const spotifyHtml = '<html><head><title>Some Track | Spotify</title></head></html>';
      simulateHttpsResponse(200, spotifyHtml);

      const ytResult = JSON.stringify({
        title: 'Some Track',
        channel: 'Artist',
        webpage_url: 'https://youtube.com/watch?v=xyz',
        duration: 180,
        view_count: 1000,
      });
      simulateExecFile(ytResult);

      const result = await extractor.handle(
        'https://open.spotify.com/track/abc123',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBeGreaterThan(0);
    });

    it('falls back to yt-dlp when Spotify page returns non-200', async () => {
      simulateHttpsResponse(404, '');
      simulateExecFileError(new Error('yt-dlp cannot handle spotify'));

      const result = await extractor.handle(
        'https://open.spotify.com/track/abc123',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });

    it('falls back to yt-dlp when page has no <title> tag', async () => {
      simulateHttpsResponse(200, '<html><head></head></html>');
      simulateExecFileError(new Error('no spotify support'));

      const result = await extractor.handle(
        'https://open.spotify.com/track/abc123',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });

    it('falls back to yt-dlp when network fails', async () => {
      simulateHttpsError(new Error('ECONNREFUSED'));
      simulateExecFileError(new Error('no spotify support'));

      const result = await extractor.handle(
        'https://open.spotify.com/track/abc123',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: Spotify playlist/album ─────────────── */
  describe('handle - Spotify playlist', () => {
    it('resolves Spotify playlist by parsing page <title> and searches YouTube', async () => {
      const spotifyHtml = '<html><head><title>Chill Vibes - playlist by DJ Cool | Spotify</title></head></html>';
      simulateHttpsResponse(200, spotifyHtml);

      const ytLine = JSON.stringify({
        title: 'Chill Song',
        channel: 'Artist',
        webpage_url: 'https://youtube.com/watch?v=xyz',
        duration: 200,
        view_count: 50000,
      });
      simulateExecFile(ytLine);

      const result = await extractor.handle(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.playlist).not.toBeNull();
      expect(result.playlist!.title).toBe('Chill Vibes DJ Cool');
    });

    it('resolves Spotify album by parsing page <title>', async () => {
      const spotifyHtml = '<html><head><title>My Album - Album by The Artist | Spotify</title></head></html>';
      simulateHttpsResponse(200, spotifyHtml);

      const ytLine = JSON.stringify({
        title: 'Album Track',
        channel: 'The Artist',
        webpage_url: 'https://youtube.com/watch?v=alb1',
        duration: 180,
        view_count: 10000,
      });
      simulateExecFile(ytLine);

      const result = await extractor.handle(
        'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.playlist).not.toBeNull();
    });

    it('falls back to yt-dlp when Spotify playlist page fetch fails', async () => {
      simulateHttpsError(new Error('network error'));
      simulateExecFileError(new Error('no spotify'));

      const result = await extractor.handle(
        'https://open.spotify.com/playlist/abc123',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: SoundCloud track ───────────────────── */
  describe('handle - SoundCloud track', () => {
    it('extracts SoundCloud track natively via yt-dlp', async () => {
      const scResult = JSON.stringify({
        title: 'Cool Beat',
        uploader: 'DJ Producer',
        webpage_url: 'https://soundcloud.com/djproducer/cool-beat',
        duration: 245,
        view_count: 12000,
      });
      simulateExecFile(scResult);

      const result = await extractor.handle(
        'https://soundcloud.com/djproducer/cool-beat',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(1);
      expect(result.tracks[0].title).toBe('Cool Beat');
      expect(result.tracks[0].source).toBe('soundcloud');
    });

    it('handles protocol-stripped SoundCloud URL (//soundcloud.com/...)', async () => {
      const scResult = JSON.stringify({
        title: 'Stripped Track',
        uploader: 'Artist',
        webpage_url: 'https://soundcloud.com/artist/stripped-track',
        duration: 180,
        view_count: 500,
      });
      simulateExecFile(scResult);

      const result = await extractor.handle(
        '//soundcloud.com/artist/stripped-track',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(1);
      expect(result.tracks[0].title).toBe('Stripped Track');
    });

    it('returns empty on yt-dlp error for SoundCloud track', async () => {
      simulateExecFileError(new Error('soundcloud extraction failed'));

      const result = await extractor.handle(
        'https://soundcloud.com/artist/some-track',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── handle: SoundCloud set (playlist) ──────────── */
  describe('handle - SoundCloud set', () => {
    it('extracts SoundCloud set as playlist via yt-dlp', async () => {
      const line1 = JSON.stringify({
        title: 'Track 1', uploader: 'DJ', webpage_url: 'https://soundcloud.com/dj/t1',
        duration: 200, view_count: 1000, playlist_title: 'My Set',
      });
      const line2 = JSON.stringify({
        title: 'Track 2', uploader: 'DJ', webpage_url: 'https://soundcloud.com/dj/t2',
        duration: 180, view_count: 800,
      });
      simulateExecFile(`${line1}\n${line2}`);

      const result = await extractor.handle(
        'https://soundcloud.com/dj/sets/my-set',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(2);
      expect(result.playlist).not.toBeNull();
      expect(result.playlist!.title).toBe('My Set');
      expect(result.tracks[0].source).toBe('soundcloud');
    });

    it('returns empty on yt-dlp error for SoundCloud set', async () => {
      simulateExecFileError(new Error('sc set failed'));

      const result = await extractor.handle(
        'https://soundcloud.com/artist/sets/my-set',
        { requestedBy: { id: 'user1' } } as any
      );

      expect(result.tracks.length).toBe(0);
    });
  });

  /* ── static identifier ──────────────────────────── */
  describe('static properties', () => {
    it('has correct identifier', () => {
      expect(PlayDLExtractor.identifier).toBe('com.playdl.extractor');
    });
  });
});
