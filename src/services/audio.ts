import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';

import type { AnkiService } from './anki';

export class AudioPlayer {
  private currentProcess: ChildProcess | null = null;
  private isPlaying = false;
  private isStopping = false;
  private ffplay = process.platform === 'win32' ? 'ffplay.exe' : 'ffplay';
  private tmpFiles: string[] = [];

  constructor(private ankiService: AnkiService, private debug = false) {}

  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log('[AudioPlayer]', ...args);
    }
  }

  private async createTempFile(base64Data: string): Promise<string> {
    const tmpPath = join(tmpdir(), `gakuon_${randomBytes(6).toString('hex')}.mp3`);
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(tmpPath, buffer);
    this.tmpFiles.push(tmpPath);
    return tmpPath;
  }

  async play(audioSource: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }

    try {
      let filepath: string;

      // Check if it's an Anki sound reference
      if (audioSource.startsWith('[sound:') && audioSource.endsWith(']')) {
        const filename = audioSource.slice(7, -1);
        this.debugLog('Retrieving media file:', filename);

        const base64Content = await this.ankiService.retrieveMediaFile(filename);
        if (!base64Content) {
          throw new Error(`Media file not found: ${filename}`);
        }

        filepath = await this.createTempFile(base64Content);
        this.debugLog('Created temp file:', filepath);
      } else {
        filepath = audioSource;
      }

      this.isPlaying = true;

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

  async cleanup(): Promise<void> {
    for (const tmpFile of this.tmpFiles) {
      try {
        // Use node's fs promises API
        const { unlink } = await import('fs/promises');
        await unlink(tmpFile);
        this.debugLog('Cleaned up temp file:', tmpFile);
      } catch (error) {
        this.debugLog('Error cleaning up temp file:', tmpFile, error);
      }
    }
    this.tmpFiles = [];
  }
}
