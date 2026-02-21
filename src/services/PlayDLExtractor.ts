import { BaseExtractor, Track, SearchQueryType, ExtractorSearchContext, ExtractorStreamable, ExtractorInfo, Playlist, GuildQueueHistory } from 'discord-player';
import { execFile, execFileSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { formatClock } from '../utils/timeHelpers';
import logger from '../utils/logger';

// Detect python command: prefer 'python3' (Ubuntu/Debian), fall back to 'python' (Windows/venv)
function detectPythonCmd(): string {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { timeout: 5000, stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return 'python3'; // fallback, will produce a clear error if neither exists
}

const YT_DLP_CMD = detectPythonCmd();
const YT_DLP_ARGS = ['-m', 'yt_dlp'];

// YouTube authentication — prevents "Sign in to confirm you're not a bot" on VPS.
// Strategy (in priority order):
// 1. cookies.txt file (manual export from browser, expires after weeks)
// 2. OAuth2 token (auto-renewing, stored in yt-dlp cache dir)
const COOKIES_PATHS = [
  path.resolve(process.cwd(), 'cookies.txt'),
  path.resolve(__dirname, '..', '..', 'cookies.txt'),
  '/app/cookies.txt',
];
const COOKIES_FILE = COOKIES_PATHS.find(p => existsSync(p)) ?? null;

// yt-dlp writes updated cookies back to the file, so if the source is
// read-only (e.g. Docker bind mount with :ro), copy to a writable location.
function getWritableCookiesPath(): string | null {
  if (!COOKIES_FILE) return null;
  const writablePath = path.join(os.tmpdir(), 'yt-dlp-cookies.txt');
  try {
    copyFileSync(COOKIES_FILE, writablePath);
    return writablePath;
  } catch {
    return COOKIES_FILE; // fallback to original if copy fails
  }
}

const WRITABLE_COOKIES = getWritableCookiesPath();

function getAuthArgs(): string[] {
  if (WRITABLE_COOKIES) return ['--cookies', WRITABLE_COOKIES];
  // OAuth2 — yt-dlp caches the token and auto-refreshes it
  return ['--username', 'oauth2', '--password', ''];
}

function execYtDlp(extraArgs: string[], args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP_CMD, [...YT_DLP_ARGS, ...extraArgs, ...args], {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 50,
    }, (error, stdout, _stderr) => {
      // Even if exit code is non-zero, if we got stdout data, use it
      if (stdout && stdout.trim()) {
        resolve(stdout.trim());
      } else if (error) {
        reject(error);
      } else {
        resolve('');
      }
    });
  });
}

async function runYtDlp(...args: string[]): Promise<string> {
  return execYtDlp(getAuthArgs(), args);
}

async function runYtDlpNoAuth(...args: string[]): Promise<string> {
  return execYtDlp([], args);
}

/** Helper: perform an HTTPS GET and return the response body as a string. */
function httpsGet(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      // Follow one redirect (301/302)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        res.resume();
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

/**
 * Resolve a Spotify URL to a YouTube search query.
 * Fetches the Spotify page HTML and parses the <title> tag to get
 * both the track/playlist name AND the artist.
 * 
 * Title formats:
 *   Track:    "Song Name - song and lyrics by Artist | Spotify"
 *   Album:    "Album Name - Album by Artist | Spotify"
 *   Playlist: "Playlist Name - playlist by User | Spotify"
 * 
 * Returns a search query string like "Song Name Artist" or null on failure.
 */
async function resolveSpotifyQuery(spotifyUrl: string): Promise<string | null> {
  try {
    const html = await httpsGet(spotifyUrl);
    
    // Extract <title>...</title>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (!titleMatch) {
      logger.warn(`[Spotify] No <title> tag found in page HTML for ${spotifyUrl}`);
      return null;
    }

    const pageTitle = titleMatch[1].trim();

    // Parse known title formats: "Name - ... by Artist | Spotify"
    const byMatch = pageTitle.match(
      /^(.+?)\s*[-–—]\s*(?:song and lyrics by|Album by|playlist by|EP by|Single by)\s+(.+?)\s*\|\s*Spotify$/i
    );
    if (byMatch) {
      const name = byMatch[1].trim();
      const artist = byMatch[2].trim();
      return `${name} ${artist}`;
    }

    // Fallback: remove " | Spotify" suffix and use whatever remains
    const fallback = pageTitle.replace(/\s*\|\s*Spotify\s*$/i, '').trim();
    if (fallback) {
      return fallback;
    }

    return null;
  } catch (err) {
    logger.error(`[Spotify] Failed to resolve ${spotifyUrl}: ${err}`);
    return null;
  }
}

