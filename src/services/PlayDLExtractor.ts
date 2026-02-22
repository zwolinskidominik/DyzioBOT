import { BaseExtractor, Track, SearchQueryType, ExtractorSearchContext, ExtractorStreamable, ExtractorInfo, Playlist, GuildQueueHistory } from 'discord-player';
import { execFile, execFileSync, spawn } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { PassThrough } from 'stream';
import path from 'path';
import os from 'os';
import https from 'https';
import { URL } from 'url';
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

// Common args applied to all YouTube requests.
// --force-ipv4: avoids broken IPv6 on some VPS.
// --no-check-formats: accept any format without probing.
const YT_COMMON_ARGS = ['--force-ipv4', '--no-check-formats'];

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

const COOKIE_AUTH: string[] = WRITABLE_COOKIES ? ['--cookies', WRITABLE_COOKIES] : [];
const OAUTH2_AUTH: string[] = ['--username', 'oauth2', '--password', ''];
const NO_AUTH: string[] = [];

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
  return execYtDlp(COOKIE_AUTH.length ? COOKIE_AUTH : NO_AUTH, args);
}

/**
 * Spawn yt-dlp and pipe audio to stdout. Returns a Readable stream.
 * This avoids --get-url issues where the extracted URL requires auth headers
 * that only yt-dlp provides. yt-dlp handles the download internally.
 */
function spawnYtDlpStream(auth: string[], extraArgs: string[], url: string): Promise<PassThrough> {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP_CMD, [
      ...YT_DLP_ARGS,
      ...auth,
      ...YT_COMMON_ARGS,
      ...extraArgs,
      '-o', '-',       // output to stdout
      '--no-warnings',
      '--no-playlist',
      '--no-part',
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] }); // close stdin (prevents interactive prompts)

    const output = new PassThrough();
    let resolved = false;
    let stderrBuf = '';

    child.stderr!.on('data', (d: Buffer) => { stderrBuf += d.toString(); });
    child.stdout!.pipe(output);

    // Timeout: 30s to start receiving data
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (!child.killed) child.kill('SIGTERM');
        reject(new Error('yt-dlp pipe timeout (30s)'));
      }
    }, 30000);

    // Resolve as soon as first audio data arrives
    child.stdout!.once('data', () => {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve(output); }
    });

    child.on('error', (err) => {
      if (!resolved) { resolved = true; clearTimeout(timer); reject(err); }
      else output.destroy(err);
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        // Show LAST 500 chars of stderr — actual errors are at the end, progress info at the start
        const tail = stderrBuf.trim().slice(-500);
        reject(new Error(`yt-dlp exit ${code}: ${tail}`));
      }
    });

    // Kill child process when stream is destroyed (skip/stop)
    output.on('close', () => { if (!child.killed) child.kill('SIGTERM'); });
  });
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

/** Helper: perform an HTTPS POST and return the response body as a string. */
function httpsPost(url: string, body: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
        ...headers,
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // For redirect responses, the Location header IS the audio URL
        res.resume();
        if (res.headers.location) return resolve(JSON.stringify({ status: 'redirect', url: res.headers.location }));
        return reject(new Error(`Redirect without Location`));
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
    req.write(body);
    req.end();
  });
}

/** Extract YouTube video ID from a URL. Returns null if not a valid YouTube URL. */
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

// Public Piped API instances — YouTube proxy, fetches audio from a different IP.
// Updated 2026-02 — only instances verified as working.
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.darkness.services',
];

// Public Invidious API instances — another YouTube proxy.
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
];

/**
 * Try to get an audio stream URL via a public Piped API instance.
 * Piped proxies audio through its own servers, bypassing VPS IP blocks.
 */
async function getAudioUrlFromPiped(videoId: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const json = await httpsGet(`${instance}/streams/${videoId}`);
      const data = JSON.parse(json);
      if (data.audioStreams?.length) {
        const best = data.audioStreams
          .filter((s: any) => s.url && s.mimeType?.startsWith('audio/'))
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        if (best.length) {
          logger.info(`[Piped] Got audio from ${instance} (${best[0].mimeType}, ${best[0].bitrate}bps)`);
          return best[0].url;
        }
      }
    } catch (err) {
      logger.warn(`[Piped] ${instance} failed for ${videoId}: ${(err as Error).message?.slice(0, 100)}`);
    }
  }
  return null;
}

