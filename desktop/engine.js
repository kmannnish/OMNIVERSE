const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { EventEmitter } = require('node:events');

// Ensure bundled bin, Winget yt-dlp, and ffmpeg paths are prepended to PATH for zero-dependency execution
const localAppData = process.env.LOCALAPPDATA || '';
const extraSearchPaths = [
  path.join(__dirname, '..', 'bin'),
  path.join(process.cwd(), 'bin'),
  path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe'),
  path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-N-121271-g74115b017c-win64-gpl', 'bin'),
  'C:\\Program Files\\nodejs'
];
for (const p of extraSearchPaths) {
  if (fs.existsSync(p) && !(process.env.PATH || '').includes(p)) {
    process.env.PATH = `${p};${process.env.PATH || ''}`;
  }
}

const jobEvents = new EventEmitter();
const activeJobs = new Map();

const FORMAT_EXT_MAP = {
  mp4: { ext: '.mp4', mime: 'video/mp4' },
  webm: { ext: '.webm', mime: 'video/webm' },
  mp3: { ext: '.mp3', mime: 'audio/mpeg' },
  m4a: { ext: '.m4a', mime: 'audio/mp4' },
  wav: { ext: '.wav', mime: 'audio/wav' },
  srt: { ext: '.srt', mime: 'application/x-subrip' },
  vtt: { ext: '.vtt', mime: 'text/vtt' },
  jpg: { ext: '.jpg', mime: 'image/jpeg' },
  png: { ext: '.png', mime: 'image/png' },
  webp: { ext: '.webp', mime: 'image/webp' },
};

const QUALITY_FILTER_MAP = {
  original: undefined,
  '4k': '2160',
  '1440p': '1440',
  '1080p': '1080',
  '720p': '720',
  '480p': '480',
  '360p': '360',
  '240p': '240',
};

