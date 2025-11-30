/**
 * Structured logger for Lambda functions
 * Outputs JSON formatted logs for CloudWatch
 */

export interface LogContext {
  correlationId?: string;
  tableName?: string;
  eventType?: string;
  recordId?: string;
  [key: string]: unknown;
}

class Logger {
  private context: LogContext = {};

  /**
   * Set context that will be included in all log messages
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear the current context
   */
  clearContext(): void {
    this.context = {};
  }

  private formatMessage(level: string, message: string, data?: Record<string, unknown>): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
    };
    return JSON.stringify(logEntry);
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const errorData = error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          ...data,
        }
      : data;
    console.error(this.formatMessage('ERROR', message, errorData));
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

