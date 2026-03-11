import { ensureDirs } from "./ensure-dirs";

const LOCAL_ARG = "--local"
const REMOTE_ARG = "--remote"

export type AllowedDirs = {
  localDirs: string[],
  remoteDirs: string[]
}

export async function getDirsFromArgs(args: string[]): Promise<AllowedDirs> {
  let localDirs: string[] = [];
  let remoteDirs: string[] = [];
  let isReadingLocalDirs = false;
  let isReadingRemoteDirs = false;
  for (const arg of args) {
    if (arg === LOCAL_ARG) {
      isReadingLocalDirs = true;
      isReadingRemoteDirs = false;
    } else if (arg === REMOTE_ARG) {
      isReadingRemoteDirs = true;
      isReadingLocalDirs = false;
    } else if (isReadingLocalDirs) {
      localDirs.push(arg);
    } else if (isReadingRemoteDirs) {
      remoteDirs.push(arg);
    }
  }
  // If dirs can't be accessed, ensured object will not have them
  const ensuredLocalDirs = await ensureDirs(localDirs);
  const ensuredRemoteDirs = await ensureDirs(remoteDirs);

  return { localDirs: ensuredLocalDirs, remoteDirs: ensuredRemoteDirs };
}