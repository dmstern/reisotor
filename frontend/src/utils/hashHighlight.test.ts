import { describe, expect, it } from 'vitest';
import { hashHighlightId } from './hashHighlight';

describe('hashHighlightId', () => {
  it('extracts the numeric id when the hash matches the given domain', () => {
    expect(hashHighlightId('#todo-123', 'todo')).toBe(123);
  });

  it('returns null when the hash belongs to a different domain', () => {
    expect(hashHighlightId('#travel-123', 'todo')).toBeNull();
  });

  it('returns null for an empty hash', () => {
    expect(hashHighlightId('', 'todo')).toBeNull();
  });

  it('returns null for a non-numeric suffix', () => {
    expect(hashHighlightId('#todo-abc', 'todo')).toBeNull();
  });
});
