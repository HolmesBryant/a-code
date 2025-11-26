/**
 * @file
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 * @version 2.0.1
 */

/**
  * A custom element that provides syntax highlighting for code snippets.
  * It uses the CSS Custom Highlight API for efficient highlighting.
  *
  * @class ACode
  * @extends {HTMLElement}
  * @property {boolean} highlight - The syntax language to highlight. Defaults to 'html'.
  * @property {boolean} inline - Renders the element as an inline-block.
  * @property {number} indent - The tab size for indentation.
  * @property {boolean} lineNumbers - Toggles the display of line numbers.
  * @property {string} palette - The color palette to use for highlighting.
  */
export class ACode extends HTMLElement {
  // Attributes

  /** @private */
  #edit = false;

  /** @private */
  #highlight = false;

  /** @private */
  #inline = false;

  /** @private */
  #indent = 4;

  /** @private */
  #lineNumbers = false;

  /** @private */
  #palette = null;

  /** @private */
  #wrap = 'pre';

  // Private

  /** @private
   * @type {AbortController | null}
   */
  #abortController;

  /** @private
   * @type {HTMLElement | null}
   */
  contentNode;

   /**
   * @private
   * @type {string | null}
   * @description Caches the last processed content to prevent infinite update loops.
   */
  #lastContent = null;

  /** @private
   * @type {number}
   */
  #lastMutationTime = Date.now();

  /** @private
   * @type {HTMLElement | null}
   */
  lineNumberElem;

  /** @private
   * @type {MutationObserver}
   */
  #observer;

  /** @private
   * @type {number}
   */
  #updateTimeout;

  // Public

  /** @type {Highlighter} */
  highlighter;

  /** @type {Object<string} */
  defaults = {};

  /**
   * @static
   * @type string[]
   * @description A list of attributes to observe for changes.
   */
  static observedAttributes = [
    "highlight",
    "inline",
    "indent",
    "line-numbers",
    "palette",
    "wrap"
  ];

  static template = document.createElement('template');

  static {
    this.template.innerHTML = `
    <style>
      :host {
        --indent: 2;
        --line-number-color: gray;
        --wrap: pre;
        display: block;
        max-width: 100%;
        vertical-align: top;
      }

      :host([inline]) {
        display: inline-block;
        padding: 0;
      }

      section {
        display: inline-grid;
        gap: .5rem;
        grid-template-columns: max-content 1fr;
        width: 100%;
      }

      #content {
        font-family: "Courier New", monospace;
        tab-size: var(--indent);
        white-space: var(--wrap);
        overflow: auto;
      }

      #line-numbers {
        color: var(--line-number-color);
        font-family: "Courier New", monospace;
        white-space: pre-line;
      }
    </style>

    <section part="section">
      <div id="line-numbers" part="line-numbers"></div>
      <div id="content" part="content"><slot></slot></div>
    </section>
  `;
  }

  /**
   * @constructor
   * @description Creates a new ACode instance and sets up its shadow DOM.
   *
   */
  constructor() {
   super();
   this.attachShadow({ mode: "open" });
  }

  /**
   * Called when an observed attribute changes.
   * @param {string} attr - The attribute name.
   * @param {string | null} oldval - The old attribute value.
   * @param {string | null} newval - The new attribute value.
   */
  attributeChangedCallback(attr, oldval, newval) {
    switch (attr) {
      case "highlight":
        this.#setHighlight(newval);
        break;
      case "inline":
        newval = newval !== null && newval !== 'false' && newval !== false;
        this.#setInline(newval);
        break;
      case "indent":
        this.style.setProperty("--indent", newval);
        this.#indent = newval;
        if (window.abind) abind.update(this, 'indent', newval);
        break;
      case "line-numbers":
        this.#setLineNumbers(newval);
        break;
      case "palette":
        this.#palette = newval;
        break;
      case 'wrap':
        this.#wrap = newval;
        this.style.setProperty('--wrap', newval);
    }
  }

  /**
   * Called when the element is added to the document's DOM.
   */
  connectedCallback() {
    this.shadowRoot.append(ACode.template.content.cloneNode(true));
    this.contentNode = this.shadowRoot.querySelector("#content");
    this.lineNumberElem = this.shadowRoot.querySelector("#line-numbers");
    this.#abortController = new AbortController();
    this.#observer = new MutationObserver( this.#debouncedUpdate.bind(this) );

    const initialContent = this.#resetSpaces(this.#getContent());
    this.textContent = initialContent;

    // Cache initial content
    this.#lastContent = initialContent;

    if (this.lineNumbers) this.#addLineNumbers();
    if (this.highlight) this.#highlightCode();
    this.#setDefaults();

    this.#observer.observe( this, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * Called when the element is removed from the DOM. Cleans up resources and removes event listeners.
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

    this.contentNode = null;
    this.lineNumberElem = null;
  }

