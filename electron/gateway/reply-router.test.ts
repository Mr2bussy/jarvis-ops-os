// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { isLightInboundMessage } from './reply-router';

describe('reply-router', () => {
  it('treats greetings as light', () => {
    expect(isLightInboundMessage('ping')).toBe(true);
    expect(isLightInboundMessage('Hello JARVIS')).toBe(true);
  });

  it('routes complex tasks to full harness', () => {
    expect(isLightInboundMessage('refactor the harness service.ts file')).toBe(false);
    expect(isLightInboundMessage('run parallel swarm audit on mt5 bridge')).toBe(false);
  });
});