export class PlayDLExtractor extends BaseExtractor {
  static identifier = 'com.playdl.extractor' as const;

  async activate(): Promise<void> {
    this.protocols = ['https', 'http'];
  }

  async deactivate(): Promise<void> {}

  /** Build a Track from yt-dlp JSON output, binding it to this extractor. */
  private buildTrack(
    info: Record<string, unknown>,
    opts?: { requestedBy?: ExtractorSearchContext['requestedBy']; playlist?: Playlist; urlFallback?: string; source?: string },
  ): Track {
    const src = (opts?.source || 'youtube') as 'youtube' | 'soundcloud' | 'spotify' | 'arbitrary';
    const track = new Track(this.context.player, {
      title: (info.title as string) || 'Unknown',
      author: (info.channel as string) || (info.uploader as string) || 'Unknown',
      url: (info.webpage_url as string) || (info.url as string) || opts?.urlFallback || `https://youtube.com/watch?v=${info.id}`,
      thumbnail: (info.thumbnail as string) || (info.thumbnails as { url: string }[])?.[0]?.url || '',
      duration: formatClock(((info.duration as number) || 0) * 1000),
      views: (info.view_count as number) || 0,
      requestedBy: opts?.requestedBy,
      source: src,
      raw: info,
      queryType: src === 'soundcloud' ? 'soundcloudTrack' as any : 'youtubeVideo',
      playlist: opts?.playlist,
    });
    track.extractor = this;
    return track;
  }

