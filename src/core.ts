// core.ts  

import { debugPrint, mergeChunk, functionToJson } from "./util";
import {
  Agent,
  Response,
  Result,
  AgentFunction,
  ChatCompletionMessageToolCall,
  Function,
} from "./types";
import OpenAI from "openai";

const __CTX_VARS_NAME__ = "context_variables";

export class Swarm {
  client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client || new OpenAI();
  }

  async getChatCompletion(
    agent: Agent,
    history: any[],
    contextVariables: { [key: string]: any },
    modelOverride: string | null,
    stream: boolean,
    debug: boolean
  ): Promise<any> {
    contextVariables = { ...contextVariables };
    let instructions: string;
    if (typeof agent.instructions === "function") {
      instructions = agent.instructions(contextVariables);
    } else {
      instructions = agent.instructions;
    }
    const messages = [{ role: "system", content: instructions }, ...history];
    debugPrint(debug, "Getting chat completion for...:", JSON.stringify(messages));

    const tools = agent.functions.map(functionToJson);

    // Hide context_variables from model
    for (let tool of tools) {
      const params = tool.function.parameters;
      if (params && params.properties) {
        delete params.properties[__CTX_VARS_NAME__];
      }
      if (params && params.required) {
        tool.function.parameters.required = params.required.filter(
          (r: string) => r !== __CTX_VARS_NAME__
        );
      }
    }

    const createParams: any = {
      model: modelOverride || agent.model,
      messages: messages,
      tools: tools.length ? tools : undefined,
      tool_choice: agent.tool_choice,
      stream: stream,
    };

    if (tools.length) {
      createParams.parallel_tool_calls = agent.parallel_tool_calls;
    }

    return await this.client.chat.completions.create(createParams);
  }

  handleFunctionResult(result: any, debug: boolean): Result {
    if (result instanceof Result) {
      return result;
    } else if (result instanceof Agent) {
      return new Result({
        value: JSON.stringify({ assistant: result.name }),
        agent: result,
      });
    } else {
      try {
        return new Result({ value: String(result) });
      } catch (e) {
        const errorMessage = `Failed to cast response to string: ${result}. Make sure agent functions return a string or Result object. Error: ${e}`;
        debugPrint(debug, errorMessage);
        throw new TypeError(errorMessage);
      }
    }
  }

  handleToolCalls(
    toolCalls: ChatCompletionMessageToolCall[],
    functions: AgentFunction[],
    contextVariables: { [key: string]: any },
    debug: boolean
  ): Response {
    const functionMap: { [key: string]: AgentFunction } = {};
    for (let f of functions) {
      functionMap[f.name] = f;
    }
    const partialResponse = new Response({ messages: [], context_variables: {} });

    for (let toolCall of toolCalls) {
      const name = toolCall.function.name;
      // Handle missing tool case, skip to next tool
      if (!functionMap[name]) {
        debugPrint(debug, `Tool ${name} not found in function map.`);
        partialResponse.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          tool_name: name,
          content: `Error: Tool ${name} not found.`,
        });
        continue;
      }
      let args: { [key: string]: any } = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        debugPrint(debug, `Failed to parse arguments for tool ${name}:`, e);
        partialResponse.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          tool_name: name,
          content: `Error: Invalid arguments for tool ${name}.`,
        });
        continue;
      }
      debugPrint(debug, `Processing tool call: ${name} with arguments`, JSON.stringify(args));

      const func = functionMap[name];
      // Pass context_variables to agent functions if required
      if (func.parameters && __CTX_VARS_NAME__ in func.parameters) {
        args[__CTX_VARS_NAME__] = contextVariables;
      }
      let rawResult: string | Agent | object;
      try {
        rawResult = func(args);
      } catch (e) {
        debugPrint(debug, `Error executing function ${name}:`, e);
        partialResponse.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          tool_name: name,
          content: `Error: Function ${name} execution failed.`,
        });
        continue;
      }

      const result = this.handleFunctionResult(rawResult, debug);
      partialResponse.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        tool_name: name,
        content: result.value,
      });
      Object.assign(partialResponse.context_variables, result.context_variables);
      if (result.agent) {
        partialResponse.agent = result.agent;
      }
    }

    return partialResponse;
  }

  async *runAndStream(
    agent: Agent,
    messages: any[],
    contextVariables: { [key: string]: any } = {},
    modelOverride: string | null = null,
    debug: boolean = false,
    maxTurns: number = Infinity,
    executeTools: boolean = true
  ): AsyncGenerator<any, void, unknown> {
    let activeAgent = agent;
    contextVariables = { ...contextVariables };
    let history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns) {
      let message: any = {
        content: "",
        sender: agent.name,
        role: "assistant",
        function_call: null,
        tool_calls: {},
      };

      // Get completion with current history, agent
      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        contextVariables,
        modelOverride,
        true,
        debug
      );

      yield { delim: "start" };
      for await (const chunk of completion) {
        const delta = JSON.parse(JSON.stringify(chunk.choices[0].delta));
        if (delta.role === "assistant") {
          delta.sender = activeAgent.name;
        }
        yield delta;
        delete delta.role;
        delete delta.sender;
        mergeChunk(message, delta);
      }
      yield { delim: "end" };

      message.tool_calls = Object.values(message.tool_calls || {});
      if (!message.tool_calls.length) {
        message.tool_calls = null;
      }
      debugPrint(debug, "Received completion:", JSON.stringify(message));
      history.push(message);

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      // Convert tool_calls to objects
      const toolCalls: ChatCompletionMessageToolCall[] = message.tool_calls.map((tool_call: any) => {
        const func = new Function({
          arguments: tool_call.function.arguments,
          name: tool_call.function.name,
        });
        return new ChatCompletionMessageToolCall({
          id: tool_call.id,
          function: func,
          type: tool_call.type,
        });
      });

      // Handle function calls, updating context_variables, and switching agents
      const partialResponse = this.handleToolCalls(
        toolCalls,
        activeAgent.functions,
        contextVariables,
        debug
      );
      history.push(...partialResponse.messages);
      Object.assign(contextVariables, partialResponse.context_variables);
      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }
    yield {
      response: new Response({
        messages: history.slice(initLen),
        agent: activeAgent,
        context_variables: contextVariables,
      }),
    };
  }

  async run(
    agent: Agent,
    messages: any[],
    contextVariables: { [key: string]: any } = {},
    modelOverride: string | null = null,
    stream: boolean = false,
    debug: boolean = false,
    maxTurns: number = Infinity,
    executeTools: boolean = true
  ): Promise<Response> {
    if (stream) {
      const generator = this.runAndStream(
        agent,
        messages,
        contextVariables,
        modelOverride,
        debug,
        maxTurns,
        executeTools
      );
      let lastResponse: Response | undefined;
      for await (const chunk of generator) {
        if (chunk.response) {
          lastResponse = chunk.response;
        }
      }
      if (!lastResponse) {
        throw new Error("No response generated from stream");
      }
      return lastResponse;
    }

    let activeAgent = agent;
    contextVariables = { ...contextVariables };
    let history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns && activeAgent) {
      // Get completion with current history, agent
      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        contextVariables,
        modelOverride,
        stream,
        debug
      );
      const message = completion.choices[0].message;
      debugPrint(debug, "Received completion:", message);
      message.sender = activeAgent.name;
      history.push(JSON.parse(JSON.stringify(message))); // To avoid OpenAI types (?)

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      // Handle function calls, updating context_variables, and switching agents
      const partialResponse = this.handleToolCalls(
        message.tool_calls,
        activeAgent.functions,
        contextVariables,
        debug
      );
      history.push(...partialResponse.messages);
      Object.assign(contextVariables, partialResponse.context_variables);
      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }
    return new Response({
      messages: history.slice(initLen),
      agent: activeAgent,
      context_variables: contextVariables,
    });
  }
}