//App.test.js
import { render, screen } from '@testing-library/react';
import App from './App';

describe('MaiSpec UI smoke tests', () => {
  test('renders hero title and CTA', () => {
    render(<App />);
    expect(screen.getByText(/AI-Assisted Project/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
  });

  test('renders Project Details form pieces', () => {
    render(<App />);
    expect(screen.getByText(/Project Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Project type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Short description/i)).toBeInTheDocument();
  });
});
