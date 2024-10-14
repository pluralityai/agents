# Plurality

Plurality is a lightweight, ergonomic TypeScript library for multi-agent orchestration.

## Installation

Install Plurality using npm:

```bash
npm install plurality
```

## Usage

Here are two examples demonstrating how to use Plurality in a Next.js application using the App Router:

### Example 1: Weather API Route

This example shows how to create a simple weather API route using Plurality in a Next.js app:

```typescript
// app/api/weather/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Swarm, Agent, AgentFunction, Response } from "plurality";

// Initialize OpenAI client and Swarm
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const swarm = new Swarm(openai);

// Define the getWeather function
const getWeatherFunction: AgentFunction = Object.assign(
  function getWeather(args: { location: string }): string {
    // In a real app, you would call a weather API here
    return JSON.stringify({ temp: 67, unit: "F" });
  },
  {
    description: "Gets the weather for a given location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The location to get the weather for",
        },
      },
      required: ["location"],
    },
  }
);

// Create a Weather Agent
const weatherAgent = new Agent({
  name: "WeatherAgent",
  model: "gpt-4o",
  instructions: "You are a helpful weather agent.",
  functions: [getWeatherFunction],
  parallel_tool_calls: false,
});

export async function POST(request: NextRequest) {
  const { query } = await request.json();
  const messages = [{ role: "user", content: query }];

  try {
    const response: Response = await swarm.run(weatherAgent, messages);
    const result = response.messages[response.messages.length - 1].content;
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
```

### Example 2: Multi-language Chat API Route

This example demonstrates how to create a multi-language chat API route using Plurality in a Next.js app:

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Swarm, Agent, AgentFunction, Response } from "plurality";

// Initialize OpenAI client and Swarm
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const swarm = new Swarm(openai);

const englishAgent = new Agent({
  name: "English Agent",
  instructions:
    "You only speak English. If a user speaks Spanish, use the transfer_to_spanish_agent function.",
  model: "gpt-4o",
});

const spanishAgent = new Agent({
  name: "Spanish Agent",
  instructions: "Solo hablas español.",
  model: "gpt-4o",
});

const transferToSpanishAgent: AgentFunction = Object.assign(
  function transfer_to_spanish_agent(): Agent {
    console.log("Transferring to Spanish Agent");
    return spanishAgent;
  },
  {
    description: "Transfer Spanish speaking users to the Spanish Agent",
    parameters: { type: "object", properties: {} },
  }
);

englishAgent.functions.push(transferToSpanishAgent);

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  const messages = [{ role: "user", content: message }];

  try {
    const response: Response = await swarm.run(englishAgent, messages);
    const result = response.messages[response.messages.length - 1].content;
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.
