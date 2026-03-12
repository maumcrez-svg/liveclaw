import { spawn, ChildProcess } from 'child_process';

export function startRenderPipeline(streamKey: string, rtmpUrl: string): ChildProcess {
  // For creative agents that generate frames via Python pipe
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'rawvideo',
    '-pixel_format', 'rgb24',
    '-video_size', '1920x1080',
    '-framerate', '30',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-f', 'flv',
    `${rtmpUrl}/${streamKey}`,
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFmpeg Render] ${data.toString()}`);
  });

  return ffmpeg;
}
