// MCP-safe logging - writes to stderr only (stdout is reserved for MCP protocol)
export const logger = {
  info: (...args: unknown[]): void => {
    console.error('[INFO]', new Date().toISOString(), ...args);
  },
  warn: (...args: unknown[]): void => {
    console.error('[WARN]', new Date().toISOString(), ...args);
  },
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },
  debug: (...args: unknown[]): void => {
    if (process.env.DEBUG) {
      console.error('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
};
