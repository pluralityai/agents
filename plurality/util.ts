// util.ts
import { AgentFunction } from "./types";

export function debugPrint(debug: boolean, ...args: any[]): void {
  if (!debug) {
    return;
  }
  const timestamp = new Date().toISOString();
  const message = args.map(String).join(" ");
  console.log(`[${timestamp}] ${message}`);
}

function mergeFields(target: any, source: any): void {
  for (const key in source) {
    const value = source[key];
    if (typeof value === "string") {
      target[key] = (target[key] || "") + value;
    } else if (value !== null && typeof value === "object") {
      if (!target[key]) {
        target[key] = {};
      }
      mergeFields(target[key], value);
    }
  }
}

export function mergeChunk(finalResponse: any, delta: any): void {
  delete delta.role;
  mergeFields(finalResponse, delta);

  const toolCalls = delta.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const index = toolCalls[0].index;
    delete toolCalls[0].index;
    if (!finalResponse.tool_calls[index]) {
      finalResponse.tool_calls[index] = {};
    }
    mergeFields(finalResponse.tool_calls[index], toolCalls[0]);
  }
}

export function functionToJson(func: AgentFunction): any {
  return {
    type: "function",
    function: {
      name: func.name,
      description: func.description || "",
      parameters: func.parameters || {
        type: "object",
        properties: {},
        required: [],
      },
    },
  };
}