import { Swarm } from "../core";
import { Agent, Response, AgentFunction } from "../types";

/**
 * Runs an interactive demo loop for the Swarm CLI.
 * @param agent - The starting agent for the conversation.
 * @param contextVariables - Optional context variables for the conversation.
 * @param stream - Whether to use streaming mode for responses.
 * @param debug - Whether to enable debug mode.
 */
export async function runDemoLoop(
  agent: Agent,
  contextVariables: Record<string, any> = {},
  stream: boolean = false,
  debug: boolean = false,
): Promise<void> {
  const swarm = new Swarm();
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
      for await (const chunk of response as AsyncIterable<any>) {
        if (chunk.content) {
          process.stdout.write(
            `${chunk.sender || "Assistant"}: ${chunk.content}\n`,
          );
        }
        if (chunk.function) {
          console.log(
            `${chunk.sender || "Assistant"}: ${chunk.function.name}()`,
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
          msg.tool_calls?.forEach((toolCall) => {
            console.log(
              `${msg.sender || "Assistant"}: ${toolCall.function.name}()`,
            );
          });
        }
      });
      agent = completionResponse.agent || agent;
      Object.assign(contextVariables, completionResponse.context_variables);
    }
    console.log(); // New line for readability
  };

  process.stdin.on("data", async (data: string) => {
    const userInput = data.trim();

    if (userInput.toLowerCase() === "exit") {
      console.log("Exiting Swarm CLI Demo. Goodbye!");
      process.exit(0);
    }

    messages.push({ role: "user", content: userInput });
    console.log(`User: ${userInput}`);

    try {
      const response = await swarm.run({
        agent,
        messages,
        context_variables: contextVariables,
        stream,
        debug,
      });

      await processResponse(response);
    } catch (error) {
      console.error("Error:", error);
    }

    process.stdout.write("User: ");
  });

  process.stdout.write("User: ");
}
