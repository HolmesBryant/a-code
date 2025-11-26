//npm init -y
//npm install --save-dev jsdom

import { test, describe, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// --- Test Environment Setup ---

// Mock the CSS Custom Highlight API, which is not implemented in JSDOM
const mockHighlights = new Map();
const mockCSS = {
  highlights: {
    set: (name, highlight) => mockHighlights.set(name, highlight),
    get: (name) => mockHighlights.get(name),
    delete: (name) => mockHighlights.delete(name),
    clear: () => mockHighlights.clear(),
    get size() {
      return mockHighlights.size;
    },
    forEach: (callback) => mockHighlights.forEach(callback),
  },
};

// A simple syntax definition for testing dynamic imports
const mockJsSyntax = {
  default: {
    keyword: ['const', 'let', 'class'],
    comment: /\/\/.*/g,
  },
};

// Before all tests, set up the JSDOM environment
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.customElements = dom.window.customElements;
  global.MutationObserver = dom.window.MutationObserver;
  global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  global.Range = dom.window.Range;
  global.Highlight = class Highlight {
    constructor(...ranges) { this.ranges = new Set(ranges); }
  };
  global.CSS = mockCSS;
});

// --- Test Suite ---

describe('ACode Custom Element and Highlighter', async () => {
  // Dynamically import the class after the global environment is set up
  const { ACode, Highlighter } = await import('./a-code.js');

  // Clean up the DOM and mocks between tests
  beforeEach(() => {
    document.body.innerHTML = '';
    mockCSS.highlights.clear();
    // Reset the custom element definition if it exists
    if (customElements.get('a-code')) {
        // This is tricky in a real test env; for this suite, we'll just re-register.
        // In more complex scenarios, you might need a fresh JSDOM instance per describe block.
    } else {
        customElements.define('a-code', ACode);
    }
  });

  describe('Highlighter Class', () => {
    test('should initialize with default colors', () => {
      const el = document.createElement('div');
      const highlighter = new Highlighter(el, 'js');
      assert.ok(highlighter.defaultColors instanceof Map, 'Default colors should be a Map');
      assert.strictEqual(highlighter.defaultColors.get('keyword'), 'deeppink');
    });

    test('should generate ranges for regex-based syntax', async () => {
      const textNode = document.createTextNode('// comment');
      const el = document.createElement('div');
      el.appendChild(textNode);
      const highlighter = new Highlighter(el, { comment: /\/\/.*/g });

      await highlighter.highlight(textNode);

      const highlightName = 'comment' + highlighter.suffix;
      assert.ok(mockCSS.highlights.get(highlightName), 'Highlight should be registered');
      const highlightInstance = mockCSS.highlights.get(highlightName);
      assert.strictEqual(highlightInstance.ranges.size, 1, 'Should find one range');
    });

    test('should generate ranges for keyword array syntax', async () => {
      const textNode = document.createTextNode('let foo = 1;');
      const el = document.createElement('div');
      el.appendChild(textNode);
      const highlighter = new Highlighter(el, { keyword: ['let', 'const'] });

      await highlighter.highlight(textNode);

      const highlightName = 'keyword' + highlighter.suffix;
      assert.ok(mockCSS.highlights.get(highlightName), 'Keyword highlight should be registered');
      const range = [...mockCSS.highlights.get(highlightName).ranges][0];
      assert.strictEqual(range.toString(), 'let');
    });

    test('should remove all associated highlights', async () => {
        const textNode = document.createTextNode('const x = 1;');
        const el = document.createElement('div');
        el.appendChild(textNode);
        const highlighter = new Highlighter(el, { keyword: ['const'] });

        await highlighter.highlight(textNode);
        assert.strictEqual(mockCSS.highlights.size, 1);

        highlighter.removeAll();
        assert.strictEqual(mockCSS.highlights.size, 0);
    });
  });

  describe('ACode Element', () => {
    test('should initialize with shadow DOM', () => {
      const acode = document.createElement('a-code');
      document.body.appendChild(acode);
      assert.ok(acode.shadowRoot, 'Element should have a shadow root');
      assert.ok(acode.shadowRoot.querySelector('#content'), 'Shadow root should contain a content div');
    });

    test('should process initial content on connection', () => {
      document.body.innerHTML = `<a-code>  const foo = 'bar';\n  </a-code>`;
      const acode = document.body.querySelector('a-code');
      // The connectedCallback processes content, which ends up in a text node.
      assert.strictEqual(acode.textContent, `const foo = 'bar';`);
    });

    test('should handle the "line-numbers" attribute', (t, done) => {
        const acode = document.createElement('a-code');
        acode.setAttribute('line-numbers', 'true');
        acode.textContent = 'line 1\nline 2';
        document.body.appendChild(acode);

        // Allow mutation observer and rAF to fire
        setTimeout(() => {
            const lineNumbersDiv = acode.shadowRoot.querySelector('#line-numbers');
            assert.strictEqual(lineNumbersDiv.children.length, 2, 'Should have 2 line number divs');
            assert.strictEqual(lineNumbersDiv.children[0].textContent, '1');

            acode.setAttribute('line-numbers', 'false');
            setTimeout(() => {
                assert.strictEqual(lineNumbersDiv.children.length, 0, 'Should have 0 line number divs');
                done();
            }, 50);
        }, 50);
    });

    test('should handle the "inline" attribute', () => {
        const acode = document.createElement('a-code');
        acode.setAttribute('inline', 'true');
        document.body.appendChild(acode);
        assert.strictEqual(acode.style.getPropertyValue('--wrap'), 'nowrap');
        acode.inline = false;
        assert.strictEqual(acode.style.getPropertyValue('--wrap'), '');
    });

    test('should handle the "indent" attribute', () => {
        const acode = document.createElement('a-code');
        acode.setAttribute('indent', '2');
        document.body.appendChild(acode);
        assert.strictEqual(acode.style.getPropertyValue('--indent'), '2');
    });

    test('should trigger update via MutationObserver when content changes', (t, done) => {
      const acode = document.createElement('a-code');
      acode.setAttribute('line-numbers', '');
      acode.textContent = 'first';
      document.body.appendChild(acode);

      // Wait for initial render
      setTimeout(() => {
        const lineNumbersDiv = acode.shadowRoot.querySelector('#line-numbers');
        assert.strictEqual(lineNumbersDiv.children.length, 1);

        // Change content, which should be picked up by the observer
        acode.textContent = 'first\nsecond';

        // The update is debounced, so we wait for it to fire
        setTimeout(() => {
          assert.strictEqual(lineNumbersDiv.children.length, 2, 'Line numbers should update after content change');
          done();
        }, 300); // 250ms debounce + buffer
      }, 50);
    });

    test('should call highlight method when "highlight" attribute is set', (t, done) => {
        const acode = document.createElement('a-code');

        // Mock the highlight method to see if it's called
        const highlightMock = mock.method(acode, '#highlightCode');

        acode.setAttribute('highlight', 'js');
        acode.textContent = 'let a = 1;';
        document.body.appendChild(acode);

        setTimeout(() => {
            assert.strictEqual(highlightMock.mock.callCount(), 1, 'highlightCode should have been called');

            // Test update
            acode.textContent = 'let b = 2;';
            setTimeout(() => {
                assert.strictEqual(highlightMock.mock.callCount(), 2, 'highlightCode should be called again on update');
                done();
            }, 300);
        }, 50);
    });

    test('should be cleaned up on disconnect', () => {
        const acode = document.createElement('a-code');
        document.body.appendChild(acode);

        const observer = acode['#mutationObserver'];
        const disconnectSpy = mock.method(observer, 'disconnect');
        const destroySpy = mock.method(acode, '#destroyHighlights');

        // Remove the element from the DOM
        acode.remove();

        assert.strictEqual(disconnectSpy.mock.callCount(), 1, 'MutationObserver should be disconnected');
        assert.strictEqual(destroySpy.mock.callCount(), 1, 'Highlights should be destroyed');
    });
  });
});
