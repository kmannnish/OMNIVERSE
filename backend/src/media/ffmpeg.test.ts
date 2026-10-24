import { planTranscode } from './ffmpeg.service.js';
import type { MediaMetadataResult } from '@media-suite/shared';

function testTranscodePlanner() {
  console.log('--- Testing FFmpeg Plan & Stream Copy Optimization ---');

  const sampleMetadata: MediaMetadataResult = {
    filename: 'BigBuckBunny.mp4',
    duration: 596,
    durationFormatted: '09:56',
    formatName: 'mov,mp4,m4a',
    videoStreams: [
      {
        index: 0,
        codec: 'h264',
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        fps: 24,
      },
    ],
    audioStreams: [
      {
        index: 1,
        codec: 'aac',
        channels: 6,
        channelLayout: '5.1',
        sampleRate: 48000,
      },
    ],
    subtitleTracks: [
      {
        index: 2,
        codec: 'subrip',
        language: 'eng',
        title: 'English',
        isDefault: true,
        isForced: false,
      },
    ],
    chapters: [],
  };

  // Test 1: H.264 + AAC to MP4 original quality -> MUST BE STREAM COPY
  const plan1 = planTranscode(sampleMetadata, 'mp4', 'original');
  if (plan1.isVideoCopy && plan1.isAudioCopy) {
    console.log('✅ Stream Copy test passed: H.264/AAC to MP4 uses -c copy');
  } else {
    console.error('❌ Stream Copy test failed:', plan1);
    process.exit(1);
  }

  // Test 2: Downscaling to 720p -> Video must re-encode with scale filter, audio stream copy
  const plan2 = planTranscode(sampleMetadata, 'mp4', '720p');
  if (!plan2.isVideoCopy && plan2.isAudioCopy && plan2.ffmpegArgs.includes('scale=-2:720')) {
    console.log('✅ Downscale test passed: 1080p -> 720p re-encodes video with scale filter and preserves audio copy');
  } else {
    console.error('❌ Downscale test failed:', plan2);
    process.exit(1);
  }

  // Test 3: Subtitle extraction -> extracts track 2 to SRT
  const plan3 = planTranscode(sampleMetadata, 'srt', undefined, 2);
  if (plan3.outputExtension === '.srt' && plan3.ffmpegArgs.includes('-map') && plan3.ffmpegArgs.includes('0:2')) {
    console.log('✅ Subtitle extraction test passed: Maps subtitle stream 0:2 to .srt');
  } else {
    console.error('❌ Subtitle extraction test failed:', plan3);
    process.exit(1);
  }

  // Test 4: Audio extraction to MP3 -> Video discarded, audio re-encoded to libmp3lame 320k
  const plan4 = planTranscode(sampleMetadata, 'mp3');
  if (plan4.outputExtension === '.mp3' && plan4.ffmpegArgs.includes('-vn') && plan4.ffmpegArgs.includes('libmp3lame')) {
    console.log('✅ Audio extraction test passed: MP3 extracts audio stream with libmp3lame at 320k');
  } else {
    console.error('❌ Audio extraction test failed:', plan4);
    process.exit(1);
  }

  console.log('--- All Transcode Planner Tests Passed! ---');
}

testTranscodePlanner();
