import S3rver from 's3rver';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AWSAccount = require('s3rver/lib/models/account.js');

const dataDir = process.env.DATA_DIR || '/data';
const bucketName = process.env.S3_BUCKET || 'media-storage';

// Ensure data directory and bucket directory exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const bucketDir = path.join(dataDir, bucketName);
if (!fs.existsSync(bucketDir)) {
  fs.mkdirSync(bucketDir, { recursive: true });
}

const key = process.env.S3_ACCESS_KEY_ID || 'minioadmin';
const secret = process.env.S3_SECRET_ACCESS_KEY || 'minioadmin';

// Register credentials in S3rver account registry
AWSAccount.DUMMY_ACCOUNT.createKeyPair(key, secret);
AWSAccount.DUMMY_ACCOUNT.createKeyPair('minioadmin', 'minioadmin');
AWSAccount.DUMMY_ACCOUNT.createKeyPair('S3RVER', 'S3RVER');

const s3rver = new S3rver({
  port: 9000,
  address: '0.0.0.0',
  silent: false,
  directory: dataDir,
  vhostBuckets: false,
  configureBuckets: [
    {
      name: bucketName,
    },
  ],
});

s3rver.run((err, { address, port } = {}) => {
  if (err) {
    console.error('Failed to start S3 local service:', err);
    process.exit(1);
  }
  console.log(`🚀 S3-compatible storage service listening on http://${address}:${port} (bucket: ${bucketName})`);
});
