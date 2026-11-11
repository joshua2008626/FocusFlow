import { describe, it, expect } from 'vitest';
import { reorder } from './order';
describe('reorder', () => {
  it('inserts before a target', () => expect(reorder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']));
  it('moves to end when no target', () => expect(reorder(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']));
  it('adds a card coming from another column', () => expect(reorder(['a', 'b'], 'x', 'b')).toEqual(['a', 'x', 'b']));
  it('is a no-op when dropped on itself', () => expect(reorder(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']));
  it('falls back to the end if the target is unknown', () => expect(reorder(['a', 'b'], 'a', 'zzz')).toEqual(['b', 'a']));
});