function formatDuration(totalSeconds) {
  if (Number.isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n) => n.toString().padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function buildQualitySuffix(targetFormat, targetQuality) {
  if (targetFormat === 'mp3') return '_[320kbps]';
  if (targetFormat === 'm4a') return '_[256kbps]';
  if (targetFormat === 'wav') return '_[lossless]';
  if (targetFormat === 'srt') return '_[subtitles]';
  if (targetFormat === 'vtt') return '_[subtitles]';
  if (['jpg', 'png', 'webp'].includes(targetFormat)) {
    return `_[thumbnail_${targetQuality || 'maxres'}]`;
  }

  switch (targetQuality) {
    case '4k': return '_[4K]';
    case '1440p': return '_[1440p]';
    case '1080p': return '_[1080p]';
    case '720p': return '_[720p]';
    case '480p': return '_[480p]';
    case '360p': return '_[360p]';
    case '240p': return '_[240p]';
    case 'original':
    default:
      return '_[source]';
  }
}

function generateOutputFilename(rawTitle, targetFormat, targetQuality) {
  const formatInfo = FORMAT_EXT_MAP[targetFormat] || { ext: '.mp4' };
  const withoutExt = (rawTitle || 'media').replace(/\.[a-zA-Z0-9]{2,5}$/, '');

  let cleanBase = withoutExt
    .replace(/[^\w.\-[\]]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  if (!cleanBase) cleanBase = 'media';
  const suffix = buildQualitySuffix(targetFormat, targetQuality);

  if (cleanBase.toLowerCase().endsWith(suffix.toLowerCase())) {
    return `${cleanBase}${formatInfo.ext}`;
  }
  return `${cleanBase}${suffix}${formatInfo.ext}`;
}

async function probeUrl(url) {
  const args = [
    '-j',
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--force-ipv4',
    '--socket-timeout', '12',
    '--extractor-args', 'youtube:player_client=android,ios,mweb',
    url,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (d) => { stdoutData += d.toString('utf8'); });
    proc.stderr.on('data', (d) => { stderrData += d.toString('utf8'); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Probe timed out after 45 seconds. ${stderrData.trim() ? 'Details: ' + stderrData.trim().slice(0, 150) : ''}`));
    }, 45000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(stderrData.trim() || `Probe failed with code ${code}`));
      }

      try {
        const info = JSON.parse(stdoutData.trim());
        const title = info.title || 'media';
        const duration = info.duration || 0;
        const formats = info.formats || [];

        const videoStreamsMap = new Map();
        let videoIdx = 0;

        for (const f of formats) {
          if (f.vcodec && f.vcodec !== 'none' && f.width && f.height) {
            const key = `${f.width}x${f.height}`;
            if (!videoStreamsMap.has(key)) {
              videoStreamsMap.set(key, {
                index: videoIdx++,
                codec: f.vcodec.split('.')[0] || 'h264',
                width: f.width,
                height: f.height,
                aspectRatio: `${f.width}:${f.height}`,
                fps: f.fps || 30,
                bitrate: f.tbr ? Math.round(f.tbr * 1000) : undefined,
                pixelFormat: 'yuv420p',
              });
            }
          }
        }

        const audioStreams = [
          {
            index: 1,
            codec: 'aac',
            channels: 2,
            channelLayout: 'stereo',
            sampleRate: 48000,
            bitrate: 192000,
            language: 'und',
          },
        ];

        const subtitleTracks = [];
        let subIdx = 0;
        const rawSubs = { ...info.subtitles, ...info.automatic_captions };
        for (const [lang, trackList] of Object.entries(rawSubs)) {
          if (trackList && trackList.length > 0) {
            subtitleTracks.push({
              index: subIdx++,
              codec: trackList[0].ext || 'vtt',
              language: lang,
              title: trackList[0].name || `Captions (${lang})`,
              isDefault: lang === 'en',
              isForced: false,
            });
            if (subIdx >= 10) break;
          }
        }

        const videoStreams = Array.from(videoStreamsMap.values()).sort((a, b) => b.height - a.height);

        // Parse available thumbnails across all qualities
        const rawThumbnails = info.thumbnails || [];
        const thumbnailMap = new Map();
        for (const t of rawThumbnails) {
          if (!t.url) continue;
          const width = t.width || 0;
          const height = t.height || 0;
          let label = 'Standard';
          let sub = 'Pure Form';
          let qualityKey = 'medium';

          if (height >= 1080 || (t.id && t.id.includes('maxres')) || (t.url && t.url.includes('maxresdefault'))) {
            label = 'Maximum (1080p)';
            sub = 'Ultra HD • Luminous';
            qualityKey = 'maxres';
          } else if (height >= 720 || (t.id && t.id.includes('hq720')) || (t.url && t.url.includes('hq720'))) {
            label = 'High (720p)';
            sub = 'Radiant Clarity';
            qualityKey = 'high';
          } else if (height >= 480 || (t.id && t.id.includes('sddefault')) || (t.url && t.url.includes('sddefault'))) {
            label = 'Standard (480p)';
            sub = 'Pure Form';
            qualityKey = 'standard';
          } else if (height >= 360 || (t.id && t.id.includes('hqdefault')) || (t.url && t.url.includes('hqdefault'))) {
            label = 'Medium (360p)';
            sub = 'Subtle';
            qualityKey = 'medium';
          } else {
            label = 'Compact (180p)';
            sub = 'Minimal';
            qualityKey = 'small';
          }

          if (!thumbnailMap.has(qualityKey) || (height > (thumbnailMap.get(qualityKey).height || 0))) {
            thumbnailMap.set(qualityKey, {
              id: qualityKey,
              label,
              sub: height ? `${width}x${height} • ${sub}` : sub,
              url: t.url,
              width,
              height,
            });
          }
        }

        if (thumbnailMap.size === 0 && info.thumbnail) {
          thumbnailMap.set('maxres', {
            id: 'maxres',
            label: 'Maximum (1080p)',
            sub: 'Original • Luminous',
            url: info.thumbnail,
            width: 1920,
            height: 1080,
          });
        }

        const qualityOrder = ['maxres', 'high', 'standard', 'medium', 'small'];
        const thumbnails = Array.from(thumbnailMap.values()).sort(
          (a, b) => qualityOrder.indexOf(a.id) - qualityOrder.indexOf(b.id)
        );

        resolve({
          filename: title,
          duration,
          durationFormatted: formatDuration(duration),
          formatName: info.ext || 'mp4',
          size: info.filesize || info.filesize_approx,
          videoStreams,
          audioStreams,
          subtitleTracks,
          chapters: [],
          thumbnails,
          thumbnailUrl: (thumbnails[0] && thumbnails[0].url) || info.thumbnail,
        });
      } catch (err) {
        reject(new Error(`Failed to parse media metadata: ${err.message}`));
      }
    });
  });
}

function startJob({ jobId, sourceUrl, targetFormat = 'mp4', targetQuality = 'original', customFilename, thumbnailUrl }) {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const job = {
    jobId,
    state: 'processing',
    progress: 5,
    stage: 'Aligning with the expanse...',
    timestamp: new Date().toISOString(),
  };
  activeJobs.set(jobId, job);
  jobEvents.emit(`progress:${jobId}`, job);

  // Run async processing
  (async () => {
    try {
      // 1. Probe for filename if not provided
      let rawTitle = customFilename;
      if (!rawTitle) {
        try {
          const meta = await probeUrl(sourceUrl);
          rawTitle = meta.filename;
        } catch {
          rawTitle = 'media';
        }
      }

      const finalFilename = generateOutputFilename(rawTitle, targetFormat, targetQuality);
      let targetPath = path.join(downloadsDir, finalFilename);

      // Handle duplicate filename
      if (fs.existsSync(targetPath)) {
        const parsed = path.parse(finalFilename);
        targetPath = path.join(downloadsDir, `${parsed.name}_${Date.now()}${parsed.ext}`);
      }

      // Handle Thumbnail Download Formats (jpg, png, webp)
      if (['jpg', 'png', 'webp'].includes(targetFormat)) {
        job.stage = 'Aligning thumbnail stream...';
        job.progress = 25;
        jobEvents.emit(`progress:${jobId}`, job);

        let imgUrl = thumbnailUrl;
        if (!imgUrl) {
          const meta = await probeUrl(sourceUrl);
          const matchThumb = (meta.thumbnails || []).find((t) => t.id === targetQuality);
          imgUrl = (matchThumb && matchThumb.url) || meta.thumbnailUrl;
        }

        if (!imgUrl) {
          throw new Error('No thumbnail available for this stream');
        }

        job.stage = 'Drawing pure image from the expanse...';
        job.progress = 60;
        jobEvents.emit(`progress:${jobId}`, job);

        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) throw new Error(`Failed to fetch thumbnail: HTTP ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);

        const tempPath = path.join(downloadsDir, `temp_thumb_${jobId}`);
        fs.writeFileSync(tempPath, buf);

        job.stage = 'Manifesting pure image form...';
        job.progress = 85;
        jobEvents.emit(`progress:${jobId}`, job);

        // Convert / save to requested targetPath (.jpg, .png, .webp) using FFmpeg
        const ffmpegProc = spawn('ffmpeg', [
          '-y',
          '-i', tempPath,
          '-q:v', '1',
          targetPath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        await new Promise((resolve, reject) => {
          ffmpegProc.on('close', (code) => {
            try { fs.unlinkSync(tempPath); } catch {}
            if (code === 0 && fs.existsSync(targetPath)) {
              resolve();
            } else {
              try {
                fs.copyFileSync(tempPath, targetPath);
                fs.unlinkSync(tempPath);
                resolve();
              } catch (e) {
                reject(new Error(`Failed to manifest image: code ${code}`));
              }
            }
          });
          ffmpegProc.on('error', () => {
            try {
              fs.copyFileSync(tempPath, targetPath);
              fs.unlinkSync(tempPath);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

        const stat = fs.statSync(targetPath);
        job.state = 'completed';
        job.progress = 100;
        job.stage = 'Manifested.';
        job.result = {
          downloadUrl: `/api/jobs/${jobId}/download`,
          filename: path.basename(targetPath),
          filePath: targetPath,
          fileSize: stat.size,
          mimeType: (FORMAT_EXT_MAP[targetFormat] || {}).mime || 'image/jpeg',
          durationSeconds: 0,
          isStreamCopy: true,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
        jobEvents.emit(`progress:${jobId}`, job);
        jobEvents.emit(`completed:${jobId}`, job);
        return;
      }

      job.progress = 10;
      job.stage = 'Drawing from the expanse...';
      jobEvents.emit(`progress:${jobId}`, job);

      const isAudioOnly = ['mp3', 'm4a', 'wav'].includes(targetFormat);
      const isSubtitleOnly = ['srt', 'vtt'].includes(targetFormat);

      const args = [
        '--no-warnings',
        '--no-playlist',
        '--no-check-certificates',
        '--force-ipv4',
        '--socket-timeout', '15',
        '--extractor-args', 'youtube:player_client=android,ios,mweb',
        '--newline',
        '--progress-template', 'PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
        '-o', targetPath,
      ];

      if (isSubtitleOnly) {
        args.push('--skip-download', '--write-sub', '--sub-format', targetFormat);
      } else if (isAudioOnly) {
        args.push('-x', '--audio-format', targetFormat);
        if (targetFormat === 'mp3') args.push('--audio-quality', '320k');
      } else {
        const maxQuality = QUALITY_FILTER_MAP[targetQuality];
        const formatFilter = maxQuality
          ? `bestvideo[height<=?${maxQuality}]+bestaudio/best[height<=?${maxQuality}]/best`
          : 'bestvideo+bestaudio/best';
        args.push('-f', formatFilter, '--merge-output-format', targetFormat);
      }
      args.push(sourceUrl);

      const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let acc = '';

      proc.stdout.on('data', (chunk) => {
        acc += chunk.toString('utf8');
        const lines = acc.split('\n');
        acc = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('PROGRESS:')) {
            const parts = line.replace('PROGRESS:', '').trim().split('|');
            const percentStr = parts[0]?.replace('%', '').trim();
            const speed = parts[1]?.trim();
            const eta = parts[2]?.trim();
            const num = parseFloat(percentStr);

            if (!isNaN(num)) {
              let etaSeconds = undefined;
              if (eta && eta.includes(':')) {
                const [m, s] = eta.split(':').map(Number);
                etaSeconds = (m || 0) * 60 + (s || 0);
              }

              job.progress = Math.min(99, Math.round(num));
              job.stage = 'Transfusing essence...';
              job.metrics = { speed, etaSeconds };
              jobEvents.emit(`progress:${jobId}`, job);
            }
          }
        }
      });

      proc.on('close', async (code) => {
        if (code !== 0) {
          job.state = 'failed';
          job.error = { code: 'PROCESS_FAILED', message: `Download failed with exit code ${code}` };
          jobEvents.emit(`progress:${jobId}`, job);
          return;
        }

        // Find output file
        let actualPath = targetPath;
        if (!fs.existsSync(actualPath)) {
          const dir = path.dirname(targetPath);
          const baseName = path.parse(targetPath).name;
          const files = fs.readdirSync(dir);
          const found = files.find((f) => f.startsWith(baseName));
          if (found) actualPath = path.join(dir, found);
        }

        const stat = fs.existsSync(actualPath) ? fs.statSync(actualPath) : { size: 0 };
        const resultFilename = path.basename(actualPath);

        job.state = 'completed';
        job.progress = 100;
        job.stage = 'Manifested in pure form.';
        job.result = {
          filename: resultFilename,
          filePath: actualPath,
          fileSize: stat.size,
          mimeType: (FORMAT_EXT_MAP[targetFormat] || {}).mime || 'video/mp4',
          downloadUrl: `/api/jobs/${jobId}/download`,
        };
        jobEvents.emit(`progress:${jobId}`, job);
      });
    } catch (err) {
      job.state = 'failed';
      job.error = { code: 'EXEC_ERROR', message: err.message };
      jobEvents.emit(`progress:${jobId}`, job);
    }
  })();
}

module.exports = {
  probeUrl,
  startJob,
  activeJobs,
  jobEvents,
  generateOutputFilename,
};
