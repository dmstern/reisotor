import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkFeedbackRateLimit,
  resetFeedbackRateLimits,
} from '../../src/utils/feedbackRateLimiter.js';

describe('feedbackRateLimiter', () => {
  beforeEach(() => {
    resetFeedbackRateLimits();
  });

  it('allows requests within limit and blocks subsequent requests', () => {
    const ip = '192.168.1.100';
    const limit = 3;
    const windowMs = 60 * 1000;

    expect(checkFeedbackRateLimit(ip, limit, windowMs).allowed).toBe(true);
    expect(checkFeedbackRateLimit(ip, limit, windowMs).allowed).toBe(true);
    expect(checkFeedbackRateLimit(ip, limit, windowMs).allowed).toBe(true);

    const fourth = checkFeedbackRateLimit(ip, limit, windowMs);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('tracks different IPs separately', () => {
    const limit = 1;
    const windowMs = 60 * 1000;

    expect(checkFeedbackRateLimit('1.1.1.1', limit, windowMs).allowed).toBe(true);
    expect(checkFeedbackRateLimit('1.1.1.1', limit, windowMs).allowed).toBe(false);

    expect(checkFeedbackRateLimit('2.2.2.2', limit, windowMs).allowed).toBe(true);
  });
});
