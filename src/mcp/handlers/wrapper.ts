
import logger from '../../logger.js';

type HandlerFunction = (args: any) => Promise<any>;

/**
 * Wraps an MCP handler function with error handling and logging.
 * @param handlerName The name of the handler (for logging)
 * @param handler The handler function
 * @returns A wrapped handler function
 */
export function createHandler(handlerName: string, handler: HandlerFunction): HandlerFunction {
    return async (args: any) => {
        const log = logger.child({ handler: handlerName });

        try {
            log.info({ args }, 'Handling tool call');
            const result = await handler(args);
            log.debug('Tool call successful');
            return result;
        } catch (error: any) {
            log.error({ err: error }, 'Error in tool handler');

            // Return a clean error message to the MCP client
            // We don't want to crash the server, just return an error response
            // The MCP SDK handles throwing errors by returning an error result, 
            // but if we catch it here we can format it better or ensure it doesn't crash the process.
            // However, usually rethrowing allows the server to format the error response.
            // But the user request said "risk: parsing errors could crash the MCP server"
            // So we should probably ensure it's returned as a user-friendly error string if the SDK expects usage of exceptions.
            // Looking at server.ts:50-56:
            /*
              try {
                  return await handleToolCall(name, args);
              } catch (error: any) {
                  return {
                  content: [{ type: 'text', text: `Error: ${error.message}` }],
                  isError: true,
                  };
              }
            */
            // So re-throwing is actually handled by the server.ts try-catch block.
            // BUT, adding logging here provides visibility which was missing.
            // And we can ensure the error message is useful.

            throw new Error(`Handler '${handlerName}' failed: ${error.message}`);
        }
    };
}
