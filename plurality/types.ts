// types.ts
export type AgentFunction = {
    (args: any): string | Agent | object;
    name: string;
    description?: string;
    parameters?: { [key: string]: any };
    required?: string[];
  };
  
  export class Agent {
    name: string;
    model: string;
    instructions: string | ((contextVariables: { [key: string]: any }) => string);
    functions: AgentFunction[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    parallel_tool_calls: boolean;
  
    constructor(init?: Partial<Agent>) {
      this.name = init?.name ?? "Agent";
      this.model = init?.model ?? "gpt-4";
      this.instructions = init?.instructions ?? "You are a helpful agent.";
      this.functions = init?.functions ?? [];
      this.tool_choice = init?.tool_choice;
      this.parallel_tool_calls = init?.parallel_tool_calls ?? true;
    }
  }
  
  export class Response {
    messages: any[];
    agent?: Agent;
    context_variables: { [key: string]: any };
  
    constructor(init?: Partial<Response>) {
      this.messages = init?.messages ?? [];
      this.agent = init?.agent;
      this.context_variables = init?.context_variables ?? {};
    }
  }
  
  export class Result {
    value: string;
    agent?: Agent;
    context_variables: { [key: string]: any };
  
    constructor(init?: Partial<Result>) {
      this.value = init?.value ?? "";
      this.agent = init?.agent;
      this.context_variables = init?.context_variables ?? {};
    }
  }
  
  export class Function {
    arguments: string;
    name: string;
  
    constructor(init?: Partial<Function>) {
      this.arguments = init?.arguments ?? "";
      this.name = init?.name ?? "";
    }
  }
  
  export class ChatCompletionMessageToolCall {
    id: string;
    function: Function;
    type: string;
  
    constructor(init?: Partial<ChatCompletionMessageToolCall>) {
      this.id = init?.id ?? "";
      this.function = init?.function ?? new Function();
      this.type = init?.type ?? "";
    }
  }
  
  export class ChatCompletionMessage {
    role: string;
    content: string;
    function_call?: any;
    tool_calls?: ChatCompletionMessageToolCall[];
    sender?: string;
  
    constructor(init?: Partial<ChatCompletionMessage>) {
      this.role = init?.role ?? "";
      this.content = init?.content ?? "";
      this.function_call = init?.function_call;
      this.tool_calls = init?.tool_calls;
      this.sender = init?.sender;
    }
  
    toJSON() {
      return {
        role: this.role,
        content: this.content,
        function_call: this.function_call,
        tool_calls: this.tool_calls,
        sender: this.sender,
      };
    }
  }