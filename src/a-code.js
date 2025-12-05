/**
 * @file a-code.js
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 * @version 2.0.1
 */

/**
 * A custom element that normalizes indentation and (optionally) provides syntax highlighting for code snippets.
 *
 * @class ACode
 * @extends {HTMLElement}
 */
export default class ACode extends HTMLElement {
  // -- Attributes --

  /**
   * @private
   * @type {boolean}
   */
  #edit = false;

  /**
   * @private
   * @type {string|boolean}
   */
  #highlight = false;

  /**
   * @private
   * @type {boolean}
   */
  #inline = false;

  /**
   * @private
   * @type {number}
   */
  #indent = 2;

  /**
   * @private
   * @type {boolean}
   */
  #lineNumbers = false;

  /**
   * @private
   * @type {Object|null}
   */
  #palette = null;

   /**
   * @private
   * @type {string}
   */
  #wrap = 'pre';

  // -- Private --

  /**
   * @private
   * @type {AbortController}
   */
  #abortController;

  /**
   * @private
   * @type {HTMLElement}
   */
  #contentNode;

  /**
   * @private
   * @type {string|null}
   */
  #lastContent = null;

  /**
   * @private
   * @type {HTMLElement}
   */
  #lineNumberElem;

  /**
   * @private
   * @type {MutationObserver}
   */
  #observer;

  /**
   * @private
   * @type {number}
   */
  #updateTimeout;

  // -- Public --

  /**
   * The highlighter instance used for syntax highlighting.
   * @type {Highlighter}
   */
  highlighter;

  /**
   * Attributes to monitor for changes.
   * @type {string[]}
   */
  static observedAttributes = [
    "highlight",
    "inline",
    "indent",
    "line-numbers",
    "palette",
    "wrap"
  ];

  /**
   * The HTML template for the shadow DOM.
   * @type {HTMLTemplateElement}
   */
  static template = document.createElement('template');

  static {
    this.template.innerHTML = `
    <style>
      :host {
        --line-number-color: gray;
        --wrap: pre;
        display: block;
        max-width: 100%;
        vertical-align: top;
      }

      :host([inline]) {
        display: inline-block;
        vertical-align: middle;
      }

      section {
        display: inline-grid;
        gap: .5rem;
        grid-template-columns: max-content 1fr;
        width: 100%;
      }

      :host([inline]) section {
        display: block;
      }

      #content {
        font-family: "Courier New", monospace;
        tab-size: var(--indent);
        white-space: var(--wrap);
        overflow: auto;
        outline: none;
        text-align: left;
      }

      #line-numbers {
        color: var(--line-number-color);
        font-family: "Courier New", monospace;
        white-space: pre;
        text-align: right;
        user-select: none;
      }
    </style>

    <section part="section">
      <pre id="line-numbers" part="line-numbers"></pre>
      <pre id="content" part="content"><slot></slot></pre>
    </section>
  `;
  }

  /**
   * constructor
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  // --- Lifecycle ---

  /**
   * Called when one of the observed attributes changes.
   *
   * @param {string} attr - The name of the attribute that changed.
   * @param {string} oldval - The previous value of the attribute.
   * @param {string} newval - The new value of the attribute.
   */
  attributeChangedCallback(attr, oldval, newval) {
    if (oldval === newval) return;

    switch (attr) {
      case "highlight":
        newval = (newval === 'false') ? false : (newval === null || newval === '') ? 'html' : newval;
        this.#highlight = newval;
        this.#highlightCode(newval);
        break;
      case "inline":
        newval = newval !== 'false' && newval !== null;
        this.#inline = newval;
        this.#setInline(newval);
        break;
      case "indent":
        newval = parseFloat(newval);
        this.#indent = newval;
        this.style.setProperty("--indent", newval);
        this.#notify('indent', newval);
        break;
      case "line-numbers":
        newval = newval !== 'false' && newval !== null;
        this.#lineNumbers = newval;
        this.#setLineNumbers(newval);
        break;
      case "palette":
        this.#palette = newval;
        if(this.highlighter) this.highlighter.setPalette(newval);
        this.#notify('palette', newval);
        break;
      case 'wrap':
        this.#wrap = newval;
        this.style.setProperty('--wrap', newval);
        this.#notify('wrap', newval);
        break;
    }
  }

