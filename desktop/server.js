const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { exec } = require('node:child_process');
const { probeUrl, startJob, activeJobs, jobEvents } = require('./engine.js');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: ensure path stays inside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Fallback to html if no extension
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString('utf8'); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function createServer() {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // CORS headers for local execution
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. POST /api/inspect
    if (req.method === 'POST' && pathname === '/api/inspect') {
      try {
        const body = await parseJsonBody(req);
        if (!body.url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { message: 'URL is required' } }));
          return;
        }

        const metadata = await probeUrl(body.url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: metadata }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: err.message } }));
      }
      return;
    }

    // 2. POST /api/jobs
    if (req.method === 'POST' && pathname === '/api/jobs') {
      try {
        const body = await parseJsonBody(req);
        if (!body.sourceUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { message: 'sourceUrl is required' } }));
          return;
        }

        const jobId = crypto.randomUUID();
        startJob({
          jobId,
          sourceUrl: body.sourceUrl,
          targetFormat: body.targetFormat || 'mp4',
          targetQuality: body.targetQuality || 'original',
          customFilename: body.customFilename,
          thumbnailUrl: body.thumbnailUrl,
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, jobId, status: 'queued', createdAt: new Date().toISOString() }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: err.message } }));
      }
      return;
    }

    // 3. GET /api/jobs/:jobId/events (SSE progress)
    const eventsMatch = pathname.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)\/events$/);
    if (req.method === 'GET' && eventsMatch) {
      const jobId = eventsMatch[1];

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvent = (data) => {
        const json = JSON.stringify(data);
        res.write(`event: progress\ndata: ${json}\n\n`);
        res.write(`data: ${json}\n\n`);
      };

      // Send initial state if exists
      const existing = activeJobs.get(jobId);
      if (existing) {
        sendEvent(existing);
      }

      const onProgress = (data) => {
        sendEvent(data);
        if (data.state === 'completed' || data.state === 'failed') {
          setTimeout(() => {
            try { res.end(); } catch {}
          }, 1000);
        }
      };

      jobEvents.on(`progress:${jobId}`, onProgress);

      const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
        jobEvents.removeListener(`progress:${jobId}`, onProgress);
      });
      return;
    }

    // 4. GET /api/jobs/:jobId/download
    const downloadMatch = pathname.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)\/download$/);
    if (req.method === 'GET' && downloadMatch) {
      const jobId = downloadMatch[1];
      const job = activeJobs.get(jobId);

      if (!job || !job.result || !job.result.filePath || !fs.existsSync(job.result.filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: 'File not ready or expired' } }));
        return;
      }

      const filePath = job.result.filePath;
      const stat = fs.statSync(filePath);
      const filename = job.result.filename;
      const asciiFilename = filename.replace(/["\r\n\t]/g, '_').replace(/[^a-zA-Z0-9._\-[\]]/g, '_');

      res.writeHead(200, {
        'Content-Type': job.result.mimeType || 'application/octet-stream',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });

      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 5. POST /api/open-folder
    if (req.method === 'POST' && pathname === '/api/open-folder') {
      try {
        const body = await parseJsonBody(req);
        const job = activeJobs.get(body.jobId);
        if (job && job.result && job.result.filePath) {
          exec(`explorer.exe /select,"${job.result.filePath}"`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
      } catch {}
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }

    // 6. Serve static frontend assets
    serveStatic(req, res, pathname);
  });

  return server;
}

if (require.main === module) {
  const PORT = process.env.PORT || 39428;
  const server = createServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[OMNIVERSE Standalone] Port ${PORT} already active.`);
      process.exit(0);
    } else {
      console.error('[OMNIVERSE Server Error]', err);
      process.exit(1);
    }
  });

  const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  server.listen(PORT, HOST, () => {
    console.log(`[OMNIVERSE Standalone] Server active on http://${HOST}:${PORT}`);
  });
}

module.exports = { createServer };
