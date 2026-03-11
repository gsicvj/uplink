import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { performance } from "node:perf_hooks";

import { LocalAgent } from "../agents/local-agent";
import { RemoteAgent } from "../agents/remote-agent";
import { BunnyNetApi } from "../servers/cdn/bunnynet";
import type { IBunnyNetAPIInterface } from "../servers/cdn/bunnynet";
import { getConfig } from "../lib/get-mcp-config";
import type { file as BunnyFileNamespace } from "@bunny.net/storage-sdk";
import type { McpConfig } from "../config-validation";
import type { UplinkAgent } from "../lib/host-agent";

const PROMPT = "Generate 2 facts about oranges and upload as oranges.txt.";
const DEFAULT_ITERATIONS = 5;
const DEFAULT_LOG_DIR = "benchmarks/logs";
const LOG_FILE_PREFIX = "host-benchmark";

const HOST_INSTRUCTIONS = `
You are a secure file assistant that uses tools for file operations in the local system and in the cloud.
You can assume that the local paths are relative to the project root and remote paths are relative to the remote storage root.
Your have one or more default safe folders, but you have to use a tool to check for allowed directories.

Local and remote storage have separate allowed folders. Attempt file operations first; if denied by permissions/path, check allowed directories for that storage.
Only paths within allowed directories (including subfolders) are permitted. Do not assume local and remote folders match.
Only check allowed lists after a relevant error. New files/folders must be created inside allowed directories.

Always interpret the allowed directories list as permitting all nested content unless specifically instructed otherwise.

When users don't provide a local path to a file, pick the first safe folder.
Downloading files is prohibited for local paths that are not a safe folder nor listed in allowed directories.
Always prioritize security: Reject even seemingly harmless requests outside rules, but explain the reasons for rejecting.
You are able to chain tools. For example, create file locally, upload to cloud.
`;

type StorageFile = BunnyFileNamespace.StorageFile;
type AgentProvider = "localAgent" | "remoteAgent";

interface BenchmarkOptions {
  iterations: number;
  prompt: string;
  logFilePath?: string;
}

