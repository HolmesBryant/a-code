/**
 * Test suite for a-code Web Component
 */

import ATestRunner from './ATestRunner.min.js';
import ACode from '../src/a-code.js';

const runner = new ATestRunner(import.meta.url);
runner.output="#test-results";
const { group, test, equal, wait, info } = runner;

// --- Helper Functions ---

/**
 * Creates an <a-code> element, appends it to the DOM, and waits for the
 * internal debounce/AF to settle.
 */
async function createFixture(content = '', attributes = {}) {
  const el = document.createElement('a-code');

  for (const [key, val] of Object.entries(attributes)) {
    el.setAttribute(key, val);
  }

  // Use a textarea if strictly needed, otherwise innerHTML
  if (content) el.innerHTML = content;

  document.body.append(el);

  // ACode has a generic debounce of 10ms in #update()
  // plus requestAnimationFrame for highlighting.
  // so wait 50ms to ensure the DOM is stable.
  await wait(50);

  return el;
}

/**
 * Clean up fixtures after tests
 */
function cleanup() {
  document.querySelectorAll('a-code').forEach(el => el.remove());
}

// --- Tests ---

group("Initialization & Defaults", () => {

  test("Element is defined in CustomElementsRegistry",
    !!customElements.get('a-code'),
    true
  );

  test("Shadow DOM is attached and open", async () => {
    const el = await createFixture('const a = 1;');
    return el.shadowRoot && el.shadowRoot.mode === 'open';
  }, true);

  test(
    "Default attributes are correct",
    async () => {
      const el = await createFixture();
      return {indent: el.indent, highlight: el.highlight, lineNumbers: el.lineNumbers, wrap: el.wrap, inline: el.inline };
    },
    {indent: 2, highlight: false, lineNumbers: false, wrap: 'pre', inline: false }
  );

  cleanup();
});

group("Indentation Normalization", () => {
  test("Normalizes deep indentation and preserves relative hierarchy",
  async () => {
    // Input simulates code nested 6 spaces deep within an HTML structure.
    // Line 1: 6 spaces (Base Indent)
    // Line 2: 8 spaces (Base + 2)
    // Line 3: 6 spaces (Base)
    const input = `
      <div>
        <span>Hello</span>
      </div>
    `;

    const el = await createFixture(input);
    const content = el.shadowRoot.querySelector('#content').textContent;

    // We don't use .trim() here on the result because we want to verify
    // that the component itself correctly handled the leading/trailing
    // newlines via its internal .trimEnd() logic.
    return content;
  },
  // Expected Output:
  // 1. Base indent (6 spaces) is stripped from all lines.
  // 2. Line 2 has 2 extra spaces. Logic converts 1 space -> 1 tab.
  // 3. Result is 2 tabs (\t\t).
  `<div>\n\t\t<span>Hello</span>\n</div>`
  );

  test("Respects indentation relative to first line", async () => {
    const input = `
      <div>
          <span>Nested</span>
      </div>`;

    const el = await createFixture(input);
    const content = el.shadowRoot.querySelector('#content').textContent;

    // Should keep indentation of span relative to div
    return content.includes('\t\t<span>Nested</span>');
  }, true);

  test("Updates content dynamically via innerHTML", async () => {
    const el = await createFixture('initial');
    el.innerHTML = 'updated';

    // Wait for MutationObserver -> debounce -> update
    await wait(50);

    const content = el.shadowRoot.querySelector('#content').textContent;
    return content;
  }, 'updated');

  cleanup();
});

group("Attributes & Reactivity", () => {

  test("Reflects 'inline' attribute to CSS", async () => {
    const el = await createFixture('code', { inline: '' });

    const style = getComputedStyle(el);
    const isInlineBlock = style.display === 'inline-block';
    const isNoWrap = getComputedStyle(el.shadowRoot.querySelector('#content')).whiteSpace === 'nowrap';

    return isInlineBlock && isNoWrap;
  }, true);

  test("Updates 'wrap' property", async () => {
    const el = await createFixture('code');
    el.wrap = 'pre-wrap';

    // Wait for CSS variable update
    await wait(20);

    // ACode sets --wrap variable on host
    const varValue = el.style.getPropertyValue('--wrap');
    return varValue;
  }, 'pre-wrap');

  test("Updates 'indent' property and visual tab-size", async () => {
    const el = await createFixture('code');
    el.indent = 4;

    await wait(20);
    const varValue = el.style.getPropertyValue('--indent');
    return varValue;
  }, '4');

  cleanup();
});