  /**
   * Adds line numbers to the code block.
   */
  #addLineNumbers() {
    if (!this.lineNumberElem) return;
    const lines = this.textContent.split(/\r?\n/).length;
    let html = "";
    for (let i = 1; i <= lines; i++) {
      html += `${i}\n`;
    }

    this.lineNumberElem.innerHTML = html.trim();
  }

  /**
   * Converts HTML entities within a string to their corresponding characters.
   * @param {string} html - The HTML string to convert.
   * @returns {string} The decoded string.
   */
  #convertHTML(html) {
    const elem = document.createElement("textarea");
    elem.innerHTML = html;
    return elem.value;
  }

  /**
    * Destroys all current highlights.
    * @returns {string} The suffix used to identify the highlights used by this instance in the CSS HighlightRegistry
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
   * Debounces the update function to prevent rapid, successive calls.
   * @param {number} [delay=10] - The debounce delay in milliseconds.
   */
  #debouncedUpdate(delay = 250) {
    clearTimeout(this.#updateTimeout);
    this.#updateTimeout = setTimeout(() => this.#update(), delay);
  }

  /**
   * Gets the raw content from the component's slot or textarea child.
   * @returns {string} The raw content.
   */
  #getContent() {
    if (this.children[0] && this.children[0].localName === 'textarea') {
      return this.textContent.replace("\\/", "/");
    } else {
      return this.#convertHTML(this.innerHTML);
    }
  }

  /**
   * Initiates syntax highlighting.
   * @param {string | boolean} [syntax=this.highlight] - The language syntax to use.
   * @returns {Promise<boolean | undefined>} A promise that resolves to true on success.
   */
  #highlightCode(syntax = this.highlight, palette = this.palette) {
    if (syntax === false) return;
    this.highlighter = new Highlighter(this, syntax, palette);
    try {
      this.highlighter.highlight(this.childNodes[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove line numbers from the output
   */
  #removeLineNumbers() {
    if (!this.lineNumberElem) return;
    this.lineNumberElem.innerHTML = "";
  }

  /**
   * Reset all observed attributes to the default values
   */
  reset() {
    for (const attr of ABind.observedAttributes) {
      this[attr] = this.defaults[attr];
    }
  }

  /**
   * Normalizes indentation and trims whitespace from a string.
   * @param {string} string - The string to process.
   * @returns {string} The formatted string.
   */
  #resetSpaces(string) {
    this.needsUpdate = false;
    string = string
      .replace(/^ +/gm, (spaces) => "\t".repeat(spaces.length))
      .trim();

    const lines = string.split("\n");
    const spaces = lines.at(-1).match(/^\s*/)[0].length;
    const regex = new RegExp(`^\\s{${spaces}}`, "g");
    return lines.map((line) => line.replace(regex, "")).join("\n");
  }

  /**
   * Stores the initial values of observed attributes as defaults.
   */
  #setDefaults() {
    if (Object.keys(this.defaults).length > 0) return;
    for (const attr of ACode.observedAttributes) {
      this.defaults[attr] = this[attr];
    }
  }

  #setHighlight(value) {
    switch (value) {
      case "false":
      case false:
        this.#highlight = false;
        if (this.highlighter) this.highlighter.deleteCssHighlights();
        break;
      case "":
      case null:
        this.#highlight = 'html';
        break;
      default:
        this.#highlight = value;
    }

    if (this.#highlight !== false) {
      if (this.highlighter) this.highlighter.setHighlights(value);
    }

    if (window.abind) abind.update(this, 'highlight', value);
  }

  #setInline(value) {
    if (value === true) {
      this.style.setProperty('--wrap', 'nowrap')
      this.lineNumbers = false;
    } else {
      this.style.removeProperty('--wrap');
      if (this.hasAttribute("line-numbers")) {
        this.lineNumbers = this.getAttribute("line-numbers");
      }
    }
    this.#inline = value;
    if (window.abind) abind.update(this, 'inline', value);
  }

  #setLineNumbers(value) {
    value = value !== null && value !== 'false' && value !== false;
    this.#lineNumbers = value;
    if (value === true) {
      this.#addLineNumbers();
    } else {
      this.#removeLineNumbers();
    }

    if (window.abind) abind.update(this, 'lineNumbers', value);
  }

  /**
   * Updates the component's content and re-applies highlighting and line numbers.
   */
  #update() {
    const newContent = this.#resetSpaces(this.#getContent());

    // Check against cached content to prevent infinite loops
    if (newContent === this.#lastContent) return;

    this.#lastContent = newContent;
    this.textContent = newContent;

    if (this.highlighter) this.#destroyHighlights();
    if (this.lineNumbers) this.#addLineNumbers();

    if (this.highlight) {
      requestAnimationFrame(() => this.#highlightCode());
    }
  }

  get abortController() { return this.#abortController }
  get observer() { return this.#observer }

  /**
   * Gets the inline state.
   * @returns {boolean}
   */
  get inline() { return this.#inline; }

  /**
   * Sets the inline state.
   * @param {boolean | string} value
   */
  set inline(value) {
    value = value !== "" && value !== 'false' && value !== false;
    this.toggleAttribute('inline', value);
  }

  /**
   * Gets the indent size.
   * @returns {number}
   */
  get indent() { return this.#indent }

  /**
   * Sets the indent size.
   * @param {number | string} value
   */
  set indent(value) {
    if (!value) value = this.defaults.indent;
    this.setAttribute('indent', value);
  }

  /**
   * Gets the highlight language.
   * @returns {boolean | string}
   */
  get highlight() { return this.#highlight; }

  /**
   * Sets the highlight language.
   * @param {boolean | string | null} value
   */
  set highlight(value) {
    if (!value) value = this.defaults.highlight;
    this.setAttribute('highlight', value);
  }

  /**
   * Gets the lineNumbers state.
   * @returns {boolean}
   */
  get lineNumbers() { return this.#lineNumbers; }

  /**
   * Sets the lineNumbers state.
   * @param {boolean | string} value
   */
  set lineNumbers(value) {
    value = value !== null && value !== 'false' && value !== false;
    this.toggleAttribute('line-numbers', value);
  }

  /**
   * Gets the current color palette.
   * @returns {string}
   */
  get palette() { return this.#palette }

  /**
   * Sets the color palette for the highlighter.
   * This is not an observed attribute.
   * @param {string} value
   */
  set palette(value) {
    console.log('value', value)
    /*if (value instanceof Map) {
    } else if(value === undefined || value === 'default' || value === null || value === 'null') {
      value = null;
    } else {
      try {
        value = new Map( JSON.parse(value) );
      } catch (error) {
        return console.error( `Error setting palette: ${error} | ${value}`);
      }
    }*/

    this.setAttribute('palette', JSON.stringify(value));
    // if (this.highlighter) this.highlighter.setPalette(value);
  }

  /**
   * Gets the wrap state.
   * @returns {string}
   */
  get wrap() { return this.#wrap }
  set wrap(value) { this.setAttribute('wrap', value) }
}

/**
  * Manages syntax highlighting using the CSS Custom Highlight API.
  * Caches syntax definitions for efficiency.
  */
const syntaxCache = new Map();

/**
  * A class to handle the logic of syntax highlighting.
  * @class Highlighter
  */
export class Highlighter {
  #syntax = null;

  #defs;

  #defaultSyntaxDefs = {
    argument: /(?<=\()[^)]+/g,
    function: /[\w-]+\s*\(|\)/g,
    operator: /[>+~*\/=]|(?<!\w[-])/g, // Fixed: removed extra comma
    property: /(?<!}[\r\n\s]+)\b([\w\d-]+:(?!:))/g,
    number: /(?<!\w)[#+-.]?\d+[%.A-Za-z]*/g, // Fixed: replaced \b with a more specific character set
    tag: /<\/?[\w-]+|(?<=[\w"'])>/g,
    string: /["'`][^"'`]*["'`]/g,
    variable: /--[\w\d]+-?[\w\d]*/g,
    comment: /(<!--|\/\*)([\s\S]*?)(-->|\*\/)/g,
    keyword: /@[\w]+\b/g
  };

  #id;

  #palette;

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

  #style;

  #textNode;

  constructor(element, syntax, palette, id) {
    if (! (element instanceof HTMLElement)) {
      throw new Error("element passed to Highlighter must be an HTML element");
    }
    this.#syntax = syntax || this.#syntax;
    this.#palette = (palette !== null && palette !== 'default') ? palette : this.#defaultPalette;
    this.#id = id || Math.random().toString(36).substring(2, 9);

    this.#style = this.#createStyles();
    const shadow = (element.shadowRoot && element.shadowRoot.mode === 'open') ?
        element.shadowRoot :
        element.attachShadow({ mode: 'open' });

    shadow.adoptedStyleSheets = [this.#style];
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#style];
  }

  #createStyles() {
    const sheet = this.#style ? this.#style : new CSSStyleSheet();
    let rules = "";
    this.#palette.forEach((color, key) => {
      const highlightName = `${key}-${this.#id}`;
      rules += `::highlight(${highlightName}) { color: ${color}}`;
    });

    sheet.replaceSync(rules);
    return sheet;
  }

  deleteCssHighlights() {
    for (const key of Object.keys(this.#defs)) {
      const highlightName = `${key}-${this.#id}`;
      CSS.highlights.delete(highlightName);
    }
  }

  destroy() {
    this.deleteCssHighlights();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== this.#style
    );
  }

  #doHighlights(syntaxObj, textNode) {
    if (textNode.nodeType !== Node.TEXT_NODE) {
      throw new Error(
        `Second argument must be a TEXT_NODE (3). Given nodeType is (${textNode.nodeType})`
      );
    }

    let ranges;
    const string = textNode.textContent;

    for (const prop of Object.keys(syntaxObj)) {
      const value = syntaxObj[prop];

      if (!value) {
        continue;
      } else if (Array.isArray(value)) {
        // Array of key words
        // Set() removes duplicate words
        const words = [...new Set(value)].join("|");
        const regex = new RegExp(`\\b(${words})\\b`, "g");
        ranges = this.#setRanges(regex, string, textNode);
      } else if (value instanceof Function) {
        // function returning flat array of range objects
        ranges = new Set(value(string, textNode));
      } else if (value instanceof RegExp) {
        // regular expression
        ranges = this.#setRanges(value, string, textNode);
      } else {
        console.error(`Invalid syntaxObj definition for ${prop}: `, `"${value}"`);
        continue;
      }

      this.#setHighlight(ranges, prop);
    }

    // the size should be the number of properties in the
    return CSS.highlights.size;
  }

  /**
   * Retrieves a syntax definition, from cache if available.
   * @param {string | object} syntax - The name of the syntax or a syntax object.
   * @returns {Promise<object>} A promise that resolves to the syntax definition object.
   */
  async #getSyntaxDefs(syntax) {
    let syntaxObj;

    if (typeof syntax === "string") {
      // syntaxCache is not a property, it is a top level variable.
      if (syntaxCache.has(syntax)) {
        syntaxObj = syntaxCache.get(syntax);
      } else {
        let url = syntax;
        // if syntax is not a url, look for the syntax file at './syntax.${syntax}.js'
        if (!/^(http|\.|\/)/.test(syntax)) url = `./syntax.${syntax}.js`;
        try {
          const module = await import(url);
          syntaxCache.set(syntax, module.default);
          syntaxObj = module.default;
        } catch (error) {
          console.error("Error loading Highlight Syntax");
          throw error;
        }
      }
    } else {
      // hopefully `syntax` is a pojo
      try {
        syntaxObj = syntax;
        syntaxCache.set(syntax, syntax)
      } catch (e) {
        syntaxObj = this.defaultSyntaxDefs;
        syntaxCache.set(syntax, syntaxObj)
        console.error("Error loading syntax definition. Using defaults: ", e);
      }
    }

    return syntaxObj;
  }

  async highlight(textNode) {
    if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
      textNode = document.createTextNode(textNode.textContent);
    }

    textNode = textNode || this.#textNode;
    if (!this.#textNode) this.#textNode = textNode;

    if (!this.#syntax || this.#syntax === 'html') {
      this.#defs = this.#defaultSyntaxDefs;
    } else {
      this.#defs = await this.#getSyntaxDefs(this.#syntax);
    }

    try {
      this.#doHighlights(this.#defs, textNode);
    } catch (error) {
      console.error("Error highlighting code: ");
      throw error; // Re-throw original error to preserve stack trace
    }
  }

  #setHighlight(ranges, key) {
    const highlightName = `${key}-${this.#id}`;
    const highlight = new Highlight(...ranges);
    CSS.highlights.set(highlightName, highlight);
  }

  setHighlights(syntax) {
    this.deleteCssHighlights();
    this.#syntax = syntax;
    this.highlight();
  }

  setPalette(map) {
    if (map instanceof Map && map.size === 0) {
      map = this.#defaultPalette;
    } else if (! (map instanceof Map)) {
      try {
        const parsed = JSON.parse(map);
        map = new Map(parsed);
      } catch (error) {
        return console.error( `Error setting palette: ${error}`, map);
      }
    }

    this.#palette = map;
    this.#createStyles();
  }

  #setRanges(regex, string, node) {
    const ranges = new Set();
    const matches = string.matchAll(regex);

    for (const match of matches) {
      // Avoid creating empty ranges
      if (match[0].length === 0) continue;

      const start = match.index;
      const end = start + match[0].length;
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.add(range);
    }

    return ranges;
  }
}

if (!customElements.get('a-code')) {
  customElements.define('a-code', ACode);
}
