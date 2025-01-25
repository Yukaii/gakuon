export async function waitForKeyPress(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', data => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString());
    });
  });
}

export function displayControls() {
  console.log('\nControls:');
  console.log('SPACE: Replay all audio');
  console.log('R: Replay example sentence');
  console.log('1-4: Rate card and continue');
  console.log('Q: Quit session');
}