/**
 * Try to get an audio stream URL via a public Invidious API instance.
 * Returns a proxied audio URL (streams through Invidious server).
 */
async function getAudioUrlFromInvidious(videoId: string): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const json = await httpsGet(`${instance}/api/v1/videos/${videoId}`);
      const data = JSON.parse(json);
      // adaptiveFormats contains separate audio/video streams
      const audioFmts = (data.adaptiveFormats || [])
        .filter((f: any) => f.type?.startsWith('audio/') && f.url)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      if (audioFmts.length) {
        logger.info(`[Invidious] Got audio from ${instance} (${audioFmts[0].type}, ${audioFmts[0].bitrate}bps)`);
        return audioFmts[0].url;
      }
    } catch (err) {
      logger.warn(`[Invidious] ${instance} failed for ${videoId}: ${(err as Error).message?.slice(0, 100)}`);
    }
  }
  return null;
}

/**
 * Try to get an audio stream URL via cobalt.tools API.
 * cobalt is an actively maintained service that extracts audio from YouTube
 * and streams it through its own infrastructure.
 */
async function getAudioUrlFromCobalt(videoId: string): Promise<string | null> {
  const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
  ];

  // cobalt API v10 format — note: downloadMode replaces isAudioOnly
  const payload = JSON.stringify({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    downloadMode: 'audio',
    audioFormat: 'opus',
    filenameStyle: 'basic',
  });

  for (const instance of COBALT_INSTANCES) {
    try {
      const json = await httpsPost(instance, payload);
      const data = JSON.parse(json);
      if (data.status === 'tunnel' || data.status === 'redirect') {
        if (data.url) {
          logger.info(`[Cobalt] Got audio URL from ${instance} (status: ${data.status})`);
          return data.url;
        }
      }
      if (data.status === 'error') {
        logger.warn(`[Cobalt] ${instance} error: ${data.error?.code || 'unknown'}`);
      }
    } catch (err) {
      logger.warn(`[Cobalt] ${instance} failed for ${videoId}: ${(err as Error).message?.slice(0, 100)}`);
    }
  }
  return null;
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

  // Set during activate() — skip strategies that are known-bad.
  private _cookiesValid = false;
  private _oauth2Available = false;

  async activate(): Promise<void> {
    this.protocols = ['https', 'http'];
    // Log yt-dlp version for easier VPS debugging
    try {
      const ver = await execYtDlp([], ['--version']);
      logger.info(`[yt-dlp] version: ${ver}`);
    } catch (err) {
      logger.warn(`[yt-dlp] Could not determine version: ${(err as Error).message?.slice(0, 100)}`);
    }

    const TEST_VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

    // ── 1) Verify cookie validity ──
    if (COOKIE_AUTH.length) {
      try {
        const out = await execYtDlp(COOKIE_AUTH, ['--list-formats', '--no-warnings', TEST_VIDEO]);
        // Format lines: "251 webm audio only", version lines: "2025.01.15" — require ID + ext
        const lines = out.split('\n').filter(l => /^\d+\s+\w+/.test(l.trim()));
        if (lines.length > 0) {
          this._cookiesValid = true;
          logger.info(`[yt-dlp] ✅ Cookies valid — ${lines.length} formats available`);
        } else {
          logger.warn(`[yt-dlp] ⚠️ Cookies expired — 0 formats for test video. Run OAuth2 setup or export fresh cookies!`);
        }
      } catch (err) {
        logger.warn(`[yt-dlp] ⚠️ Cookie check failed: ${(err as Error).message?.slice(0, 150)}`);
      }
    }

    // ── 2) Verify OAuth2 token ──
    try {
      const out = await execYtDlp(OAUTH2_AUTH, ['--list-formats', '--no-warnings', TEST_VIDEO]);
      const lines = out.split('\n').filter(l => /^\d+\s+\w+/.test(l.trim()));
      if (lines.length > 0) {
        this._oauth2Available = true;
        logger.info(`[yt-dlp] ✅ OAuth2 token valid — ${lines.length} formats available`);
      } else {
        logger.info(`[yt-dlp] OAuth2 returned 0 formats (token may not be set up)`);
      }
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 150) || '';
      // Don't warn for expected "no cached token" case
      if (msg.includes('oauth2')) {
        logger.info(`[yt-dlp] OAuth2 not configured — run setup to enable. See README.`);
      } else {
        logger.info(`[yt-dlp] OAuth2 check: ${msg}`);
      }
    }

    if (!this._cookiesValid && !this._oauth2Available) {
      logger.warn(`[yt-dlp] ⚠️ No working auth! YouTube will likely block requests. Set up OAuth2 token (recommended) or export fresh cookies.`);
    }
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

    // Each strategy is a complete config: auth + player client args.
    // Different player clients use different YouTube API endpoints with
    // different bot-detection and format availability.
    // Only strategies validated during activate() are included.
    interface PipeStrategy { label: string; auth: string[]; args: string[] }
    const strategies: PipeStrategy[] = [];

    // 1) OAuth2 (auto-refreshing token) — most reliable when configured
    if (this._oauth2Available) {
      strategies.push(
        { label: 'oauth2+default', auth: OAUTH2_AUTH, args: [] },
        { label: 'oauth2+web_creator', auth: OAUTH2_AUTH, args: ['--extractor-args', 'youtube:player_client=web_creator'] },
      );
    }
    // 2) Cookies (manual export, expires after days/weeks)
    if (this._cookiesValid) {
      strategies.push(
        { label: 'cookies+default', auth: COOKIE_AUTH, args: [] },
        { label: 'cookies+web_creator', auth: COOKIE_AUTH, args: ['--extractor-args', 'youtube:player_client=web_creator'] },
      );
    }
    // 3) No-auth: try clients known to bypass datacenter bot detection
    strategies.push(
      { label: 'ios', auth: NO_AUTH, args: ['--extractor-args', 'youtube:player_client=ios'] },
      { label: 'tv_embedded', auth: NO_AUTH, args: ['--extractor-args', 'youtube:player_client=tv_embedded'] },
      { label: 'mweb', auth: NO_AUTH, args: ['--extractor-args', 'youtube:player_client=mweb'] },
    );

    // ── 1) PIPE approach with different player clients ──
    for (const s of strategies) {
      try {
        return await spawnYtDlpStream(s.auth, s.args, url);
      } catch (err) {
        const errMsg = (err as Error).message?.slice(-400) ?? 'unknown';
        logger.warn(`[yt-dlp] Pipe failed [${s.label}]: ${errMsg}`);
      }
    }

    // ── 2) Public YouTube proxies (Cobalt → Piped → Invidious) — different IP ──
    const videoId = extractYouTubeId(url);
    if (videoId) {
      logger.info(`[yt-dlp] Trying public proxy fallbacks for ${videoId}`);
      const cobaltUrl = await getAudioUrlFromCobalt(videoId);
      if (cobaltUrl) return cobaltUrl;
      const pipedUrl = await getAudioUrlFromPiped(videoId);
      if (pipedUrl) return pipedUrl;
      const invUrl = await getAudioUrlFromInvidious(videoId);
      if (invUrl) return invUrl;
    }

    // ── 3) URL approach fallback ──
    // Prefer auth strategies; if none available, try first 2 no-auth strategies.
    const authStrategies = strategies.filter(s => s.auth.length > 0);
    const urlSearchStrategies = authStrategies.length ? authStrategies : strategies.slice(0, 2);
    const urlArgs = ['--get-url', '--no-warnings', '--no-playlist', ...YT_COMMON_ARGS];
    for (const s of urlSearchStrategies) {
      try {
        const output = await execYtDlp(s.auth, [...urlArgs, ...s.args, url]);
        const lines = output.trim().split('\n').filter(l => l.trim());
        return lines[lines.length - 1].trim();
      } catch (err) {
        const errMsg = (err as Error).message?.slice(-400) ?? 'unknown';
        logger.warn(`[yt-dlp] URL failed [${s.label}]: ${errMsg}`);
      }
    }

    // ── 4) Search fallback: search YouTube by title + author ──
    logger.warn(`[yt-dlp] All direct strategies failed for ${url}, trying search fallback`);
    const searchQuery = `ytsearch1:${info.title} ${info.author}`;
    for (const s of urlSearchStrategies) {
      try {
        return await spawnYtDlpStream(s.auth, s.args, searchQuery);
      } catch (err) {
        const errMsg = (err as Error).message?.slice(-400) ?? 'unknown';
        logger.warn(`[yt-dlp] Search fallback failed [${s.label}]: ${errMsg}`);
      }
    }

    const msg = `All stream attempts failed for ${url}`;
    logger.error(`[yt-dlp] ${msg}`);
    throw new Error(msg);
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
