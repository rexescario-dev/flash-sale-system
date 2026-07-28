import { Injectable } from '@nestjs/common';

export const CLOCK = Symbol('CLOCK');

export interface Clock {
  nowUtc(): Date;
}

@Injectable()
export class SystemClock implements Clock {
  nowUtc(): Date {
    return new Date();
  }
}
