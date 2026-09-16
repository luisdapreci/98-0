import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRandom, randomStream, shuffle } from './random.ts';

test('versioned random streams replay, resume through JSON, and stay independent', () => {
  const draft = randomStream('saved-run', 'draft');
  const replay = randomStream('saved-run', 'draft');
  for (let index = 0; index < 1000; index++) {
    const value = draft.next();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, replay.next());
  }
  const resumed = createRandom(JSON.parse(JSON.stringify(draft.state())));
  assert.deepEqual(Array.from({ length: 20 }, draft.next), Array.from({ length: 20 }, resumed.next));
  const outcome = randomStream('saved-run', 'outcome/1');
  Array.from({ length: 200 }, draft.next);
  assert.equal(outcome.next(), randomStream('saved-run', 'outcome/1').next());
  assert.notEqual(randomStream('saved-run', 'draft').next(), outcome.next());
  assert.notEqual(randomStream('other-run', 'draft').next(), replay.next());
});

test('Mulberry32 known vector and shuffle preserve the randomness contract', () => {
  assert.equal(createRandom(1).next(), 0.6270739405881613);
  for (const invalid of [-1, 0x100000000, NaN, Infinity, 0.5])
    assert.throws(() => createRandom(invalid));
  const input = [1, 2, 3, 4, 5];
  const result = shuffle(input, randomStream('shuffle', 'schedule').next);
  assert.deepEqual([...result].sort(), input);
  assert.deepEqual(result, shuffle(input, randomStream('shuffle', 'schedule').next));
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});