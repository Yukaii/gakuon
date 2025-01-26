import type { ChildProcess } from 'child_process';

export class AudioPlayer {
  private currentProcess: ChildProcess | null = null;
  private isPlaying = false;
  private isBun = typeof Bun !== 'undefined';
  private ffplay = process.platform === 'win32' ? 'ffplay.exe' : 'ffplay';

  async play(filepath: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;

    try {
      if (this.isBun) {
        const proc = Bun.spawn([
          this.ffplay,
          "-nodisp",
          "-autoexit",
          "-hide_banner",
          "-loglevel",
          "quiet",
          filepath
        ]);

        this.currentProcess = proc as unknown as ChildProcess;
        await proc.exited;
      } else {
        const { spawn } = await import('child_process');
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(this.ffplay, [
            "-nodisp",
            "-autoexit",
            "-hide_banner",
            "-loglevel",
            "quiet",
            filepath
          ]);

          this.currentProcess = proc;

          proc.on('close', (code) => {
            this.isPlaying = false;
            this.currentProcess = null;
            if (code !== 0) {
              reject(new Error(`ffplay exited with code ${code}`));
            } else {
              resolve();
            }
          });

          proc.on('error', (err) => {
            this.isPlaying = false;
            this.currentProcess = null;
            reject(err);
          });
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      this.isPlaying = false;
      this.currentProcess = null;
      throw error;
    }
  }

  stop(): void {
    if (this.currentProcess) {
      if (this.isBun) {
        this.currentProcess.kill();
      } else {
        // Node.js process kill
        this.currentProcess.kill('SIGTERM');
      }
      this.currentProcess = null;
      this.isPlaying = false;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}

// For backward compatibility, also export the simple playAudio function
export async function playAudio(filepath: string): Promise<void> {
  const player = new AudioPlayer();
  await player.play(filepath);
}
