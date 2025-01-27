import { EventEmitter } from "events";

export enum KeyAction {
  PLAY_ALL = "PLAY_ALL",
  PLAY_SENTENCE = "PLAY_SENTENCE",
  STOP = "STOP",
  NEXT = "NEXT",
  PREVIOUS = "PREVIOUS",
  QUIT = "QUIT",
  RATE_1 = "RATE_1",
  RATE_2 = "RATE_2",
  RATE_3 = "RATE_3",
  RATE_4 = "RATE_4",
  REGENERATE = "REGENERATE",
}

export class KeyboardHandler extends EventEmitter {
  private isListening = false;
  private _handleKeyPress: (data: Buffer) => void;

  constructor(private debug = false) {
    super();
    this._handleKeyPress = this.handleKeyPress.bind(this);
  }

  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log("[KeyboardHandler]", ...args);
    }
  }

  private handleKeyPress(data: Buffer): void {
    const key = data.toString().toLowerCase();

    this.debugLog("key pressed: ", key);

    switch (key) {
      case " ":
        this.emit(KeyAction.PLAY_ALL);
        break;
      case "r":
        this.emit(KeyAction.PLAY_SENTENCE);
        break;
      case "s":
        this.emit(KeyAction.STOP);
        break;
      case "n":
        this.emit(KeyAction.NEXT);
        break;
      case "p":
        this.emit(KeyAction.PREVIOUS);
        break;
      case "q":
        this.emit(KeyAction.QUIT);
        break;
      case "g":
        this.emit(KeyAction.REGENERATE);
        break;
      case "1":
        this.emit(KeyAction.RATE_1);
        break;
      case "2":
        this.emit(KeyAction.RATE_2);
        break;
      case "3":
        this.emit(KeyAction.RATE_3);
        break;
      case "4":
        this.emit(KeyAction.RATE_4);
        break;
    }
  }

  start(): void {
    this.debugLog("start");
    if (!this.isListening) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", this._handleKeyPress);
      this.isListening = true;
    }
  }

  stop(): void {
    if (this.isListening) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", this._handleKeyPress);
      this.isListening = false;
    }
  }

  displayControls(): void {
    console.log("\nControls:");
    console.log("SPACE: Play/Replay all audio");
    console.log("R: Play sentence");
    console.log("S: Stop playback");
    console.log("N: Next card");
    console.log("P: Previous card");
    console.log("1-4: Rate card");
    console.log("Q: Quit session");
    console.log("G: Regenerate content");
  }
}
