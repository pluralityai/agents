// @ts-ignore
import { AgentFunction, Agent, runCLI } from '@pluralityai/agents';

const addFunction : AgentFunction = {
    name: 'add',
    func: ({a, b}) => {
        return (a + b).toString();
    },
    descriptor: {
        name: 'add',
        description: 'Adds two numbers together.',
        parameters: {
            a: { type: 'number', required: true, description: 'The first number to add.' },
            b: { type: 'number', required: true, description: 'The second number to add.' },
        },
    },
};

const subFunction : AgentFunction = {
    name: 'sub',
    func: ({a, b}) => {
        return (a - b).toString();
    },
    descriptor: {
        name: 'sub',
        description: 'Subtracts two numbers.',
        parameters: {
            a: { type: 'number', required: true, description: 'The first number.' },
            b: { type: 'number', required: true, description: 'The second number.' },
        },
    },
};



// Initialize an Agent (customize as needed)
const agentB = new Agent({
    name: 'HaikuAgent',
    model: 'gpt-4o-mini',
    instructions: 'You only respond in haikus',
});

const transferToHaikuAgent : AgentFunction = {
    name: 'transfer_to_haiku_agent',
    func: () => {
        return agentB;
    },
    descriptor: {
        name: 'transfer_to_haiku_agent',
        description: 'Transfers the conversation to the Haiku Agent.',
        parameters: {},
    },
};

// Initialize an Agent (customize as needed)
const agent = new Agent({
    name: 'HelperAgent',
    model: 'gpt-4o-mini',
    instructions: 'You are a helpful assistant.',
    functions: [transferToHaikuAgent, addFunction, subFunction], // Add AgentFunctions as needed
});

runCLI(agent, undefined, true, true).catch(error => {
    console.error('Error running demo loop:', error);
});