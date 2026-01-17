#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) server entry point.
 * Provides tools for AI assistants to query and understand TypeScript codebases.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from './schemas.js';
import { handleListResources, handleReadResource } from './resources.js';
import { handleToolCall } from './handlers/index.js';

const server = new Server(
  {
    name: 'mcp-repo-intelligence',
    version: '1.3.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_SCHEMAS
  };
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, handleListResources);

// Read a specific resource
server.setRequestHandler(ReadResourceRequestSchema, handleReadResource);

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    return await handleToolCall(name, args);
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
