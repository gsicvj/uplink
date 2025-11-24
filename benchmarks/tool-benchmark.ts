import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";
import type { ChatResponse, Message, Tool as OllamaTool } from "ollama";
import type { ModelMessage, ToolSet } from "ai";
import {
  experimental_createMCPClient as createMCPClient,
  type experimental_MCPClient as MCPClient,
} from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { Client } from "../client/client";
import { LocalModel } from "../models/llm";
import { GroqModel } from "../models/groq";
import { getConfig, type Config } from "../lib/get-mcp-config";

type ProviderOption = "local" | "remote";

interface BenchmarkOptions {
  providers: ProviderOption[];
  toolCounts: number[];
  samples: number;
  outputFormat: "text" | "json";
  logFilePath?: string;
  prompts: string[];
}

interface TimingSample {
  toolCount: number;
  sampleIndex: number;
  wallTimeSeconds: number;
  modelTimeSeconds: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface ToolCountSummary {
  toolCount: number;
  sampleCount: number;
  wallStats: StatSummary;
  modelStats: StatSummary | null;
  averageInputTokens: number | null;
  averageOutputTokens: number | null;
  rawSamples: TimingSample[];
  errors: string[];
}

interface ProviderSummary {
  provider: ProviderOption;
  modelId: string;
  toolSummaries: ToolCountSummary[];
}

interface StatSummary {
  average: number;
  min: number;
  max: number;
  median: number;
}

type RemoteUsage = {
  total_time?: number;
  prompt_time?: number;
  completion_time?: number;
};

type RemoteResponseBody = {
  body?: {
    usage?: RemoteUsage;
  };
};

const FIRST_PROMPT = "Hello, how are you?";
const SECOND_PROMPT = "Which tools do you have?";
const PROMPTS = [FIRST_PROMPT, SECOND_PROMPT];

const DEFAULT_TOOL_COUNTS = [1, 5, 10, 15, 20];
const DEFAULT_SAMPLES = 3;
const DEFAULT_LOG_DIR = "benchmarks/logs";
const LOG_FILE_PREFIX = "per-tool-count";

const SERVER_COMMAND = "bun";
const SERVER_SCRIPT_PATH = join(
  process.cwd(),
  "servers",
  "benchmark",
  "dummy-tool-server.ts"
);

const ollamaToolsCache: Map<number, OllamaTool[]> = new Map();
const aiToolsCache: Map<number, ToolSet> = new Map();

async function main() {
  const config = await getConfig();
  const options = parseOptions(config);
  const generatedAt = new Date();
  const summaries: ProviderSummary[] = [];

  for (const provider of options.providers) {
    if (provider === "local") {
      const summary = await runLocalBenchmark({
        config,
        toolCounts: options.toolCounts,
        samples: options.samples,
      });
      summaries.push(summary);
    } else if (provider === "remote") {
      const summary = await runRemoteBenchmark({
        config,
        toolCounts: options.toolCounts,
        samples: options.samples,
      });
      summaries.push(summary);
    }
  }

  if (options.outputFormat === "json") {
    console.log(
      JSON.stringify(
        {
          generatedAt: generatedAt.toISOString(),
          prompts: options.prompts,
          summaries,
        },
        null,
        2
      )
    );
  } else {
    renderTextSummary(summaries, options.prompts);
  }

  await writeBenchmarkLog({
    generatedAt,
    options,
    summaries,
  });
}

function parseOptions(config: Config): BenchmarkOptions {
  const args = Bun.argv.slice(2);

  const providersArg =
    getArgValue(args, "--providers") ?? getArgValue(args, "--provider");
  let providers: ProviderOption[];
  if (providersArg) {
    providers = providersArg
      .split(",")
      .map((value) => value.trim())
      .filter(
        (value): value is ProviderOption =>
          value === "local" || value === "remote"
      );
    if (providers.length === 0) {
      throw new Error(`Invalid providers argument: ${providersArg}`);
    }
  } else {
    providers = config.agentProvider === "remoteAgent" ? ["remote"] : ["local"];
  }

  const toolCountsArg =
    getArgValue(args, "--tool-counts") ?? getArgValue(args, "--tool-count");
  const toolCounts = toolCountsArg
    ? toolCountsArg
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    : DEFAULT_TOOL_COUNTS;
  if (toolCounts.length === 0) {
    throw new Error("No valid tool counts provided.");
  }

  const samplesArg = getArgValue(args, "--samples");
  const samples = samplesArg
    ? Math.max(1, Number(samplesArg))
    : DEFAULT_SAMPLES;
  if (!Number.isInteger(samples)) {
    throw new Error("Samples argument must be an integer.");
  }

  const outputFormatArg = getArgValue(args, "--output");
  const outputFormat = outputFormatArg === "json" ? "json" : "text";

  const logFilePath =
    getArgValue(args, "--log-file") ??
    getArgValue(args, "--logfile") ??
    getArgValue(args, "--log");

  return {
    providers,
    toolCounts,
    samples,
    outputFormat,
    logFilePath,
    prompts: PROMPTS,
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

async function runLocalBenchmark({
  config,
  toolCounts,
  samples,
}: {
  config: Config;
  toolCounts: number[];
  samples: number;
}): Promise<ProviderSummary> {
  const localConfig = config.localAgent;
  const model = new LocalModel(localConfig);
  const toolSummaries: ToolCountSummary[] = [];

  for (const toolCount of toolCounts) {
    console.log(`\n[Local] Starting tool count: ${toolCount}`);
    const samplesForCount: TimingSample[] = [];
    const errors: string[] = [];
    let tools: OllamaTool[];

    try {
      console.log(`[Local] Loading tools for count ${toolCount}...`);
      tools = await ensureOllamaTools(toolCount);
      console.log(`[Local] Loaded ${toolCount} tools`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Unknown error loading tools for count ${toolCount}`;
      console.error(
        `[Local] Error loading tools for count ${toolCount}: ${message}`
      );
      toolSummaries.push(
        summarizeSamples({
          toolCount,
          samples: [],
          errors: [message],
        })
      );
      continue;
    }

    for (let index = 0; index < samples; index++) {
      try {
        console.log(
          `[Local] Running sample ${
            index + 1
          }/${samples} for ${toolCount} tools...`
        );
        const sample = await runLocalSample({
          model,
          toolCount,
          tools,
        });
        samplesForCount.push({ ...sample, sampleIndex: index + 1 });
        console.log(
          `[Local] Completed sample ${index + 1}/${samples} (wall: ${
            sample.wallTimeSeconds
          }s)`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : `Unknown error during local benchmark with ${toolCount} tools`;
        console.error(
          `[Local] Error in sample ${index + 1}/${samples}: ${errorMessage}`
        );
        errors.push(errorMessage);
      }
    }

    toolSummaries.push(
      summarizeSamples({
        toolCount,
        samples: samplesForCount,
        errors,
      })
    );
    console.log(
      `[Local] Completed tool count: ${toolCount} (${samplesForCount.length}/${samples} samples)`
    );
  }

  return {
    provider: "local",
    modelId: localConfig.modelId,
    toolSummaries,
  };
}

async function runRemoteBenchmark({
  config,
  toolCounts,
  samples,
}: {
  config: Config;
  toolCounts: number[];
  samples: number;
}): Promise<ProviderSummary> {
  const remoteConfig = config.remoteAgent;
  const model = new GroqModel(remoteConfig.modelId);
  const toolSummaries: ToolCountSummary[] = [];

  for (const toolCount of toolCounts) {
    console.log(`\n[Remote] Starting tool count: ${toolCount}`);
    const samplesForCount: TimingSample[] = [];
    const errors: string[] = [];
    let tools: ToolSet;

    try {
      console.log(`[Remote] Loading tools for count ${toolCount}...`);
      tools = await ensureAiTools(toolCount);
      console.log(`[Remote] Loaded ${toolCount} tools`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Unknown error loading tools for count ${toolCount}`;
      console.error(
        `[Remote] Error loading tools for count ${toolCount}: ${message}`
      );
      toolSummaries.push(
        summarizeSamples({
          toolCount,
          samples: [],
          errors: [message],
        })
      );
      continue;
    }

    for (let index = 0; index < samples; index++) {
      try {
        console.log(
          `[Remote] Running sample ${
            index + 1
          }/${samples} for ${toolCount} tools...`
        );
        const sample = await runRemoteSample({
          model,
          toolCount,
          tools,
        });
        samplesForCount.push({ ...sample, sampleIndex: index + 1 });
        console.log(
          `[Remote] Completed sample ${index + 1}/${samples} (wall: ${
            sample.wallTimeSeconds
          }s)`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : `Unknown error during remote benchmark with ${toolCount} tools`;
        console.error(
          `[Remote] Error in sample ${index + 1}/${samples}: ${errorMessage}`
        );
        errors.push(errorMessage);
      }
    }

    toolSummaries.push(
      summarizeSamples({
        toolCount,
        samples: samplesForCount,
        errors,
      })
    );
    console.log(
      `[Remote] Completed tool count: ${toolCount} (${samplesForCount.length}/${samples} samples)`
    );
  }

  return {
    provider: "remote",
    modelId: remoteConfig.modelId,
    toolSummaries,
  };
}

async function runLocalSample({
  model,
  toolCount,
  tools,
}: {
  model: LocalModel;
  toolCount: number;
  tools: OllamaTool[];
}): Promise<Omit<TimingSample, "sampleIndex">> {
  const conversation: Message[] = [
    {
      role: "user",
      content: FIRST_PROMPT,
    },
  ];

  const wallStart = performance.now();
  const firstResponse = await model.createMessage({
    messages: [...conversation],
    tools,
  });

  appendAssistantMessage(conversation, firstResponse);
  conversation.push({
    role: "user",
    content: SECOND_PROMPT,
  });

  const secondResponse = await model.createMessage({
    messages: [...conversation],
    tools,
  });
  const wallDuration = (performance.now() - wallStart) / 1000;

  const modelDurationSeconds = sumDurations([firstResponse, secondResponse]);

  const inputTokensSum = sumNumbers([
    firstResponse.prompt_eval_count,
    secondResponse.prompt_eval_count,
  ]);
  const outputTokensSum = sumNumbers([
    firstResponse.eval_count,
    secondResponse.eval_count,
  ]);

  return {
    toolCount,
    wallTimeSeconds: +wallDuration.toFixed(4),
    modelTimeSeconds: modelDurationSeconds,
    inputTokens: normalizeTokenSum(inputTokensSum),
    outputTokens: normalizeTokenSum(outputTokensSum),
  };
}

async function runRemoteSample({
  model,
  toolCount,
  tools,
}: {
  model: GroqModel;
  toolCount: number;
  tools: ToolSet;
}): Promise<Omit<TimingSample, "sampleIndex">> {
  const conversation: ModelMessage[] = [
    {
      role: "user",
      content: FIRST_PROMPT,
    },
  ];

  const wallStart = performance.now();
  const firstResponse = await model.createMessage({
    messages: [...conversation],
    tools,
  });

  appendRemoteAssistantMessage(conversation, firstResponse);
  conversation.push({
    role: "user",
    content: SECOND_PROMPT,
  });

  const secondResponse = await model.createMessage({
    messages: [...conversation],
    tools,
  });
  const wallDuration = (performance.now() - wallStart) / 1000;

  const firstUsage = extractRemoteUsage(firstResponse);
  const secondUsage = extractRemoteUsage(secondResponse);

  const modelDurationSum = sumNumbers([
    firstUsage?.total_time,
    secondUsage?.total_time,
  ]);
  const modelDurationSeconds =
    modelDurationSum === null ? null : +modelDurationSum.toFixed(4);
  const inputTokensSum = sumNumbers([
    firstResponse.usage?.inputTokens,
    secondResponse.usage?.inputTokens,
  ]);
  const outputTokensSum = sumNumbers([
    firstResponse.usage?.outputTokens,
    secondResponse.usage?.outputTokens,
  ]);

  return {
    toolCount,
    wallTimeSeconds: +wallDuration.toFixed(4),
    modelTimeSeconds: modelDurationSeconds,
    inputTokens: normalizeTokenSum(inputTokensSum),
    outputTokens: normalizeTokenSum(outputTokensSum),
  };
}

function appendAssistantMessage(
  conversation: Message[],
  response: ChatResponse
) {
  const assistantMessage = response.message;
  if (!assistantMessage) {
    return;
  }
  conversation.push({
    role: assistantMessage.role,
    content: assistantMessage.content,
  });
}

function appendRemoteAssistantMessage(
  conversation: ModelMessage[],
  response: Awaited<ReturnType<GroqModel["createMessage"]>>
) {
  const assistantText = response.text;
  if (!assistantText) {
    return;
  }
  conversation.push({
    role: "assistant",
    content: assistantText,
  });
}

function sumDurations(responses: ChatResponse[]): number | null {
  const totalNanoseconds = responses
    .map((response) => response.total_duration)
    .filter((value): value is number => typeof value === "number")
    .reduce((total, value) => total + value, 0);

  if (totalNanoseconds <= 0) {
    return null;
  }

  return +(totalNanoseconds / 1e9).toFixed(4);
}

function sumNumbers(values: Array<number | undefined | null>): number | null {
  const numericValues = values.filter(
    (value): value is number => typeof value === "number"
  );
  if (numericValues.length === 0) {
    return null;
  }
  return numericValues.reduce((sum, value) => sum + value, 0);
}

function normalizeTokenSum(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.max(0, Math.round(value));
}

function extractRemoteUsage(
  response: Awaited<ReturnType<GroqModel["createMessage"]>>
): RemoteUsage | null {
  const body = (response.response as RemoteResponseBody) ?? {};
  return body.body?.usage ?? null;
}

function summarizeSamples({
  toolCount,
  samples,
  errors,
}: {
  toolCount: number;
  samples: TimingSample[];
  errors: string[];
}): ToolCountSummary {
  const wallTimes = samples.map((sample) => sample.wallTimeSeconds);
  const modelTimes = samples
    .map((sample) => sample.modelTimeSeconds)
    .filter((value): value is number => typeof value === "number");
  const inputTokens = samples
    .map((sample) => sample.inputTokens)
    .filter((value): value is number => typeof value === "number");
  const outputTokens = samples
    .map((sample) => sample.outputTokens)
    .filter((value): value is number => typeof value === "number");

  return {
    toolCount,
    sampleCount: samples.length,
    wallStats: computeStats(wallTimes),
    modelStats: modelTimes.length > 0 ? computeStats(modelTimes) : null,
    averageInputTokens: inputTokens.length > 0 ? average(inputTokens) : null,
    averageOutputTokens: outputTokens.length > 0 ? average(outputTokens) : null,
    rawSamples: samples,
    errors,
  };
}

function computeStats(values: number[]): StatSummary {
  if (values.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      median: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const averageValue = average(values);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : sorted[Math.floor(sorted.length / 2)]!;

  return {
    average: +averageValue.toFixed(4),
    min: +min.toFixed(4),
    max: +max.toFixed(4),
    median: +median.toFixed(4),
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function renderTextSummary(summaries: ProviderSummary[], prompts: string[]) {
  console.log(`Prompts: "${prompts[0] ?? ""}" -> "${prompts[1] ?? ""}"`);
  for (const summary of summaries) {
    console.log(`\nProvider: ${summary.provider} (${summary.modelId})`);
    for (const toolSummary of summary.toolSummaries) {
      console.log(
        `  tools=${toolSummary.toolCount} | samples=${toolSummary.sampleCount} | wall avg=${toolSummary.wallStats.average}s (min=${toolSummary.wallStats.min}s, max=${toolSummary.wallStats.max}s)`
      );
      if (toolSummary.modelStats) {
        console.log(
          `    model avg=${toolSummary.modelStats.average}s (min=${toolSummary.modelStats.min}s, max=${toolSummary.modelStats.max}s)`
        );
      }
      if (
        toolSummary.averageInputTokens !== null ||
        toolSummary.averageOutputTokens !== null
      ) {
        console.log(
          `    avg tokens: input=${
            toolSummary.averageInputTokens ?? "n/a"
          }, output=${toolSummary.averageOutputTokens ?? "n/a"}`
        );
      }
      if (toolSummary.errors.length > 0) {
        console.log(`    errors: ${toolSummary.errors.join("; ")}`);
      }
    }
  }
}

async function writeBenchmarkLog({
  generatedAt,
  options,
  summaries,
}: {
  generatedAt: Date;
  options: BenchmarkOptions;
  summaries: ProviderSummary[];
}) {
  const timestamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const modelNames = summaries
    .map((s) => s.modelId.replace(/[^a-zA-Z0-9-_]/g, "-")) // sanitize for filename
    .filter((id, index, self) => self.indexOf(id) === index) // unique
    .join("-");
  const modelSuffix = modelNames ? `-${modelNames}` : "";
  const defaultRelativePath = join(
    DEFAULT_LOG_DIR,
    `${LOG_FILE_PREFIX}${modelSuffix}-${timestamp}.json`
  );
  const targetPath = options.logFilePath ?? defaultRelativePath;
  const absolutePath = isAbsolute(targetPath)
    ? targetPath
    : join(process.cwd(), targetPath);

  await mkdir(dirname(absolutePath), { recursive: true });

  const payload = {
    generatedAt: generatedAt.toISOString(),
    options: {
      providers: options.providers,
      toolCounts: options.toolCounts,
      samples: options.samples,
      prompts: options.prompts,
      outputFormat: options.outputFormat,
    },
    summaries,
  };

  await writeFile(absolutePath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Benchmark log saved to ${absolutePath}`);
}

async function ensureOllamaTools(toolCount: number): Promise<OllamaTool[]> {
  if (ollamaToolsCache.has(toolCount)) {
    return ollamaToolsCache.get(toolCount)!;
  }

  const client = new Client({
    serverName: `benchmark-ollama-${toolCount}`,
    command: SERVER_COMMAND,
    args: createServerArgs(toolCount),
  });

  try {
    await client.connectToServer();
    await client.saveTools();
    if (!client.tools) {
      throw new Error("Server did not return any tools.");
    }
    ollamaToolsCache.set(toolCount, client.tools);
    return client.tools;
  } finally {
    await client.disconnectFromServer().catch(() => undefined);
  }
}

async function ensureAiTools(toolCount: number): Promise<ToolSet> {
  if (aiToolsCache.has(toolCount)) {
    return aiToolsCache.get(toolCount)!;
  }

  const transport = new StdioClientTransport({
    command: SERVER_COMMAND,
    args: createServerArgs(toolCount),
    stderr: "ignore",
  });

  const client: MCPClient = await createMCPClient({
    name: `benchmark-ai-${toolCount}`,
    transport,
  });

  try {
    const tools = await client.tools();
    aiToolsCache.set(toolCount, tools);
    return tools;
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}

function createServerArgs(toolCount: number): string[] {
  return ["run", SERVER_SCRIPT_PATH, "--tool-count", String(toolCount)];
}

await main();
