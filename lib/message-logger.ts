import type { ChatResponse } from "ollama";
import { appendFile } from "node:fs/promises";
import type { GenerateTextResult } from "ai";

const localLogPath = "logging/local.log";
const remoteLogPath = "logging/remote.log";

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
  let logObject = null;

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
      createdAt: response.created_at,
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
  }

  appendFile(localLogPath, `${JSON.stringify(logObject)}\n`);
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
  let logObject = null;

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
      completion_time = 0,
    } = (response.response as ResponseBody).body?.usage ?? {};

    logObject = {
      type: "chat",
      modelId: response.response.modelId,
      createdAt: response.response.timestamp,
      outputTokens: response.usage.outputTokens,
      outputDuration: +completion_time.toFixed(2),
      inputTokens: response.usage.inputTokens,
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
  }

  appendFile(remoteLogPath, `${JSON.stringify(logObject)}\n`);
}
