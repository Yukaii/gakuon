export async function playAudio(filepath: string): Promise<void> {
  await Bun.spawn([
    'ffplay',
    '-nodisp',
    '-autoexit',
    '-hide_banner',
    '-loglevel',
    'quiet',
    filepath
  ]).exited;
}
