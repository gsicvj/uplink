import type { ChatResponse } from "ollama";
import { appendFile, mkdir } from "node:fs/promises";
import { log } from "@clack/prompts";
import type { GenerateTextResult } from "ai";

/** Local log entry: init, chat, or solve from the local (Ollama) agent. */
export type LocalLogObject =
  | {
    type: "init";
    createdAt: number;
    modelId: string;
    totalDuration: number;
  }
  | {
    type: "chat";
    modelId: string;
    createdAt: string;
    outputTokens: number;
    outputDuration: number;
    inputTokens: number;
    inputDuration: number;
    totalDuration: number;
  }
  | {
    type: "solve";
    createdAt: number;
    modelId: string;
    totalDuration: number;
    toolCallsCount: number;
    toolCallsTotalTime: number;
    iterationsCount: number;
  };

/** Remote log entry: init, chat, or solve from the remote agent. */
export type RemoteLogObject =
  | {
    type: "init";
    createdAt: number;
    modelId: string;
    totalDuration: number;
  }
  | {
    type: "chat";
    modelId: string;
    createdAt: string;
    outputTokens: number;
    outputDuration: number;
    inputTokens: number;
    inputDuration: number;
    totalDuration: number;
  }
  | {
    type: "solve";
    createdAt: number;
    modelId: string;
    totalDuration: number;
    toolCallsCount: number;
    toolCallsTotalTime: number;
    iterationsCount: number;
  };

const LOG_DIR = "logging";
const LOCAL_LOG = "local.log";
const REMOTE_LOG = "remote.log";
const localLogPath = `${LOG_DIR}/${LOCAL_LOG}`;
const remoteLogPath = `${LOG_DIR}/${REMOTE_LOG}`;

let isLogDirEnsured = false;

interface ResponseBody {
  body?: {
    [key: string]: any;
    usage?: {
      queue_time: number;
      prompt_tokens: number;
      prompt_time: number;
      completion_tokens: number;
      completion_time: number;
      total_tokens: number;
      total_time: number;
    };
  };
}

let totalTimeSpent = 0;
async function ensureLogDir(): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    isLogDirEnsured = true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    log.warn(`Logging will not work because: ${message}`);
  }
}

export async function logLocalResponse({
  response,
  init,
  solve,
}: {
  response?: ChatResponse;
  init?: {
    modelId: string;
    totalDuration: number;
  };
  solve?: {
    modelId: string;
    totalDuration: number;
    toolCallsCount: number;
    toolCallsTotalTime: number;
    iterationsCount: number;
  };
}) {
  let logObject: LocalLogObject;

  if (init != undefined) {
    logObject = {
      type: "init",
      createdAt: Date.now(),
      ...init,
    };
  } else if (response != undefined) {
    logObject = {
      type: "chat",
      modelId: response.model,
      createdAt: response.created_at instanceof Date
        ? response.created_at.toISOString()
        : response.created_at,
      outputTokens: response.eval_count,
      outputDuration: +(response.eval_duration * 1e-9).toFixed(2),
      inputTokens: response.prompt_eval_count,
      inputDuration: +(response.prompt_eval_duration * 1e-9).toFixed(2),
      totalDuration: +(response.total_duration * 1e-9).toFixed(2),
    };
    totalTimeSpent = +(totalTimeSpent + logObject.totalDuration).toFixed(2);
  } else if (solve != undefined) {
    logObject = {
      type: "solve",
      createdAt: Date.now(),
      ...solve,
    };
  } else {
    return;
  }

  await logResponse(localLogPath, logObject)
}

export async function logRemoteResponse({
  response,
  init,
  solve,
}: {
  response?: GenerateTextResult<any, never>;
  init?: {
    modelId: string;
    totalDuration: number;
  };
  solve?: {
    modelId: string;
    totalDuration: number;
    toolCallsCount: number;
    toolCallsTotalTime: number;
    iterationsCount: number;
  };
}) {
  let logObject: RemoteLogObject;

  if (init != undefined) {
    logObject = {
      type: "init",
      createdAt: Date.now(),
      ...init,
    };
  } else if (response != undefined) {
    // I do not have durations!!!
    const {
      total_time = 0,
      prompt_time = 0,
      completion_time = 0
    } = (response.response as ResponseBody).body?.usage ?? {};

    logObject = {
      type: "chat",
      modelId: response.response.modelId,
      createdAt: response.response.timestamp instanceof Date
        ? response.response.timestamp.toISOString()
        : response.response.timestamp,
      outputTokens: response.usage.outputTokens ?? -1,
      outputDuration: +completion_time.toFixed(2),
      inputTokens: response.usage.inputTokens ?? -1,
      inputDuration: +prompt_time.toFixed(2),
      totalDuration: +total_time.toFixed(2),
    };
    totalTimeSpent = +(totalTimeSpent + logObject.totalDuration).toFixed(2);
  } else if (solve != undefined) {
    logObject = {
      type: "solve",
      createdAt: Date.now(),
      ...solve,
    };
  } else {
    return;
  }

  await logResponse(remoteLogPath, logObject)
}

async function logResponse(path: string, logObject: LocalLogObject | RemoteLogObject) {
  if (!isLogDirEnsured) {
    await ensureLogDir();
  }

  const logEntry = `${JSON.stringify(logObject)}\n`

  appendFile(path, logEntry);
}