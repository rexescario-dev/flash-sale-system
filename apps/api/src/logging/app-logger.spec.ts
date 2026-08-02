import { Logger } from '@nestjs/common';

import { AppLogger } from './app-logger';
import { LogEvent } from './log-event';

describe('AppLogger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let appLogger: AppLogger;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    appLogger = new AppLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info emits { event, ...fields } without mutating fields', () => {
    const fields = { flashSaleId: 'sale-1', userId: 'user-1' };
    const snapshot = { ...fields };

    appLogger.info(LogEvent.PURCHASE_COMPLETED, fields);

    expect(fields).toEqual(snapshot);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toEqual({
      flashSaleId: 'sale-1',
      userId: 'user-1',
      event: LogEvent.PURCHASE_COMPLETED,
    });
  });

  it('warn / debug emit structured payloads', () => {
    appLogger.warn(LogEvent.PURCHASE_RATE_LIMITED, { userId: 'u1' });
    appLogger.debug(LogEvent.PURCHASE_ATTEMPTED, { userId: 'u1' });

    expect(warnSpy.mock.calls[0][0]).toEqual({
      userId: 'u1',
      event: LogEvent.PURCHASE_RATE_LIMITED,
    });
    expect(debugSpy.mock.calls[0][0]).toEqual({
      userId: 'u1',
      event: LogEvent.PURCHASE_ATTEMPTED,
    });
  });

  it('error merges error: string and never includes stack in payload', () => {
    const err = new Error('boom');
    appLogger.error(LogEvent.PURCHASE_FAILED, { userId: 'u1' }, err);

    const payload = errorSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({
      userId: 'u1',
      error: 'boom',
      event: LogEvent.PURCHASE_FAILED,
    });
    expect(payload).not.toHaveProperty('stack');
    expect(JSON.stringify(payload)).not.toContain(err.stack ?? 'no-stack');
  });

  it('error stringifies non-Error values', () => {
    appLogger.error(LogEvent.GRAPHQL_REQUEST_FAILED, {}, 'nope');
    expect(errorSpy.mock.calls[0][0]).toEqual({
      error: 'nope',
      event: LogEvent.GRAPHQL_REQUEST_FAILED,
    });
  });

  it('info works with omitted fields', () => {
    appLogger.info(LogEvent.GRAPHQL_REQUEST_COMPLETED);
    expect(logSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.GRAPHQL_REQUEST_COMPLETED,
    });
  });

  it('info keeps contract event when fields include an event key', () => {
    appLogger.info(LogEvent.PURCHASE_COMPLETED, {
      userId: 'u1',
      event: 'spoofed.event',
    });

    expect(logSpy.mock.calls[0][0]).toEqual({
      userId: 'u1',
      event: LogEvent.PURCHASE_COMPLETED,
    });
  });
});
