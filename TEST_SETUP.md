# Test Setup Guide

## Overview

Test files have been created for the dashboard widgets but require test framework setup to run.

## Installation

To enable testing, install the following dependencies:

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

## Configuration

### 1. Create `vitest.config.js` in the project root:

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
```

### 2. Create `src/test/setup.js`:

```javascript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

### 3. Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Files

- `src/components/widgets/__tests__/SpendingOverviewWidget.test.jsx` - Tests for spending overview widget
- `src/components/widgets/__tests__/CategoryBreakdownWidget.test.jsx` - Tests for category breakdown widget
- `src/components/widgets/__tests__/WidgetContainer.test.jsx` - Tests for widget container

## Test Coverage

The test files include:
- Loading state tests
- Error state tests
- Data rendering tests
- Currency formatting tests
- Component interaction tests
- API integration tests

## Notes

- Tests are currently commented out and serve as templates
- Uncomment test code after completing the setup above
- Add more test files as needed for other widgets
- Consider adding E2E tests with Playwright or Cypress for full integration testing
