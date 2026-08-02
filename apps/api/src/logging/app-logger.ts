import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger {
  private readonly logger = new Logger(AppLogger.name);

  debug(event: string, fields?: Record<string, unknown>): void {
    this.logger.debug(this.payload(event, fields));
  }

  error(event: string, fields?: Record<string, unknown>, err?: unknown): void {
    const base = this.payload(event, fields);
    if (err === undefined) {
      this.logger.error(base);
      return;
    }
    // `error` last so caller fields cannot override the serialized error string.
    this.logger.error({
      ...base,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  info(event: string, fields?: Record<string, unknown>): void {
    this.logger.log(this.payload(event, fields));
  }

  warn(event: string, fields?: Record<string, unknown>): void {
    this.logger.warn(this.payload(event, fields));
  }

  private payload(event: string, fields?: Record<string, unknown>): Record<string, unknown> {
    // `event` last so caller fields cannot override the required contract field.
    return fields === undefined ? { event } : { ...fields, event };
  }
}