  /**
   * Called when the element is added to the document.
   * Initializes Shadow DOM, observers, and content.
   */
  connectedCallback() {
    if (!this.shadowRoot.hasChildNodes()) {
        this.shadowRoot.append(ACode.template.content.cloneNode(true));
    }

    this.#contentNode = this.shadowRoot.querySelector("#content");
    this.#lineNumberElem = this.shadowRoot.querySelector("#line-numbers");
    this.#abortController = new AbortController();
    this.#observer = new MutationObserver(this.#update.bind(this));
    const initialContent = this.#resetSpaces(this.#getContent());
    this.#lastContent = initialContent;
    this.#contentNode.textContent = initialContent;
    this.indent = this.#indent;
    this.#setLineNumbers(this.#lineNumbers);
    if (this.#highlight) this.#highlightCode();

    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * Called when the element is removed from the document.
   * Cleans up observers, timers, and highlighter instances.
   */
  disconnectedCallback() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    this.#destroyHighlights();
    this.highlighter = null;
    this.#palette = null;
    this.#contentNode = null;
    this.#lineNumberElem = null;
  }

  // --- Private ---

  /**
   * Decodes HTML entities by creating a temporary textarea.
   *
   * @private
   * @param {string} html - The HTML string to decode.
   * @returns {string} The decoded string.
   */
  #convertHTML(html) {
    const elem = document.createElement("textarea");
    elem.innerHTML = html;
    return elem.value;
  }

  /**
   * Destroys the current highlighter instance and cleans up artifacts.
   *
   * @private
   */
  #destroyHighlights() {
    if (!this.highlighter) return;
    try {
      this.highlighter.destroy();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Retrieves the raw content from the element.
   * Prioritizes a child `<textarea>` if present, otherwise uses innerHTML.
   *
   * @private
   * @returns {string} The raw content string.
   */
  #getContent() {
    // Check if the first child is a Textarea
    const child = this.firstElementChild;
    if (child && child.localName === 'textarea') {
      const val = child.value;
      return val.replace(/\\\//g, "/");
    }

    // Default fallback: get innerHTML and decode entities
    return this.#convertHTML(this.innerHTML);
  }

  /**
   * Initializes the syntax highlighter.
   *
   * @private
   * @param {string|boolean} [syntax=this.#highlight] - The syntax language to highlight.
   * @param {Object|null} [palette=this.palette] - The color palette to use.
   */
  #highlightCode(syntax = this.#highlight, palette = this.palette) {
    if (!this.#contentNode) return;
    if (this.highlighter) this.highlighter.destroy();
    if (syntax === 'false' || syntax === false) return;

    this.highlighter = new Highlighter(this, syntax, palette);

    try {
      const textNode = Array
        .from(this.#contentNode.childNodes)
        .find(n => n.nodeType === Node.TEXT_NODE);

      if (textNode) this.highlighter.highlight(textNode);
      this.#notify('highlight', this.#highlight);

    } catch (error) {
      console.error("Highlighting failed", error);
    }
  }

  /**
   * Notifies an external binder (e.g., `a-bind`) of property changes.
   *
   * @private
   * @param {string} property - The property name.
   * @param {*} value - The new value.
   */
  #notify(property, value) {
    const binder = customElements.get('a-bind');
    if (binder) binder.update(this, property, value);
  }

  /**
   * Normalizes indentation by removing common leading whitespace.
   *
   * @private
   * @param {string} string - The code snippet to normalize.
   * @returns {string} The normalized code snippet.
   */
  #resetSpaces(string) {
    if (!string) return "";

    // Standardize line breaks
    string = string.replace(/\r\n/g, '\n');
    string = string.replace(/^\n+/, '').trimEnd();
    if (!string) return "";

    // Normalize source tabs to spaces first so we have a consistent baseline
    string = string.replace(/\t/g, ' ');

    const lines = string.split("\n");

    // Calculate the base HTML indentation from the first line
    const firstLineMatch = lines[0].match(/^[ ]*/);
    const baseIndent = firstLineMatch ? firstLineMatch[0].length : 0;

    return lines.map(line => {
      // Remove the base HTML indentation
      const cleanLine = line.replace(new RegExp(`^[ ]{0,${baseIndent}}`), '');

      // Replace each remaining leading space with a tab (1 space -> 1 tab)
      return cleanLine.replace(/^[ ]+/g, (match) => '\t'.repeat(match.length));
    }).join("\n");
  }

