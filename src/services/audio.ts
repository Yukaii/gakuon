import { spawn, type ChildProcess } from 'child_process';

export class AudioPlayer {
  private currentProcess: ChildProcess | null = null;
  private isPlaying = false;
  private isStopping = false;
  private ffplay = process.platform === 'win32' ? 'ffplay.exe' : 'ffplay';

  async play(filepath: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }
    this.isPlaying = true;

    try {
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

        proc.on('exit', (code) => {
          if (code !== 0) {
            if (this.isStopping) {
              this.isStopping = false;
            } else {
              reject(new Error(`ffplay exited with code ${code}`));
            }
          } else {
            resolve();
          }
        })
        proc.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    } finally {
      this.isPlaying = false;
      this.currentProcess = null;
    }
  }

  stop(): void {
    if (this.currentProcess) {
      this.isStopping = true
      this.currentProcess.kill();
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}
