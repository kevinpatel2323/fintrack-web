import { describe, expect, it } from 'vitest';
import { avatarTheme, visibleCount } from '../internal/avatarGroupLayout.js';
import { peopleFromTags } from '../../transactions/transactionListModel.js';

describe('AvatarGroup layout', () => {
  // md: 24px faces, 4px overlap → each extra face adds 20px.
  it('shows everyone when they fit and are within max', () => {
    expect(visibleCount(3, 200, { size: 'md', max: 5 })).toBe(3);
  });

  it('leaves room for the +N chip when not everyone fits', () => {
    // 64px fits three slots: two faces and the chip.
    expect(visibleCount(7, 64, { size: 'md', max: 5 })).toBe(2);
    expect(visibleCount(7, 1000, { size: 'md', max: 5 })).toBe(5);
  });

  it('always shows at least one face', () => {
    expect(visibleCount(4, 10, { size: 'md', max: 5 })).toBe(1);
  });

  it('falls back to the cap before it has measured', () => {
    expect(visibleCount(8, 0, { size: 'md', max: 3 })).toBe(3);
  });

  it('gives a person the same colour every time', () => {
    expect(avatarTheme('31')).toBe(avatarTheme('31'));
  });
});

describe('peopleFromTags', () => {
  it('lists each person once, in tag order, linking to them', () => {
    const tags = [
      { friendId: '3', friend: { id: '3', name: 'Yash Patel' } },
      { friendId: '31', friend: { id: '31', name: 'Kavita H Patel' } },
      { friendId: '3', friend: { id: '3', name: 'Yash Patel' } },
    ];
    expect(peopleFromTags(tags)).toEqual([
      { id: '3', name: 'Yash Patel', to: '/friends/3' },
      { id: '31', name: 'Kavita H Patel', to: '/friends/31' },
    ]);
  });

  it('is null until tags load, empty when there are none', () => {
    expect(peopleFromTags(undefined)).toBe(null);
    expect(peopleFromTags([])).toEqual([]);
  });
});