  /**
   * Toggles inline display mode.
   *
   * @private
   * @param {boolean} value - Whether the element should be inline.
   */
  #setInline(value) {
    this.#inline = value;

    if (value === true) {
      this.style.setProperty('--wrap', 'nowrap');
      this.lineNumbers = false;
    } else {
      this.style.setProperty('--wrap', this.#wrap);
    }

    this.#notify('inline', this.#inline);
  }

  /**
   * Toggles line numbers.
   *
   * @private
   * @param {boolean} value - Whether to show line numbers.
   */
  #setLineNumbers(value) {
    if (!this.#lineNumberElem) return;

    if (value === true) {
      const lines = this.#contentNode.textContent.split(/\n/).length;
      const nums = Array.from({length: lines}, (_, i) => i + 1).join('\n');
      this.#lineNumberElem.textContent = nums;
      this.inline = false;
    } else {
      this.#lineNumberElem.innerHTML = "";
    }

    this.#notify('lineNumbers', value);
  }

  /**
   * Debounced update method that refreshes content and highlighting.
   *
   * @private
   * @param {number} [delay=10] - Debounce delay in milliseconds.
   */
  #update(delay = 10) {
    clearTimeout(this.#updateTimeout);
    this.#updateTimeout = setTimeout(() => {
      const rawContent = this.#getContent();
      const newContent = this.#resetSpaces(rawContent);
      if (newContent === this.#lastContent) return;
      this.#lastContent = newContent;
      this.#contentNode.textContent = newContent;

      if (this.highlighter) this.#destroyHighlights();
      if (this.lineNumbers) this.#setLineNumbers(this.#lineNumbers);

      if (this.#highlight) {
        requestAnimationFrame(() => this.#highlightCode());
      }
    }, delay);
  }

  // Getters & Setters