  async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
    if (typeof query !== 'string') return false;
    // Accept YouTube URLs
    const isYT = query.includes('youtube.com') || query.includes('youtu.be');
    if (isYT) return true;
    // Accept search queries
    const isSearch = type === 'youtubeSearch' || !query.startsWith('http');
    if (isSearch) return true;
    // Accept Spotify URLs (yt-dlp resolves them via YouTube)
    if (query.includes('open.spotify.com/')) return true;
    // Accept SoundCloud URLs
    if (query.includes('soundcloud.com/')) return true;
    // Accept any other URL — yt-dlp supports 1000+ sites
    if (query.startsWith('http://') || query.startsWith('https://')) return true;
    return false;
  }

  async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const tracks: Track[] = [];
    let playlist: Playlist | null = null;

    try {
      // discord-player strips "https:" from URLs, so we may receive:
      //   "//open.spotify.com/track/..." or "//www.youtube.com/watch?v=..."
      // Detect URL by checking multiple patterns
      const looksLikeURL = query.startsWith('http://') || query.startsWith('https://') 
        || query.startsWith('//')
        || query.includes('youtube.com/') || query.includes('youtu.be/')
        || query.includes('open.spotify.com/')
        || query.includes('soundcloud.com/');
      const isURL = looksLikeURL;
      
      // Normalize: ensure URL has proper protocol prefix for yt-dlp
      // discord-player strips "https:" but leaves "//www.youtube.com/..."
      let normalizedQuery = query;
      if (isURL && !query.startsWith('http://') && !query.startsWith('https://')) {
        if (query.startsWith('//')) {
          normalizedQuery = 'https:' + query;
        } else {
          normalizedQuery = 'https://' + query;
        }
      }
      
      const hasVideoId = query.includes('watch?v=') || query.includes('youtu.be/');
      const hasList = query.includes('list=');
      // Detect Spotify/SoundCloud playlists & albums
      const isSpotifyPlaylist = normalizedQuery.includes('open.spotify.com/playlist/') || normalizedQuery.includes('open.spotify.com/album/');
      const isSoundCloudSet = normalizedQuery.includes('soundcloud.com/') && normalizedQuery.includes('/sets/');
      const isExternalPlaylist = isSpotifyPlaylist || isSoundCloudSet;
      const isPlaylistOnly = isURL && ((hasList && !hasVideoId) || isExternalPlaylist);
      const isVideoWithPlaylist = isURL && hasVideoId && hasList;

      if (isPlaylistOnly || isVideoWithPlaylist) {
        // For Spotify playlists/albums, resolve the name and search YouTube
        // (yt-dlp cannot extract individual Spotify playlist tracks)
        if (isSpotifyPlaylist) {
          const playlistName = await resolveSpotifyQuery(normalizedQuery);
          if (playlistName) {
            try {
              const output = await runYtDlp(
                `ytsearch10:${playlistName}`,
                '-j',
                '--no-warnings',
                '--flat-playlist'
              );
              const lines = output.split('\n').filter(l => l.trim());

              playlist = new Playlist(this.context.player, {
                title: playlistName,
                thumbnail: '',
                description: '',
                type: 'playlist',
                source: 'youtube',
                author: { name: 'Spotify', url: '' },
                id: 'spotify-playlist',
                url: normalizedQuery,
                tracks: [],
              });

              for (const line of lines) {
                try {
                  const info = JSON.parse(line);
                  tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, playlist }));
                } catch {}
              }

              playlist.tracks = tracks;
            } catch (err) {
              logger.error(`[yt-dlp] Spotify playlist→YouTube search error: ${err}`);
            }
          }
        }

        // SoundCloud sets — yt-dlp handles them natively
        if (tracks.length === 0 && isSoundCloudSet) {
          try {
            const output = await runYtDlp(
              '--flat-playlist', '-j', '--no-warnings', '--playlist-end', '50', normalizedQuery
            );
            const lines = output.split('\n').filter(l => l.trim());

            let setTitle = 'SoundCloud Set';
            try {
              const firstInfo = JSON.parse(lines[0]);
              if (firstInfo.playlist_title) setTitle = firstInfo.playlist_title;
            } catch {}

            playlist = new Playlist(this.context.player, {
              title: setTitle,
              thumbnail: '',
              description: '',
              type: 'playlist',
              source: 'soundcloud',
              author: { name: 'SoundCloud', url: '' },
              id: 'soundcloud-set',
              url: normalizedQuery,
              tracks: [],
            });

            for (const line of lines) {
              try {
                const info = JSON.parse(line);
                tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, playlist, source: 'soundcloud' }));
              } catch {}
            }

            playlist.tracks = tracks;
          } catch (err) {
            logger.error(`[yt-dlp] SoundCloud set error: ${err}`);
          }
        }

        // YouTube playlists / fallback for Spotify/SoundCloud if above failed
        if (tracks.length === 0) {
          try {
            // For radio/mix playlists or video+list combos, use --yes-playlist
            const playlistArgs = isVideoWithPlaylist
              ? ['--yes-playlist', '-j', '--no-warnings', '--flat-playlist', '--playlist-end', '50', normalizedQuery]
              : ['--flat-playlist', '-j', '--no-warnings', '--playlist-end', '50', normalizedQuery];
            
            const output = await runYtDlp(...playlistArgs);
            
            const lines = output.split('\n').filter(l => l.trim());
            
            // Extract playlist title from first track's metadata
            let playlistTitle = 'YouTube Playlist';
            try {
              const firstInfo = JSON.parse(lines[0]);
              if (firstInfo.playlist_title) playlistTitle = firstInfo.playlist_title;
            } catch {}

            playlist = new Playlist(this.context.player, {
              title: playlistTitle,
              thumbnail: '',
              description: '',
              type: 'playlist',
              source: 'youtube',
              author: { name: 'YouTube', url: '' },
              id: 'playlist',
              url: normalizedQuery,
              tracks: [],
            });

            for (const line of lines) {
              try {
                const info = JSON.parse(line);
                tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, playlist }));
              } catch {}
            }

            playlist.tracks = tracks;
          } catch (err: unknown) {
            logger.error(`[yt-dlp] Playlist error: ${err instanceof Error ? err.message : err}`);
          }
        }

        // Fallback: if playlist failed or returned 0 tracks but URL has a video ID, play that video
        if (tracks.length === 0 && hasVideoId) {
          playlist = null;
          try {
            const videoUrl = normalizedQuery.split('&list=')[0].split('&start_radio')[0];
            const output = await runYtDlp(
              '-j',
              '--no-warnings',
              '--no-playlist',
              videoUrl
            );
            const info = JSON.parse(output);
            tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, urlFallback: videoUrl }));
          } catch (err2) {
            logger.error(`[yt-dlp] Fallback video error: ${err2}`);
          }
        }
      } else if (isURL) {
        // Detect Spotify / SoundCloud single-track URLs
        const isSpotifyTrack = normalizedQuery.includes('open.spotify.com/track/');
        const isSoundCloudTrack = normalizedQuery.includes('soundcloud.com/') && !normalizedQuery.includes('/sets/');

        if (isSpotifyTrack) {
          const searchQuery = await resolveSpotifyQuery(normalizedQuery);
          if (searchQuery) {
            try {
              const output = await runYtDlp(
                `ytsearch5:${searchQuery}`,
                '-j',
                '--no-warnings',
                '--flat-playlist'
              );
              const lines = output.split('\n').filter(l => l.trim());
              for (const line of lines) {
                try {
                  const info = JSON.parse(line);
                  tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy }));
                } catch {}
              }
            } catch (err) {
              logger.error(`[yt-dlp] Spotify→YouTube search error: ${err}`);
            }
          } else {
            logger.warn(`[Spotify] Could not resolve track name for: ${normalizedQuery}`);
          }
        }

        // SoundCloud single track — yt-dlp handles natively
        if (isSoundCloudTrack && tracks.length === 0) {
          try {
            const output = await runYtDlp(
              '-j',
              '--no-warnings',
              '--no-playlist',
              normalizedQuery
            );
            const info = JSON.parse(output);
            tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, source: 'soundcloud' }));
          } catch (err) {
            logger.error(`[yt-dlp] SoundCloud track error: ${err}`);
          }
        }

        // Generic URL handling (non-Spotify/SoundCloud, or fallback if above failed)
        if (tracks.length === 0) {
          const cleanUrl = hasVideoId ? normalizedQuery.split('&list=')[0].split('&start_radio')[0] : normalizedQuery;
          try {
            const output = await runYtDlp(
              '-j',
              '--no-warnings',
              '--no-playlist',
              cleanUrl
            );
            const info = JSON.parse(output);
            tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy, urlFallback: normalizedQuery }));
          } catch (err) {
            logger.error(`[yt-dlp] Video info error for ${cleanUrl}: ${err}`);
          }
        }
      } else {
        // Search YouTube
        try {
          const output = await runYtDlp(
            `ytsearch10:${query}`,
            '-j',
            '--no-warnings',
            '--flat-playlist'
          );
          const lines = output.split('\n').filter(l => l.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);
              tracks.push(this.buildTrack(info, { requestedBy: context.requestedBy }));
            } catch {}
          }
        } catch (err) {
          logger.error(`[yt-dlp] Search error: ${err}`);
        }
      }
    } catch (err) {
      logger.error(`[yt-dlp] Handle error: ${err}`);
    }

    return this.createResponse(playlist, tracks);
  }

  async stream(info: Track): Promise<ExtractorStreamable> {
    const url = info.url;
    const streamArgs: string[] = [
      '--get-url',
      '--no-warnings',
      '--no-playlist',
      '--no-check-formats',
      '--extractor-args', 'youtube:player_client=default,web_creator',
    ];

    // 1) Try with auth (cookies / OAuth2)
    try {
      const output = await runYtDlp(...streamArgs, url);
      const lines = output.trim().split('\n').filter(l => l.trim());
      return lines[lines.length - 1].trim();
    } catch (err) {
      logger.warn(`[yt-dlp] Stream error for ${url}, retrying without auth: ${err}`);
    }

    // 2) Retry without auth — expired cookies can be worse than none.
    try {
      const output = await runYtDlpNoAuth(...streamArgs, url);
      const lines = output.trim().split('\n').filter(l => l.trim());
      return lines[lines.length - 1].trim();
    } catch {
      logger.warn(`[yt-dlp] No-auth retry also failed for ${url}, trying fallback search`);
    }

    // 3) Final fallback: search YouTube by track title + author.
    try {
      const fallbackQuery = `${info.title} ${info.author}`;
      const output = await runYtDlp(
        `ytsearch1:${fallbackQuery}`,
        '--get-url',
        '--no-warnings',
        '--no-check-formats',
        '--extractor-args', 'youtube:player_client=default,web_creator',
      );
      const lines = output.trim().split('\n').filter(l => l.trim());
      return lines[lines.length - 1].trim();
    } catch (fallbackErr) {
      logger.error(`[yt-dlp] All stream attempts failed: ${fallbackErr}`);
      throw fallbackErr;
    }
  }

  async getRelatedTracks(track: Track, _history: GuildQueueHistory): Promise<ExtractorInfo> {
    try {
      const output = await runYtDlp(
        `ytsearch5:${track.title} ${track.author}`,
        '-j',
        '--no-warnings',
        '--flat-playlist'
      );
      const lines = output.split('\n').filter(l => l.trim());
      const tracks: Track[] = [];

      for (const line of lines) {
        try {
          const info = JSON.parse(line);
          tracks.push(this.buildTrack(info));
        } catch {}
      }

      return this.createResponse(null, tracks);
    } catch {
      return this.createResponse(null, []);
    }
  }
}