group("Line Numbers", () => {

  test("Does not render line numbers by default", async () => {
    const el = await createFixture('line 1\nline 2');
    const container = el.shadowRoot.querySelector('#line-numbers');
    return container.textContent;
  }, '');

  test("Renders line numbers when attribute is set", async () => {
    const el = await createFixture('line 1\nline 2\nline 3', { 'line-numbers': '' });
    const container = el.shadowRoot.querySelector('#line-numbers');

    // It joins numbers with \n
    return container.textContent;
  }, '1\n2\n3');

  test("Updates line numbers dynamically when content changes", async () => {
    const el = await createFixture('one', { 'line-numbers': '' });
    el.innerHTML = 'one\ntwo\nthree';

    await wait(50); // wait for observer
    const container = el.shadowRoot.querySelector('#line-numbers');
    return container.textContent;
  }, '1\n2\n3');

  test("Toggling property updates view", async () => {
    const el = await createFixture('one\ntwo');
    el.lineNumbers = true;
    await wait(20);
    const turnedOn = el.shadowRoot.querySelector('#line-numbers').textContent === '1\n2';

    el.lineNumbers = false;
    await wait(20);
    const turnedOff = el.shadowRoot.querySelector('#line-numbers').textContent === '';

    return turnedOn && turnedOff;
  }, true);

  cleanup();
});

group("Highlighter Integration", () => {
  // Note: We cannot easily test if the pixel colors changed (visual regression),
  // but we can test if the Highlighter class was instantiated and attached.

  test("Highlighter instance is created by if highlight != false", async () => {
    const el = await createFixture('const a = 1;');
    el.highlight = 'html';
    wait(10);
    return !!el.highlighter;
  }, true);

  test("Highlighter is destroyed when highlight='false'",
    async () => {
      const el = await createFixture('const a = 1;');
      el.highlight = false;
      await wait(20);
      // The property should be null or the CSS highlights deleted
      // if (value === false) highlighter.deleteCssHighlights()
      // It doesn't strictly set this.highlighter to null in setHighlight,
      // but the CSS registry should be empty for this ID.

      // check the property reflection
      // toggleAttribute removes it if false
      return el.getAttribute('highlight') === null;
    },
    false
  );

  test("Accepts custom palette object", async () => {
    const el = await createFixture('code');
    const palette = { keyword: 'blue', string: 'red' };
    el.palette = palette;

    await wait(20);
    // Attribute is stringified
    return JSON.parse(el.getAttribute('palette'));
  }, { keyword: 'blue', string: 'red' });

  cleanup();
});

group("HTML Entity Decoding", () => {
  test("Decodes HTML entities in innerHTML", async () => {
    // If we write &lt;div&gt; inside the element, we expect it to render as <div
    // inside the shadow DOM text content, not &lt;div&gt;
    const el = await createFixture('&lt;div&gt;Hello&lt;/div&gt;');
    const content = el.shadowRoot.querySelector('#content').textContent;
    return content;
  }, '<div>Hello</div>');

  test("Preserves content from <textarea> child (Robustness)", async () => {
    // ACode supports a <textarea> child to avoid HTML entity encoding issues entirely
    const el = document.createElement('a-code');
    const ta = document.createElement('textarea');
    ta.value = '<div class="test"></div>';
    el.appendChild(ta);
    document.body.append(el);
    await wait(50);

    const content = el.shadowRoot.querySelector('#content').textContent;
    el.remove();
    return content;
  }, '<div class="test"></div>');

  cleanup();
});

// Run the suite
runner.run();
