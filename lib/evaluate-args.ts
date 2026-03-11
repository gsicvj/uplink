import { ensureDirs } from "./ensure-dirs";

const LOCAL_ARG = "--local"
const REMOTE_ARG = "--remote"
const PROMPT_ARG = "--prompt"

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

export async function getPromptFromArgs(args: string[]): Promise<string | null> {
  const promptArgIndex = args.indexOf(PROMPT_ARG);
  if (promptArgIndex === -1) return null;
  const text = args[promptArgIndex + 1];
  return typeof text === "string" ? text : null;
}