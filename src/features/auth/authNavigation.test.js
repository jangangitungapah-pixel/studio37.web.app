import { describe, expect, it } from 'vitest';

import { getPostLoginPath } from './authNavigation.js';

describe('post-login navigation', () => {
  it('preserves an internal protected destination', () => {
    expect(
      getPostLoginPath({
        pathname: '/bookings/booking-37',
        search: '?panel=payment',
        hash: '#history',
      }),
    ).toBe('/bookings/booking-37?panel=payment#history');
  });

  it.each([
    [undefined],
    [{ pathname: '/login' }],
    [{ pathname: '//outside.example' }],
    [{ pathname: 'https://outside.example' }],
  ])('falls back to the dashboard for an unsafe or missing destination', (from) => {
    expect(getPostLoginPath(from)).toBe('/dashboard');
  });
});
