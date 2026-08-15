import { describe, expect, it } from 'vitest';
import { resolveIconComponent, type IconDef } from './icon';

// Fake "Vue components" - resolveIconComponent() never renders them, it just returns a reference,
// so plain marker objects are enough to assert identity without mounting anything (matches the
// node-only, DOM-free test environment, siehe vite.config.ts's test.environment comment).
const OUTLINE = { name: 'outline-marker' } as unknown as IconDef['outline'];
const FILLED = { name: 'filled-marker' } as unknown as IconDef['filled'];

describe('resolveIconComponent', () => {
  it('returns null for emoji style regardless of variant - caller renders the emoji glyph instead', () => {
    const def: IconDef = { id: 'home', emoji: '🏠', outline: OUTLINE, filled: FILLED };
    expect(resolveIconComponent(def, 'emoji', 'outline')).toBeNull();
    expect(resolveIconComponent(def, 'emoji', 'filled')).toBeNull();
  });

  it('returns the outline component for icons style with outline variant', () => {
    const def: IconDef = { id: 'home', emoji: '🏠', outline: OUTLINE, filled: FILLED };
    expect(resolveIconComponent(def, 'icons', 'outline')).toBe(OUTLINE);
  });

  it('returns the filled component for icons style with filled variant when one exists', () => {
    const def: IconDef = { id: 'home', emoji: '🏠', outline: OUTLINE, filled: FILLED };
    expect(resolveIconComponent(def, 'icons', 'filled')).toBe(FILLED);
  });

  it('falls back to outline when filled variant is requested but the icon has none - not every Tabler icon has a Filled counterpart', () => {
    const def: IconDef = { id: 'luggage', emoji: '🧳', outline: OUTLINE };
    expect(resolveIconComponent(def, 'icons', 'filled')).toBe(OUTLINE);
  });
});
