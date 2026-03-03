/**
 * Tests for CLI command structure and parsing.
 */

import { describe, it, expect } from 'vitest';
import { allServices } from '../services/index.js';

describe('CLI Command Structure', () => {
  it('every service name should be valid as a CLI command (kebab-case)', () => {
    for (const svc of allServices) {
      expect(svc.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every tool should produce a valid CLI sub-command name', () => {
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        // Tool names are snake_case; CLI converts to kebab-case
        const prefix = svc.name.replace(/-/g, '_') + '_';
        const name = tool.name.startsWith(prefix)
          ? tool.name.slice(prefix.length)
          : tool.name;
        const cliName = name.replace(/_/g, '-');
        expect(cliName).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    }
  });

  it('required params should have required=true in definitions', () => {
    // Spot-check known required params
    const military = allServices.find((s) => s.name === 'military')!;
    const theaterPosture = military.tools.find(
      (t) => t.name === 'get_theater_posture',
    )!;
    expect(theaterPosture.params!.theater.required).toBe(true);

    const intelligence = allServices.find(
      (s) => s.name === 'intelligence',
    )!;
    const classifyEvent = intelligence.tools.find(
      (t) => t.name === 'classify_event',
    )!;
    expect(classifyEvent.params!.title.required).toBe(true);

    const seismology = allServices.find((s) => s.name === 'seismology')!;
    const earthquakes = seismology.tools.find(
      (t) => t.name === 'list_earthquakes',
    )!;
    // min_magnitude is optional (has a default)
    expect(earthquakes.params!.min_magnitude.required).toBeFalsy();
  });

  it('should have correct HTTP methods for POST endpoints', () => {
    const postTools = allServices
      .flatMap((s) => s.tools)
      .filter((t) => t.method === 'POST');

    expect(postTools.length).toBeGreaterThan(0);

    // Known POST endpoints
    const postNames = postTools.map((t) => t.name);
    expect(postNames).toContain('summarize_article');
    expect(postNames).toContain('deduct_situation');
    expect(postNames).toContain('get_aircraft_details_batch');
    expect(postNames).toContain('record_baseline_snapshot');
  });
});

describe('CLI Parameter Types', () => {
  it('bounding box params should all be numbers', () => {
    const bboxParams = ['ne_lat', 'ne_lon', 'sw_lat', 'sw_lon'];
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        if (!tool.params) continue;
        for (const bp of bboxParams) {
          if (tool.params[bp]) {
            expect(tool.params[bp].type).toBe('number');
          }
        }
      }
    }
  });

  it('page_size params should be numbers', () => {
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        if (tool.params?.page_size) {
          expect(tool.params.page_size.type).toBe('number');
        }
      }
    }
  });

  it('cursor params should be strings', () => {
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        if (tool.params?.cursor) {
          expect(tool.params.cursor.type).toBe('string');
        }
      }
    }
  });

  it('timestamp params (start/end) should be numbers', () => {
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        if (tool.params?.start) {
          expect(tool.params.start.type).toBe('number');
        }
        if (tool.params?.end) {
          expect(tool.params.end.type).toBe('number');
        }
      }
    }
  });
});
