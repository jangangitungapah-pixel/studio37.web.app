import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App.jsx';

describe('Studio37 application foundation', () => {
  it('renders the dashboard route inside the application shell', () => {
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigasi utama' })).toBeInTheDocument();
  });
});
