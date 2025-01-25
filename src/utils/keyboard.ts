export async function waitForKeyPress(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.once('data', data => {
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
