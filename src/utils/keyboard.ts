import { EventEmitter } from 'events';

export enum KeyAction {
  PLAY_ALL = 'PLAY_ALL',
  PLAY_SENTENCE = 'PLAY_SENTENCE',
  STOP = 'STOP',
  NEXT = 'NEXT',
  PREVIOUS = 'PREVIOUS',
  QUIT = 'QUIT',
  RATE_1 = 'RATE_1',
  RATE_2 = 'RATE_2',
  RATE_3 = 'RATE_3',
  RATE_4 = 'RATE_4',
}

export class KeyboardHandler extends EventEmitter {
  private isListening = false;

  constructor() {
    super();
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  private handleKeyPress(data: Buffer): void {
    const key = data.toString();

    switch (key) {
      case ' ':
        this.emit(KeyAction.PLAY_ALL);
        break;
      case 'r':
        this.emit(KeyAction.PLAY_SENTENCE);
        break;
      case 's':
        this.emit(KeyAction.STOP);
        break;
      case 'n':
        this.emit(KeyAction.NEXT);
        break;
      case 'p':
        this.emit(KeyAction.PREVIOUS);
        break;
      case 'q':
        this.emit(KeyAction.QUIT);
        break;
      case '1':
        this.emit(KeyAction.RATE_1);
        break;
      case '2':
        this.emit(KeyAction.RATE_2);
        break;
      case '3':
        this.emit(KeyAction.RATE_3);
        break;
      case '4':
        this.emit(KeyAction.RATE_4);
        break;
    }
  }

  start(): void {
    if (!this.isListening) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', this.handleKeyPress);
      this.isListening = true;
    }
  }

  stop(): void {
    if (this.isListening) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', this.handleKeyPress);
      this.isListening = false;
    }
  }

  displayControls(): void {
    console.log('\nControls:');
    console.log('SPACE: Play/Replay all audio');
    console.log('R: Play sentence');
    console.log('S: Stop playback');
    console.log('N: Next card');
    console.log('P: Previous card');
    console.log('1-4: Rate card');
    console.log('Q: Quit session');
  }
}
