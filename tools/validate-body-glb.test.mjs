/**
 * The body model the app ships, held to its contract — and the validator
 * held to its word.
 *
 * Two things are tested. The model: the file in public/models/ passes the
 * validator, and each check point of the regions (contract §14) is met, by
 * name, so a failure says where a region slipped. The validator: a file that
 * breaks one promise is refused for that promise — the notice of another
 * model, hands that belong to the forearms, a baked shade on only some
 * regions, the model of D156 as a whole.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBody, regionBorders } from './body/measure-body.mjs';
import { CHECK_POINTS, runCheckPoints } from './body/checkpoints.mjs';
import { MUSCLE_GROUPS } from '../src/core/model';
import { INERT_PRIMITIVE, INERT_TRIANGLES, MUSCLE_MESH_MAP } from '../src/features/body/muscleMeshMap';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(ROOT, 'tools', 'validate-body-glb.mjs');
const SHIPPED = join(ROOT, 'public', 'models', 'momentum-body.glb');
const MODEL_OF_D156 = join(ROOT, 'docs', 'design', 'muscle-map', 'momentum-muscle-map-handoff', 'momentum-body.glb');

let dir;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'validate-body-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const validate = (path) => {
  const run = spawnSync('node', [VALIDATOR, path], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout, problems: run.stderr };
};

/** A copy of the shipped file with its JSON changed. */
function changed(name, change) {
  const buffer = readFileSync(SHIPPED);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  change(json);
  const text = new TextEncoder().encode(JSON.stringify(json));
  const chunk = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  chunk.set(text);
  const rest = buffer.subarray(20 + jsonLength);
  const out = new Uint8Array(20 + chunk.length + rest.length);
  out.set(buffer.subarray(0, 20));
  out.set(chunk, 20);
  out.set(rest, 20 + chunk.length);
  const header = new DataView(out.buffer);
  header.setUint32(8, out.length, true);
  header.setUint32(12, chunk.length, true);
  const path = join(dir, `${name}.glb`);
  writeFileSync(path, out);
  return path;
}

describe('the body model the app ships', () => {
  it('passes the validator', () => {
    const { status, out, problems } = validate(SHIPPED);
    expect(problems).toBe('');
    expect(status).toBe(0);
    expect(out).toMatch(/contract satisfied/);
    expect(out).toMatch(/check points: (\d+) of \1/);
    expect(out).toMatch(/inert zone: five straight cuts/);
  });

  const results = runCheckPoints(readBody(SHIPPED));

  it('asks every check point, the paired ones on both sides', () => {
    const paired = CHECK_POINTS.filter((point) => !point.once).length;
    expect(results).toHaveLength(CHECK_POINTS.length + paired);
  });

  it.each(results.map((result) => [`${result.name}${result.side ? `, ${result.side}` : ''}`, result]))('%s', (_, result) => {
    expect(result.found, `expected ${result.expected.join(' or ')}`).not.toBeNull();
    expect(result.expected).toContain(result.found);
  });

  it('has a check point in each of the ten groups, and these are the app\'s ten', () => {
    const asked = new Set(CHECK_POINTS.flatMap((point) => (point.region.length === 1 ? point.region : [])));
    for (const group of MUSCLE_GROUPS) expect(asked, group).toContain(group);
    // The validator keeps its own copy of the list, to run without a build.
    const source = readFileSync(VALIDATOR, 'utf8');
    const own = source.match(/const MUSCLE_GROUPS = \[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((id) => id.slice(1, -1));
    expect(own.sort()).toEqual([...MUSCLE_GROUPS].sort());
  });

  it('is the file the table in muscleMeshMap.ts describes', () => {
    const body = readBody(SHIPPED);
    const count = (name) => body.labels.filter((label) => body.names[label] === name).length;
    for (const group of MUSCLE_GROUPS) {
      const row = MUSCLE_MESH_MAP[group];
      expect(body.names[row.primitive], group).toBe(group);
      expect(row.material).toBe(group);
      expect(row.triangles, group).toBe(count(group));
    }
    expect(body.names[INERT_PRIMITIVE]).toBe('none');
    expect(INERT_TRIANGLES).toBe(count('none'));
  });

  it('ends its inert zone in five straight cuts, the neck\'s nearly level', () => {
    const borders = regionBorders(readBody(SHIPPED), 'none');
    expect(borders).toHaveLength(5);
    for (const border of borders) expect(border.deviation).toBeLessThan(0.001);
    // The highest is the neck: within ten degrees of level.
    expect(Math.abs(borders[0].normal[1])).toBeGreaterThan(Math.cos((10 * Math.PI) / 180));
    // Then the two wrists and the two ankles, a left and a right of each.
    expect(borders.slice(1).map((border) => Math.sign(border.centre[0]))).toEqual([1, -1, 1, -1]);
  });
});

describe('the validator refuses', () => {
  it('the notice of another model', () => {
    const path = changed('notice', (json) => { json.asset.copyright = 'Body by somebody, CC-BY-4.0'; });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/asset\.copyright must name MakeHuman and CC0/);
    expect(problems).toMatch(/2 contract violation/);
  });

  it('a file without a notice', () => {
    const { status, problems } = validate(changed('no-notice', (json) => { delete json.asset.copyright; }));
    expect(status).toBe(1);
    expect(problems).toMatch(/1 contract violation/);
    expect(problems).toMatch(/must name MakeHuman and CC0/);
  });

  it('hands that belong to the forearms', () => {
    // The inert zone and the forearms change names: the hands are a muscle now.
    const path = changed('hands', (json) => {
      const none = json.materials.find((m) => m.name === 'none');
      const forearms = json.materials.find((m) => m.name === 'forearms');
      none.name = 'forearms';
      forearms.name = 'none';
    });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/check point "the hand is inert" \(left\): the ray meets forearms, not none/);
    expect(problems).toMatch(/check point "forearms" \(right\): the ray meets none, not forearms/);
    expect(problems).toMatch(/check point "the face is inert": the ray meets forearms/);
  });

  it('a baked shade on only some of the regions', () => {
    const path = changed('shade', (json) => { delete json.meshes[0].primitives[3].attributes.COLOR_0; });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/baked shade must be on all or on none/);
  });

  it('a region that is missing', () => {
    const path = changed('missing', (json) => { json.materials.find((m) => m.name === 'calves').name = 'shins'; });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/MISSING muscle region "calves"/);
    expect(problems).toMatch(/unknown region "shins"/);
  });

  it('a primitive without its triangles, and says so instead of stopping on an error of its own', () => {
    const path = changed('unindexed', (json) => { delete json.meshes[0].primitives[2].indices; });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/a primitive is not indexed/);
    expect(problems).toMatch(/not read further/);
    expect(problems).not.toMatch(/TypeError/);
  });

  it('a primitive without a material, the same way', () => {
    const path = changed('no-material', (json) => { delete json.meshes[0].primitives[5].material; });
    const { status, problems } = validate(path);
    expect(status).toBe(1);
    expect(problems).toMatch(/a primitive has no material/);
    expect(problems).not.toMatch(/TypeError/);
  });

  it('the model of D156: not closed, and another model\'s notice', () => {
    const { status, problems } = validate(MODEL_OF_D156);
    expect(status).toBe(1);
    expect(problems).toMatch(/the surface is not closed: 1171 edges/);
    expect(problems).toMatch(/names the model of D156/);
  });
});
