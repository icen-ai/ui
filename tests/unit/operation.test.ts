import { expect, test } from 'bun:test';
import { createOperation } from '../../src/behaviors/operation';

test('operation publishes guarded state transitions and immutable snapshots', () => {
  const operation = createOperation<{ text: string }, number>({ id: 'turn-1', value: { text: '' } });
  const statuses: string[] = [];
  const dispose = operation.onChange(snapshot => statuses.push(snapshot.status));
  operation.update({ text: 'hello' });
  operation.transition('running');
  operation.transition('streaming');
  operation.succeed(7);
  operation.transition('approval');
  operation.fail(new Error('late'));
  expect(statuses).toEqual(['pending', 'pending', 'running', 'streaming', 'done']);
  expect(operation.value).toEqual({ text: 'hello' });
  expect(operation.result).toBe(7);
  expect(operation.settled).toBe(true);
  expect(Object.isFrozen(operation.snapshot())).toBe(true);
  dispose();
});

test('terminal operations reject late chunks, repeated settlement and updates', () => {
  const operation = createOperation({ id: 'request-1' });
  expect(operation.fail('offline')).toBe(true);
  expect(operation.error).toBe('offline');
  expect(operation.succeed('late')).toBe(false);
  expect(operation.cancel()).toBe(false);
  expect(operation.update({ late: true })).toBe(false);
});

test('cancel aborts once, destroys listeners and permits no stale continuation', () => {
  const operation = createOperation();
  let calls = 0;
  operation.onChange(() => calls++);
  expect(operation.cancel()).toBe(true);
  expect(operation.signal.aborted).toBe(true);
  expect(operation.status).toBe('cancelled');
  expect(operation.cancel()).toBe(false);
  operation.destroy();
  operation.destroy();
  expect(calls).toBe(2);
});

test('operation can finish synchronously and removes its last listener on destroy', () => {
  const operation = createOperation({ value: { attempt: 1 } });
  expect(operation.succeed({ ok: true })).toBe(true);
  expect(operation.result).toEqual({ ok: true });
  operation.destroy();
  expect(operation.status).toBe('done');
  expect(operation.signal.aborted).toBe(false);
});
