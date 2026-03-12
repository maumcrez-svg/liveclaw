import { spawn, ChildProcess } from 'child_process';

export function startDisplayCapture(streamKey: string, rtmpUrl: string): ChildProcess {
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning',
    '-video_size', '1920x1080',
    '-framerate', '30',
    '-f', 'x11grab',
    '-i', ':99',
    '-f', 'pulse', '-i', 'default',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '3000k',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    `${rtmpUrl}/${streamKey}`,
  ]);

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFmpeg] ${data.toString()}`);
  });

  ffmpeg.on('exit', (code) => {
    console.log(`[FFmpeg] Exited with code ${code}`);
  });

  return ffmpeg;
}
