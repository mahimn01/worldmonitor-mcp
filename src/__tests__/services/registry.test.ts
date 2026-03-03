/**
 * Tests for the service registry — validates that every service and tool
 * is defined correctly, has no naming collisions, and follows conventions.
 */

import { describe, it, expect } from 'vitest';
import {
  allServices,
  allTools,
  protoServices,
  legacyServices,
  findTool,
} from '../../services/index.js';

describe('Service Registry', () => {
  it('should have all 22 services registered', () => {
    // 21 proto + 1 legacy
    expect(allServices.length).toBe(22);
    expect(protoServices.length).toBe(21);
    expect(legacyServices.length).toBe(1);
  });

  it('should have at least 70 tools total', () => {
    const tools = allTools();
    expect(tools.length).toBeGreaterThanOrEqual(70);
  });

  it('should have unique tool names across all services', () => {
    const tools = allTools();
    const names = tools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have unique service names', () => {
    const names = allServices.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('every service should have a basePath starting with /api', () => {
    for (const svc of allServices) {
      expect(svc.basePath).toMatch(/^\/api/);
    }
  });

  it('every service should have a non-empty description', () => {
    for (const svc of allServices) {
      expect(svc.description.length).toBeGreaterThan(10);
    }
  });

  it('every service should have at least one tool', () => {
    for (const svc of allServices) {
      expect(svc.tools.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every tool should have a snake_case name', () => {
    const tools = allTools();
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('every tool should have a non-empty description', () => {
    const tools = allTools();
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('every tool endpoint should start with /', () => {
    const tools = allTools();
    for (const tool of tools) {
      expect(tool.endpoint).toMatch(/^\//);
    }
  });

  it('every tool method should be GET or POST', () => {
    const tools = allTools();
    for (const tool of tools) {
      if (tool.method) {
        expect(['GET', 'POST']).toContain(tool.method);
      }
    }
  });

  it('every tool param should have a valid type', () => {
    const validTypes = ['string', 'number', 'boolean', 'string[]'];
    const tools = allTools();
    for (const tool of tools) {
      if (tool.params) {
        for (const [name, def] of Object.entries(tool.params)) {
          expect(validTypes).toContain(def.type);
          expect(def.description.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('findTool should return the correct tool', () => {
    const tool = findTool('list_earthquakes');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('list_earthquakes');
    expect(tool!.service).toBe('seismology');
    expect(tool!.fullEndpoint).toBe(
      '/api/seismology/v1/list-earthquakes',
    );
  });

  it('findTool should return undefined for unknown tools', () => {
    expect(findTool('nonexistent_tool')).toBeUndefined();
  });
});

describe('Proto Services', () => {
  const expectedServices = [
    'military',
    'market',
    'news',
    'economic',
    'intelligence',
    'infrastructure',
    'conflict',
    'aviation',
    'maritime',
    'cyber',
    'climate',
    'seismology',
    'wildfire',
    'trade',
    'supply-chain',
    'displacement',
    'prediction',
    'research',
    'unrest',
    'giving',
    'positive-events',
  ];

  for (const name of expectedServices) {
    it(`should include the "${name}" service`, () => {
      const svc = protoServices.find((s) => s.name === name);
      expect(svc).toBeDefined();
      expect(svc!.basePath).toMatch(new RegExp(`^/api/`));
    });
  }
});

describe('Service Tool Counts', () => {
  const expectedMinTools: Record<string, number> = {
    military: 7,
    market: 8,
    news: 3,
    economic: 8,
    intelligence: 6,
    infrastructure: 5,
    conflict: 4,
    aviation: 1,
    maritime: 2,
    cyber: 1,
    climate: 1,
    seismology: 1,
    wildfire: 1,
    trade: 4,
    'supply-chain': 3,
    displacement: 2,
    prediction: 1,
    research: 4,
    unrest: 1,
    giving: 1,
    'positive-events': 1,
    legacy: 12,
  };

  for (const [name, minCount] of Object.entries(expectedMinTools)) {
    it(`"${name}" should have at least ${minCount} tools`, () => {
      const svc = allServices.find((s) => s.name === name);
      expect(svc).toBeDefined();
      expect(svc!.tools.length).toBeGreaterThanOrEqual(minCount);
    });
  }
});