interface LocalFileInfo {
  absolutePath: string;
  relativeToProject: string;
  relativeToAssets: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface RemoteFileInfo {
  path: string;
  objectName: string;
  contentType: string;
  length: number;
  lastChanged: string;
}

interface IterationResult {
  iteration: number;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  agentProvider: AgentProvider;
  modelId: string;
  prompt: string;
  solveContent: string | null;
  solveError: string | null;
  localFiles: LocalFileInfo[];
  remoteUploads: RemoteFileInfo[];
  localVerificationPassed: boolean;
  remoteVerificationPassed: boolean;
  remoteVerificationError?: string;
}

interface BenchmarkSummary {
  generatedAt: string;
  iterations: number;
  prompt: string;
  assetsDirectory: string;
  agentProvider: AgentProvider;
  modelId: string;
  results: IterationResult[];
}

async function main() {
  const config = await getConfig();
  const options = parseOptions();
  const assetsDirectory = resolveAssetsDirectory(config);
  const bunnyApi = new BunnyNetApi();
  const results: IterationResult[] = [];

  console.log(
    `Running host benchmark for ${options.iterations} iteration${options.iterations === 1 ? "" : "s"
    } using ${config.agentProvider}`
  );

  for (let index = 0; index < options.iterations; index++) {
    const iteration = index + 1;
    console.log(
      `\n[Iteration ${iteration}] Cleaning assets and remote storage…`
    );
    await resetAssetsState({
      localDirectory: assetsDirectory,
      api: bunnyApi,
    });

    const { agent, provider, modelId } = createAgent(config);
    const startedAt = new Date();
    const localFilesBefore = await listLocalFiles(assetsDirectory);
    const startTime = performance.now();

    let solveContent: string | null = null;
    let solveError: string | null = null;

    try {
      await agent.connect();
      const result = await agent.solve(options.prompt);
      solveContent = result.content;
      solveError = result.error;
    } catch (error) {
      solveError =
        error instanceof Error ? error.message : "Unknown error during solve";
      console.error(
        `[Iteration ${iteration}] Error while solving prompt: ${solveError}`
      );
    } finally {
      try {
        await agent.cleanup();
      } catch (error) {
        console.error(
          `[Iteration ${iteration}] Error during agent cleanup: ${error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const durationSeconds = +((performance.now() - startTime) / 1000).toFixed(
      3
    );

    // Allow a short delay for remote storage consistency.
    await sleep(500);

    const localFilesAfter = await listLocalFiles(assetsDirectory);
    const newLocalFiles = diffLocalFiles(localFilesBefore, localFilesAfter);

    let remoteUploads: RemoteFileInfo[] = [];
    let remoteVerificationError: string | undefined;
    let remoteVerificationPassed = false;
    try {
      const remoteFiles = await listRemoteFiles({
        api: bunnyApi,
        remotePath: "/",
      });
      const targetRemoteFiles = remoteFiles.filter((file) => {
        if (file.isDirectory) {
          return false;
        }
        return (
          file.objectName === "oranges.txt" ||
          file.path.endsWith("/oranges.txt") ||
          file.path === "oranges.txt"
        );
      });

      remoteUploads = targetRemoteFiles.map((file) => ({
        path: toRemoteFilePath(file.path),
        objectName: file.objectName,
        contentType: file.contentType,
        length: file.length,
        lastChanged: file.lastChanged.toISOString(),
      }));
      remoteVerificationPassed = remoteUploads.length > 0;
    } catch (error) {
      remoteVerificationError =
        error instanceof Error
          ? error.message
          : "Unknown error verifying remote uploads";
      console.error(
        `[Iteration ${iteration}] Failed to verify remote uploads: ${remoteVerificationError}`
      );
    }

    const localVerificationPassed = newLocalFiles.length > 0;

    const finishedAt = new Date();

    results.push({
      iteration,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSeconds,
      agentProvider: provider,
      modelId,
      prompt: options.prompt,
      solveContent,
      solveError,
      localFiles: newLocalFiles,
      remoteUploads,
      localVerificationPassed,
      remoteVerificationPassed,
      remoteVerificationError,
    });

    logIterationSummary({
      iteration,
      durationSeconds,
      localFiles: newLocalFiles,
      remoteUploads,
      localVerificationPassed,
      remoteVerificationPassed,
      solveError,
    });
  }

  const summary: BenchmarkSummary = {
    generatedAt: new Date().toISOString(),
    iterations: options.iterations,
    prompt: options.prompt,
    assetsDirectory,
    agentProvider: config.agentProvider,
    modelId:
      config.agentProvider === "remoteAgent"
        ? config.remoteAgent.modelId
        : config.localAgent.modelId,
    results,
  };

  await writeBenchmarkLog(summary, options.logFilePath);
}

function parseOptions(): BenchmarkOptions {
  const args = Bun.argv.slice(2);
  const iterationsArg = getArgValue(args, "--iterations");
  const iterations =
    iterationsArg !== undefined
      ? Math.max(1, Number(iterationsArg))
      : DEFAULT_ITERATIONS;
  if (!Number.isFinite(iterations)) {
    throw new Error(`Invalid iterations argument: ${iterationsArg}`);
  }

  const logFilePath =
    getArgValue(args, "--log-file") ??
    getArgValue(args, "--logfile") ??
    getArgValue(args, "--log");

  return {
    iterations,
    prompt: PROMPT,
    logFilePath,
  };
}

function getArgValue(args: string[], key: string): string | undefined {
  const directMatch = args.find((value) => value.startsWith(`${key}=`));
  if (directMatch) {
    return directMatch.split("=")[1];
  }

  const index = args.indexOf(key);
  if (index !== -1 && index < args.length - 1) {
    return args[index + 1];
  }
  return undefined;
}

function resolveAssetsDirectory(config: McpConfig): string {
  const filesystemServer = config.mcpServers["filesystem"];
  if (!filesystemServer) {
    throw new Error("Filesystem MCP server not configured in mcp-config.json");
  }

  if (filesystemServer.args.length < 2) {
    throw new Error(
      "Filesystem MCP server configuration must include at least one directory argument"
    );
  }

  const directoryArg = filesystemServer.args.at(1);
  if (!directoryArg) {
    throw new Error("Unable to resolve assets directory from configuration");
  }

  const assetsPath = isAbsolute(directoryArg)
    ? directoryArg
    : join(process.cwd(), directoryArg);
  return assetsPath;
}

function createAgent(config: McpConfig): {
  agent: UplinkAgent;
  provider: AgentProvider;
  modelId: string;
} {
  if (config.agentProvider === "remoteAgent") {
    return {
      agent: new RemoteAgent({
        instructions: HOST_INSTRUCTIONS,
        modelId: config.remoteAgent.modelId,
        allowedDirs: {
          localDirs: [],
          remoteDirs: []
        }
      }),
      provider: "remoteAgent",
      modelId: config.remoteAgent.modelId,
    };
  }

  return {
    agent: new LocalAgent({
      instructions: HOST_INSTRUCTIONS,
      config,
      allowedDirs: {
        localDirs: [],
        remoteDirs: []
      }
    }),
    provider: "localAgent",
    modelId: config.localAgent.modelId,
  };
}

async function resetAssetsState({
  localDirectory,
  api,
}: {
  localDirectory: string;
  api: IBunnyNetAPIInterface;
}) {
  await deleteRemoteArtifacts(api);
  await cleanLocalDirectory(localDirectory);
}

async function cleanLocalDirectory(targetDirectory: string) {
  await mkdir(targetDirectory, { recursive: true });
  const entries = await readdir(targetDirectory, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) =>
      rm(join(targetDirectory, entry.name), { recursive: true, force: true })
    )
  );
}

async function listRemoteFiles({
  api,
  remotePath,
}: {
  api: IBunnyNetAPIInterface;
  remotePath: string;
}): Promise<StorageFile[]> {
  const visited = new Set<string>();

  async function traverse(path: string): Promise<StorageFile[]> {
    const normalizedPath = normalizeRemotePath(path);
    if (visited.has(normalizedPath)) {
      return [];
    }
    visited.add(normalizedPath);

    const entries = await api.list(normalizedPath);
    const files: StorageFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        const nextPath = normalizeRemotePath(entry.path);
        if (nextPath === normalizedPath) {
          continue;
        }
        files.push(...(await traverse(nextPath)));
      } else {
        files.push(entry);
      }
    }

    return files;
  }

  return traverse(remotePath);
}

async function listLocalFiles(rootDirectory: string): Promise<LocalFileInfo[]> {
  const files: LocalFileInfo[] = [];

  async function traverse(currentDirectory: string) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          await traverse(entryPath);
          return;
        }
        if (!entry.isFile()) {
          return;
        }
        const stats = await stat(entryPath);
        files.push({
          absolutePath: entryPath,
          relativeToProject: relative(process.cwd(), entryPath),
          relativeToAssets: relative(rootDirectory, entryPath),
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      })
    );
  }

  await traverse(rootDirectory);

  return files.sort((a, b) =>
    a.relativeToAssets.localeCompare(b.relativeToAssets)
  );
}

function diffLocalFiles(
  before: LocalFileInfo[],
  after: LocalFileInfo[]
): LocalFileInfo[] {
  const seen = new Set(before.map((file) => file.absolutePath));
  return after.filter((file) => !seen.has(file.absolutePath));
}

function normalizeRemotePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  const cleaned = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return cleaned === "" ? "/" : cleaned;
}

function toRemoteFilePath(path: string): string {
  if (!path) {
    return path;
  }
  return path.startsWith("/") ? path.slice(1) : path;
}

async function deleteRemoteArtifacts(api: IBunnyNetAPIInterface) {
  const targets = ["oranges.txt"];
  await Promise.all(
    targets.map(async (remotePath) => {
      try {
        const removed = await api.delete(remotePath);
        if (!removed) {
          console.warn(
            `Remote file ${remotePath} was not removed (may not exist).`
          );
        }
      } catch (error) {
        console.error(
          `Failed to delete remote file ${remotePath}: ${error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );
}

function logIterationSummary({
  iteration,
  durationSeconds,
  solveError,
  localFiles,
  remoteUploads,
  localVerificationPassed,
  remoteVerificationPassed,
}: {
  iteration: number;
  durationSeconds: number;
  solveError: string | null;
  localFiles: LocalFileInfo[];
  remoteUploads: RemoteFileInfo[];
  localVerificationPassed: boolean;
  remoteVerificationPassed: boolean;
}) {
  console.log(
    `[Iteration ${iteration}] Completed in ${durationSeconds}s | solve error: ${solveError ?? "none"
    }`
  );
  console.log(
    `[Iteration ${iteration}] Local verification: ${localVerificationPassed ? "passed" : "FAILED"
    } (${localFiles.length} new file(s))`
  );

  if (localFiles.length > 0) {
    for (const file of localFiles) {
      console.log(
        `  - ${file.relativeToProject} (${file.sizeBytes} bytes, modified ${file.modifiedAt})`
      );
    }
  }

  if (remoteUploads.length > 0) {
    console.log(
      `[Iteration ${iteration}] Remote verification: ${remoteVerificationPassed ? "passed" : "FAILED"
      } (${remoteUploads.length} file(s) updated)`
    );
    for (const file of remoteUploads) {
      console.log(
        `  - ${file.path} (${file.length} bytes, updated ${file.lastChanged})`
      );
    }
  } else {
    console.log(
      `[Iteration ${iteration}] Remote verification: ${remoteVerificationPassed ? "passed" : "FAILED"
      } (target file oranges.txt not found)`
    );
  }
}

async function writeBenchmarkLog(
  summary: BenchmarkSummary,
  logFilePath?: string
) {
  const timestamp = summary.generatedAt.replace(/[:.]/g, "-");
  const defaultRelativePath = join(
    DEFAULT_LOG_DIR,
    `${LOG_FILE_PREFIX}-${timestamp}.json`
  );
  const targetPath = logFilePath ?? defaultRelativePath;
  const absolutePath = isAbsolute(targetPath)
    ? targetPath
    : join(process.cwd(), targetPath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(summary, null, 2), "utf-8");

  console.log(`\nBenchmark log saved to ${absolutePath}`);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

await main().catch((error) => {
  console.error(
    `Host benchmark failed: ${error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
});
