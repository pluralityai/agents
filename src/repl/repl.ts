import { Swarm } from "../core";
import { Agent, Response } from "../types";

/**
 * Runs an interactive demo loop for the Plurality Agents CLI.
 * @param agent - The starting agent for the conversation.
 * @param contextVariables - Optional context variables for the conversation.
 * @param stream - Whether to use streaming mode for responses.
 * @param debug - Whether to enable debug mode.
 * @param apiKey - Optional OpenAI API key.
 */
export async function runCLI(
  agent: Agent,
  availableAgents: Agent[],
  contextVariables: Record<string, any> = {},
  stream: boolean = false,
  debug: boolean = false,
  apiKey?: string
): Promise<void> {
  let swarm: Swarm;

  const initializeSwarm = async (): Promise<void> => {
    try {
      swarm = new Swarm(apiKey);
    } catch (error: unknown) {
      console.error(
        "Failed to initialize Swarm with provided API key:",
        error instanceof Error ? error.message : String(error)
      );
      if (!apiKey) {
        console.log("Please enter your OpenAI API key:");

        apiKey = await new Promise<string>((resolve) => {
          process.stdin.once("data", (data) => {
            resolve(data.toString().trim());
          });
        });

        try {
          swarm = new Swarm(apiKey);
        } catch (error: unknown) {
          console.error(
            "Failed to initialize Swarm with provided API key:",
            error instanceof Error ? error.message : String(error)
          );
          process.exit(1);
        }
      } else {
        console.error("Invalid API key provided.");
        process.exit(1);
      }
    }
  };

  await initializeSwarm();

  const messages: any[] = [];

  console.log(`
    ____  _                  _ _ _         
   |  _ \\| |_   _ _ __ __ _ | (_) |_ _   _ 
   | |_) | | | | | '__/ _\` || | | __| | | |
   |  __/| | |_| | | | (_| || | | |_| |_| |
   |_|   |_|\\__,_|_|  \\__,_|/ |_|\\__|\\__, |
                          |__/        |___/ 
      _                    _         ____ _     ___ 
     / \\   __ _  ___ _ __ | |_ ___  / ___| |   |_ _|
    / _ \\ / _\` |/ _ \\ '_ \\| __/ __|| |   | |    | | 
   / ___ \\ (_| |  __/ | | | |_\\__ \\| |___| |___ | | 
   /_/   \\_\\__, |\\___|_| |_|\\__|___/\\____|_____|___|
           |___/                                    
   
   Starting Plurality Agents CLI Demo 🤖
   `);
  console.log('Type your messages and press Enter. Type "exit" to quit.');

  process.stdin.setEncoding("utf8");

  const processResponse = async (response: Response | AsyncIterable<any>) => {
    if (stream && Symbol.asyncIterator in Object(response)) {
      let fullMessage = "";
      let currentLine = "";

      for await (const chunk of response as AsyncIterable<any>) {
        if (chunk.content) {
          currentLine += chunk.content;
          fullMessage += chunk.content;

          process.stdout.write("\r" + " ".repeat(process.stdout.columns));
          process.stdout.write("\r" + currentLine);

          if (chunk.content.endsWith("\n")) {
            console.log();
            currentLine = "";
          }
        }
        if (chunk.function) {
          console.log(
            `\n${chunk.sender || "Assistant"}: ${chunk.function.name}()`
          );
        }
        if (chunk.response) {
          agent = chunk.response.agent || agent;
          Object.assign(contextVariables, chunk.response.context_variables);
        }
      }
    } else {
      const completionResponse = response as Response;
      completionResponse.messages.forEach((msg) => {
        if (msg.role === "assistant") {
          console.log(`${msg.sender || "Assistant"}: ${msg.content}`);
          //TODO: fix typing
          msg.tool_calls?.forEach((toolCall: any) => {
            console.log(
              `${msg.sender || "Assistant"}: ${toolCall.function.name}()`
            );
          });
        }
      });
      agent = completionResponse.agent || agent;
      Object.assign(contextVariables, completionResponse.context_variables);
    }
    console.log();
  };

  const handleUserInput = async (data: string) => {
    const userInput = data.trim();

    if (userInput.toLowerCase() === "exit") {
      console.log("Exiting Swarm CLI Demo. Goodbye!");
      process.exit(0);
    }

    messages.push({ role: "user", content: userInput });

    try {
      const response = await swarm.run({
        agent,
        messages,
        context_variables: contextVariables,
        stream,
        debug,
        availableAgents,
      });

      await processResponse(response);
    } catch (error) {
      console.error("Error:", error);
    }

    process.stdout.write("User: ");
  };

  process.stdin.on("data", handleUserInput);

  process.stdout.write("User: ");
}
