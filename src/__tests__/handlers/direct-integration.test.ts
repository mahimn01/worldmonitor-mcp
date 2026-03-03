/**
 * Integration tests for direct handler registry.
 * Verifies that every direct-handler tool has a matching handler function,
 * and that the handler registry is internally consistent.
 */

import { describe, it, expect } from 'vitest';
import { directHandlers } from '../../handlers/index.js';
import { allServices, allTools } from '../../services/index.js';

// Services that use direct handlers (not proxied through worldmonitor.app)
const DIRECT_SERVICES = [
  'sec-edgar',
  'treasury',
  'cftc',
  'congress',
  'economic-calendar',
  'weather-agriculture',
  'government',
  'onchain',
  'sentiment',
  'article',
];

describe('Direct Handler Registry', () => {
  it('should export a non-empty handler map', () => {
    expect(Object.keys(directHandlers).length).toBeGreaterThan(0);
  });

  it('should have exactly 30 handlers registered', () => {
    expect(Object.keys(directHandlers).length).toBe(30);
  });

  it('every handler should be a function', () => {
    for (const [name, handler] of Object.entries(directHandlers)) {
      expect(typeof handler).toBe('function');
    }
  });

  it('every direct-service tool should have a matching handler', () => {
    for (const svcName of DIRECT_SERVICES) {
      const svc = allServices.find((s) => s.name === svcName);
      expect(svc).toBeDefined();

      for (const tool of svc!.tools) {
        expect(directHandlers[tool.name]).toBeDefined();
        expect(typeof directHandlers[tool.name]).toBe('function');
      }
    }
  });

  it('every handler key should correspond to a registered tool', () => {
    const toolNames = new Set(allTools().map((t) => t.name));
    for (const handlerName of Object.keys(directHandlers)) {
      expect(toolNames.has(handlerName)).toBe(true);
    }
  });

  it('no proxy-service tool should appear in directHandlers', () => {
    const directServiceSet = new Set(DIRECT_SERVICES);
    for (const svc of allServices) {
      if (directServiceSet.has(svc.name)) continue;
      for (const tool of svc.tools) {
        expect(directHandlers[tool.name]).toBeUndefined();
      }
    }
  });
});

describe('Direct Handler Tool Definitions', () => {
  for (const svcName of DIRECT_SERVICES) {
    describe(`${svcName} service`, () => {
      it('should have a basePath starting with /api/', () => {
        const svc = allServices.find((s) => s.name === svcName)!;
        expect(svc.basePath).toMatch(/^\/api\//);
      });

      it('every tool should have snake_case name', () => {
        const svc = allServices.find((s) => s.name === svcName)!;
        for (const tool of svc.tools) {
          expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
        }
      });

      it('every tool should have an endpoint starting with /', () => {
        const svc = allServices.find((s) => s.name === svcName)!;
        for (const tool of svc.tools) {
          expect(tool.endpoint).toMatch(/^\//);
        }
      });
    });
  }
});
