import { validateMediaUrl, SsrfSecurityError } from './ssrf.js';

async function testSsrf() {
  console.log('--- Testing SSRF Guard ---');

  const dangerousUrls = [
    'http://localhost/video.mp4',
    'http://127.0.0.1:8080/secret.mp4',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/internal.m4a',
    'http://192.168.1.1/router.mp4',
    'http://172.16.0.5/admin.mp4',
    'file:///etc/passwd',
    'ftp://domain.com/file.mp4',
    'http://user:pass@1.1.1.1/video.mp4',
  ];

  for (const url of dangerousUrls) {
    try {
      await validateMediaUrl(url);
      console.error(`❌ FAILED to block: ${url}`);
      process.exit(1);
    } catch (err) {
      if (err instanceof SsrfSecurityError) {
        console.log(`✅ Correctly blocked [${err.code}]: ${url}`);
      } else {
        console.log(`✅ Blocked with error: ${(err as Error).message}`);
      }
    }
  }

  const safeUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  try {
    const validated = await validateMediaUrl(safeUrl);
    console.log(`✅ Correctly allowed public URL: ${validated.href}`);
  } catch (err) {
    console.error(`❌ Safe URL incorrectly blocked:`, err);
    process.exit(1);
  }

  console.log('--- SSRF Guard Test Passed Successfully! ---');
}

testSsrf();