  /**
   * Gets the inline state.
   * @returns {boolean}
   */
  get inline() { return this.#inline; }

  /**
   * Sets the inline state.
   * @param {boolean|string} value
   */
  set inline(value) {
    this.toggleAttribute('inline', value !== 'false' && value !== false);
  }

  /**
   * Gets the indentation level (tab size).
   * @returns {number}
   */
  get indent() { return this.#indent; }

  /**
   * Sets the indentation level.
   * @param {number} value
   */
  set indent(value) {
    this.setAttribute('indent', value);
  }

  /**
   * Gets the current syntax highlighting language.
   * @returns {string|boolean}
   */
  get highlight() { return this.#highlight; }

  /**
   * Sets the syntax highlighting language.
   * @param {string|boolean} value
   */
  set highlight(value) {
    this.setAttribute('highlight', value);
  }

  /**
   * Gets the line number visibility state.
   * @returns {boolean}
   */
  get lineNumbers() { return this.#lineNumbers; }

  /**
   * Sets the line number visibility state.
   * @param {boolean|string} value
   */
  set lineNumbers(value) {
    this.toggleAttribute('line-numbers', value !== 'false' && value !== false);
  }

  /**
   * Gets the current color palette.
   * @returns {Object|null}
   */
  get palette() { return this.#palette; }

  /**
   * Sets the color palette.
   * @param {Object|string} value
   */
  set palette(value) {
    if (typeof value === 'object') {
        value = JSON.stringify(value);
    }
    this.setAttribute('palette', value);
  }

  /**
   * Gets the code content.
   */
  get value() { return this.#getContent() }

  /**
   * Sets the code content programmatically.
   * @param {string} val
   */
  set value(val) {
    const newValue = val == null ? '' : String(val);
    if (this.#getContent() === newValue) return;

    // Update the Source of Truth (Light DOM)
    // check if a textarea exists
    const child = this.firstElementChild;
    if (child && child.localName === 'textarea') {
      child.value = newValue;
    } else {
      this.textContent = newValue;
    }

    // Trigger the internal render/highlight loop
    // Pass 0 to skip the debounce delay for immediate UI feedback
    this.#update(0);

    this.#notify('value', newValue);
  }

  /**
   * Gets the whitespace wrapping mode.
   * @returns {string}
   */
  get wrap() { return this.#wrap; }

  /**
   * Sets the whitespace wrapping mode.
   * @param {string} value
   */
  set wrap(value) { this.setAttribute('wrap', value); }
}

/**
 * Manages syntax highlighting using the CSS Custom Highlight API.
 * Caches syntax definitions.
 * @type {Map<string, Object>}
 */
const syntaxCache = new Map();

/**
 * Handles the logic of syntax highlighting.
 *
 * @class Highlighter
 */
export class Highlighter {
  /** @private */ #syntax = null;
  /** @private */ #defs = {};
  /** @private */ #id;
  /** @private */ #palette;
  /** @private */ #style;
  /** @private */ #element;
  /** @private */ #textNode;
  /** @private */ #latestRequestId = 0;

  /**
   * Default regular expressions for syntax tokens.
   * @private
   */
  #defaultSyntaxDefs = {
    argument: /(?<=\()[^)]+(?=\))/g,
    operator: /[>~+*|=^$]/g,
    property: /(?<!@)\b[\w-]+(?=:)/g,
    number: /[+-]?\b\d*\.?\d+(?:e[+-]?\d+)?(?:%|[a-z]{1,4})?\b/ig,
    tag: /<\/?[\w-]+|\/>|(?<=[\w"'])>/g,
    comment: /(<!--|\/\*)([\s\S]*?)(-->|\*\/)/g,
    keyword: /@[\w]+\b/g,
    variable: /--[\w\d]+-?[\w\d]*/g,
    function: /[\w-]+\s*(?=\()/g,
    string: /(["'])(?:\\.|[^\\])*?\1/g,
  };

  /**
   * Default color palette mapping token types to colors.
   * @private
   */
  #defaultPalette = new Map([
    ["argument", "hsl(32, 93%, 66%)"],
    ["comment", "hsl(221, 12%, 69%)"],
    ["function", "hsl(210, 50%, 60%)"],
    ["keyword", "deeppink"],
    ["number", "hsl(32, 93%, 50%)"],
    ["operator", "red"],
    ["property", "orchid"],
    ["string", "hsl(114, 31%, 68%)"],
    ["variable", "darkkhaki"],
    ["tag", "indianred"],
  ]);

  /**
   * Creates an instance of Highlighter.
   *
   * @param {HTMLElement} element - The host element containing the code.
   * @param {string} syntax - The syntax language identifier.
   * @param {Object|string} palette - The color palette definition.
   * @param {string} [id] - A unique identifier for the highlighter instance.
   * @throws {Error} If the passed element is not an HTMLElement.
   */
  constructor(element, syntax, palette, id) {
    if (!(element instanceof HTMLElement)) {
      throw new Error("Element passed to Highlighter must be an HTML element");
    }
    this.#element = element;
    this.#syntax = syntax;
    this.setPalette(palette);
    this.#id = id || Math.random().toString(36).substring(2, 9);

    this.#style = this.#createStyles();

    // Attach styles to the component's shadow root to avoid global pollution
    const shadow = element.shadowRoot || element.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, this.#style];
  }

  // --- Public Methods ---

  /**
   * Cleans up the highlighter, removing styles and references.
   */
  destroy() {
    this.#deleteCssHighlights();

    if (this.#element && this.#element.shadowRoot) {
      this.#element.shadowRoot.adoptedStyleSheets =
        this.#element.shadowRoot.adoptedStyleSheets.filter(s => s !== this.#style);
    }

    this.#element = null;
    this.#textNode = null;
  }

  /**
   * Performs the syntax highlighting on the specified text node.
   *
   * @async
   * @param {Node} textNode - The text node containing the code.
   */
  async highlight(textNode) {
    if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
      if(textNode.childNodes.length > 0) {
         textNode = Array.from(textNode.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      }
      if (!textNode) textNode = document.createTextNode("");
    }

    if (!(this.#textNode = textNode || this.#textNode)) return;
    const currentRequestId = ++this.#latestRequestId;
    const defs = await this.#getSyntaxDefs(this.#syntax);

    if (currentRequestId !== this.#latestRequestId) return;
    this.#defs = defs;

    try {
      this.#doHighlights(this.#defs, this.#textNode);
    } catch (error) {
      console.error("Error highlighting code:", error);
    }
  }

  /**
   * Updates the color palette and regenerates styles.
   *
   * @param {Map|string} palette - The new palette configuration.
   */
  setPalette(palette) {
    let map;
    if (palette instanceof Map) {
      map = palette;
    } else if (typeof palette === 'string') {
        if (palette === 'default') {
            map = this.#defaultPalette;
        } else {
            try {
                map = new Map(JSON.parse(palette));
            } catch (e) {
                console.warn("Invalid palette JSON string, using default.", this.#element);
                map = this.#defaultPalette;
            }
        }
    } else {
        map = this.#defaultPalette;
    }

    this.#palette = map;

    if (this.#style) {
        const newSheet = this.#createStyles();
        this.#style.replaceSync(newSheet.cssRules[0]?.cssText ? Array.from(newSheet.cssRules).map(r=>r.cssText).join(' ') : '');
    }
  }

  // --- Private Methods

  /**
   * Creates a CSS Highlight for a specific token type and set of ranges.
   *
   * @private
   * @param {Set<Range>} ranges - The ranges to highlight.
   * @param {string} key - The token type key (e.g., 'keyword').
   */
  #applyHighlight(ranges, key) {
    if (!ranges || ranges.size === 0) return;
    const highlightName = `${key}-${this.#id}`;
    const highlight = new Highlight(...ranges);
    CSS.highlights.set(highlightName, highlight);
  }

  /**
   * Generates the CSSStyleSheet for the current palette.
   *
   * @private
   * @returns {CSSStyleSheet}
   */
  #createStyles() {
    const sheet = new CSSStyleSheet();
    let rules = "";
    this.#palette.forEach((color, key) => {
      const highlightName = `${key}-${this.#id}`;
      rules += `::highlight(${highlightName}) { color: ${color}; } `;
    });
    sheet.replaceSync(rules);
    return sheet;
  }

  /**
   * Removes all CSS Custom Highlights associated with this instance.
   */
  #deleteCssHighlights() {
    if (!this.#defs) return;
    for (const key of Object.keys(this.#defs)) {
      const highlightName = `${key}-${this.#id}`;
      CSS.highlights.delete(highlightName);
    }
  }

  /**
   * Applies highlights to the text node based on the syntax object.
   *
   * @private
   * @param {Object} syntaxObj - The syntax definitions.
   * @param {Node} textNode - The text node to highlight.
   * @returns {number} The size of the CSS highlights set.
   */
  #doHighlights(syntaxObj, textNode) {
    if (textNode.nodeType !== Node.TEXT_NODE) return 0;

    const string = textNode.textContent;

    for (const [prop, value] of Object.entries(syntaxObj)) {
      let ranges;

      if (!value) {
        continue;
      } else if (Array.isArray(value)) {
        const words = [...new Set(value)].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|");
        const regex = new RegExp(`\\b(${words})\\b`, "g");
        ranges = this.#setRanges(regex, string, textNode);
      } else if (typeof value === 'function') {
        ranges = new Set(value(string, textNode));
      } else if (value instanceof RegExp) {
        ranges = this.#setRanges(value, string, textNode);
      } else {
        console.warn(`Invalid syntax definition for ${prop}`);
        continue;
      }

      this.#applyHighlight(ranges, prop);
    }

    return CSS.highlights.size;
  }

  /**
   * Retrieves syntax definitions, loading them dynamically if necessary.
   *
   * @private
   * @param {string|Object} syntax - The syntax identifier or definition object.
   * @returns {Promise<Object>} The syntax definition object.
   */
  async #getSyntaxDefs(syntax) {
    if (!syntax || syntax === 'html') return this.#defaultSyntaxDefs;

    if (typeof syntax === "object") {
        syntaxCache.set("custom", syntax);
        return syntax;
    }

    if (syntaxCache.has(syntax)) {
      return syntaxCache.get(syntax);
    }

    let url = syntax;
    if (!/^(http|\.|\/)/.test(syntax)) url = `./syntax.${syntax}.js`;

    try {
      const module = await import(url);
      const defs = module.default;
      syntaxCache.set(syntax, defs);
      return defs;
    } catch (error) {
      console.warn(`Could not load syntax file: ${url}. Reverting to default.`, error);
      return this.#defaultSyntaxDefs;
    }
  }

  /**
   * Finds all matches for a regex in a string and creates Ranges.
   *
   * @private
   * @param {RegExp} regex - The regular expression to match.
   * @param {string} string - The text content.
   * @param {Node} node - The text node.
   * @returns {Set<Range>} A set of Range objects.
   */
  #setRanges(regex, string, node) {
    const ranges = new Set();
    const matches = string.matchAll(regex);

    for (const match of matches) {
      if (match[0].length === 0) continue;
      try {
        const range = new Range();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.add(range);
      } catch (e) { /* ignore range errors */ }
    }
    return ranges;
  }
}

if (!customElements.get('a-code')) {
  customElements.define('a-code', ACode);
}
