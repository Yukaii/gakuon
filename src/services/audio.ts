export async function playAudio(filepath: string): Promise<void> {
  // Check if running in Bun or Node.js
  const isBun = typeof Bun !== 'undefined';
  const ffplay = process.platform === 'win32' ? 'ffplay.exe' : 'ffplay';

  try {
    if (isBun) {
      await Bun.spawn([
        ffplay,
        "-nodisp",
        "-autoexit",
        "-hide_banner",
        "-loglevel",
        "quiet",
        filepath
      ]).exited;
    } else {
      // For Node.js, we'll use spawnSync to mimic the behavior of Bun's spawn
      const { spawn } = await import('child_process')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(ffplay, [
          "-nodisp",
          "-autoexit",
          "-hide_banner",
          "-loglevel",
          "quiet",
          filepath
        ]);

        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`ffplay exited with code ${code}`));
          } else {
            resolve();
          }
        });

        proc.on('error', (err) => {
          reject(err);
        });
      });
    }
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
}
