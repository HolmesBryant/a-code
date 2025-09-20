/**
 * @class ACode
 * @extends HTMLElement
 * @description A custom element for displaying code snippets with consistent formatting and optional highlighting.
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 *
 * @example
 * <a-code>
 *   function () {
 *    return "This is some code";
 *   }
 * </a-code>
 */

export class ACode extends HTMLElement {
  /**
   * @private
   * @type AbortController
   * @description Used to remove event listeners when element is disconnected.
   */
  #abortController = new AbortController();

  #editorAbortController;

  /**
   * @private
   * @type boolean
   * @description Whether to make the content editable.
   * @comment Has public getter (edit)
   */
  #edit = false;

  /**
   * @private
   * @type boolean | string
   * @description If this is a string, either the name of the syntax to use for highlighting OR the importable url to the syntax file.
   *              The syntax file should be named "syntax.[name].js".
   *              For example, for HTML, this value would be either:
   *              "html", with the syntax file "syntax.html.js" in the same dir as a-code.js,
   *              OR "./path/to/syntax.html.js", with the syntax file located at that path.
   * @comment Has public getter (highlight)
   */
  #highlight = false;

  /**
   * @private
   * @type {Highlighter}
   * @description An instance of the Highlighter class
   */
  #highlighter;

  /**
   * @private
   * @type boolean
   * @description Whether to display the code inline.
   * @comment Has public getter (inline)
   */
  #inline = false;

  /**
   * @private
   * @type number | string
   * @description The number of spaces to represent a tab character. Can use most css length values.
   * @comment Has public getter (indent)
   */
  #indent;

  #lineNumbers = false;

  /**
   * @private
   * @type Number (milliseconds)
   * @description The last time a mutation event occurred.
   */
  #lastMutationTime = 0;

  /**
   * @private
   * @type boolean
   * @description Tracks if a content update is needed.
   */
  #needsUpdate = false;

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
  ];

  static template = `
    <style>
      :host {
        --indent: 1;
        --line-number-color: gray;
        --wrap: pre;
        display: block;
        max-width: 100%;
        vertical-align: middle;
      }

      section {
        display: grid;
        gap: .5rem;
        grid-template-columns: max-content 1fr;
      }

      .hidden
      { display: none; }

      .inline {
        display: inline;
        margin: 0;
        white-space: nowrap;
      }

      #content {
        font-family: "Courier New", monospace;
        margin: 0;
        tab-size: var(--indent);
        white-space: var(--wrap);
        width: 100%;
        max-width: 90vw;
        overflow: auto;
      }

      #line-numbers {
        color: var(--line-number-color);
        font-family: monospace;
        white-space: pre-line;
      }
    </style>

    <section>
      <div id="line-numbers"></div>
      <div id="content"><slot></slot></div>
    </section>
  `;

  /**
   * @constructor
   * @description Creates a new ACode instance and sets up its shadow DOM.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = ACode.template;
  }

  /**
   * Called when the element is inserted into the DOM.
   * @remarks Perform initial setup and establish event listeners after the element is connected.
   */
  connectedCallback() {
    const slot = this.shadowRoot.querySelector("slot");
    this.contentNode = this.shadowRoot.querySelector("#content");
    this.textContent = this.resetSpaces(this.getContent());
    if (this.highlight) this.highlightCode();
    if (this.lineNumbers) this.addLineNumbers();

    slot.addEventListener("slotchange", () => {
      this.updateIfNeeded();
    }, { signal: this.#abortController.signal });
  }

  /**
   * Called when attributes change.
   */
  attributeChangedCallback(attr, oldval, newval) {
    attr = attr.replace(/-./g, (match) => match.toUpperCase()[1]);
    this[attr] = newval;
  }

  /**
   * Called when the element is removed from the DOM. Cleans up resources and removes event listeners.
   */
  disconnectedCallback() {
    this.#abortController.abort();
    this.#editorAbortController.abort();
    this.#abortController = null;
    this.#editorAbortController = null;
  }

  addLineNumbers() {
    let i = 1;
    const container = this.shadowRoot.querySelector("#line-numbers");
    container.textContent = "";
    const lines = this.textContent.split(/\r?\n/).length;
    const div = document.createElement('div');
    for (i; i <= lines; i++) {
      const d = div.cloneNode();
      d.id="line-" + i;
      d.textContent = i;
      container.append(d);
    }
  }

  /**
   * Converts any string that would be rendered in the browser into plain text.
   *
   * @param   {string} html   - Any string
   * @returns {string}  - The html converted into plain text that will not be rendered.
   *
   * @test mod.convertHTML ( '<script>alert("foo")</script>' ) // '\x3Cscript>alert("foo")\x3C/script>'
   */
  convertHTML(html) {
    const elem = document.createElement("textarea");
    elem.innerHTML = html;
    return elem.value;
  }

  /**
   * Disables editing.
   *
   * @test mod.disableEdit(); return mod.contentNode.contentEditable // false
   */
  disableEdit() {
    this.contentNode.toggleAttribute('contentEditable', false);
  }

  /**
   * Destroys all current highlights.
   * @returns {string} The suffix used to identify the highlights used by this instance in the CSS HighlightRegistry
   *
   * @test mod.highlighter = 'html'; mod.destroyHighlights() // mod.highlighter
   */
  destroyHighlights() {
    try {
      return this.highlighter.removeAll();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Enables editing
   *
   * @test mod.enableEdit(); return mod.contentNode.contentEditable \\ true
   *
   */
  enableEdit() {
    // this.#editorAbortController = new AbortController();
    this.contentNode.toggleAttribute('contentEditable', true);
    // this.interceptKeyPress(this.contentNode);
    /*this.contentNode.addEventListener("input", (event) => {
      this.updateIfNeeded(500, event.target);
    }, { signal: this.#editorAbortController.signal } );*/
  }

  /**
   * Retrieves the content from the given element.
   * If no element is provided, it retrieves the content from `this` element.
   *
   * @param   {HTMLElement} [elem]  - The element from which to retrieve the content.
   * @returns {string} - The content of the element.
   *
   * @test mod.getContent( self ) // ""
   */
  getContent(elem = this) {
    if (this.children[0] && this.children[0].localName === 'textarea') {
      return this.textContent;
    } else {
      return this.convertHTML(this.innerHTML);
    }
  }

  /**
   * Highlights code using a specified syntax and applies it to an element.
   *
   * @param   {string}      syntax  - The syntax to use for highlighting.
   * @param   {HTMLElement} element - The element to highlight.
   * @throws  {Error}   - Throws Error if highlighter.highlight() fails.
   *
   * @test mod.highlight = 'html'; return mod.highlightCode ( 'html', self ) // true
   */
  async highlightCode(syntax = this.highlight, element = this) {
    try {
      return await this.highlighter.highlight(syntax, element.childNodes[0]);
    } catch (error) {
      throw error;
      return false;
    }
  }

  /**
   * Adds event listener to intercept key presses when editing is enabled
   * @param  {HTMLElement} element  - The element on which to add the event listener.
   */
  /*interceptKeyPress(element) {
    element.addEventListener(
      "keydown",
      (event) => {
        switch (event.key) {
          case "Tab":
            event.preventDefault();
            const ta = event.target;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const before = ta.value.substring(0, start);
            const after = ta.value.substring(end);
            ta.value = before + "\t" + after;
            ta.selectionStart = ta.selectionEnd = start + 1;
            const inputEvent = new Event("input");
            ta.dispatchEvent(inputEvent);
            break;
        }
      },
      { signal: this.#editorAbortController.signal }
    );
  }*/

  /**
   * Normalizes indentation in code blocks.
   *
   * @param {String} string - A string of code
   * @returns {string} The formatted code with normalized indentation.
   * @remarks Ensures consistent spacing within the code block, regardless of how the code was originally indented.
   *  - Reset the flag indicating an update is needed.
   *  - Replace leading spaces with tabs, trim extra whitespace, and split the content into lines.
   *  - Determine the number of leading whitespaces in the last line.
   *  - Create a regular expression to match the leading whitespace.
   *  - Remove the leading whitespace from each line and return the formatted code as a string.
   * @test mod.resetSpaces ( '\t\t\tfoo\t\t\t' ) // 'foo'
   */
  resetSpaces(string) {
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
   * Updates the text content of the element if needed.
   * @param {number}      delay   - The time delay within which to ignore changes.
   * @param {HTMLElement} elem    - The element whose content should be normalized.
   * @remarks Sets a flag to indicate an update is needed on the next call to this method.
   *          This helps prevent redundant updates during rapid changes.
   */
  updateIfNeeded(elem = this, delay = 500) {
    const currentTime = Date.now();
    if (this.#needsUpdate) {
      if (currentTime - this.#lastMutationTime > delay) {
        this.#lastMutationTime = currentTime;
        this.textContent = this.resetSpaces(this.getContent(elem));
        if (this.highlighter) this.destroyHighlights();
        if (this.lineNumbers) this.addLineNumbers();
        setTimeout(() => {
          if (this.highlight) this.highlightCode();
        }, 50);
      }
    } else {
      this.#needsUpdate = true;
    }
  }

  /**
   * Gets the value of the inline property
   * @returns {boolean}
   *
   * @test typeof mod.inline === 'boolean'  // true
   */
  get inline() {
    return this.#inline;
  }

  /**
   * Sets whether the code should be displayed inline or as a block.
   * @param {boolean | string} value  The new value for the inline property.
   *
   * @test mod.inline = false; return mod.inline // false
   * @test mod.setAttribute( 'inline', 'true' );
           return mod.inline;
       // true
   */
  set inline(value) {
    const node = this.shadowRoot.querySelector("pre");
    switch (value) {
      case "false":
      case false:
        value = false;
        this.removeAttribute("inline");
        if (node) node.classList.remove("inline");
        if (this.hasAttribute("line-numbers")) {
          this.lineNumbers = this.getAttribute("line-numbers");
        }
        break;
      default:
        value = true;
        if (node) node.classList.add("inline");
        this.lineNumbers = false;
        break;
    }

    this.#inline = value;
  }

  /**
   * Gets the value of the indent property
   * @returns {string | number}
   *
   * @test ( typeof mod.indent === 'string' || typeof mod.indent === 'number' ) // true
   */
  get indent() {
    return this.#indent;
  }

  /**
   * Sets the tab size for the code block, affecting its indentation.
   * @param {string | number} value - The width of a tab character. Can take numbers or most css length measurements.
   *
   * @test mod.indent = '2rem'; return mod.indent; // '2rem'
   * @test mod.setAttribute( 'indent', '5' ); return mod.indent; // '5'
   */
  set indent(value) {
    value =
    this.style.setProperty("--indent", value);
    this.#indent = value;
  }

  /**
   * Gets the value of the highlight property.
   * @returns {string}
   */
  get highlight() {
    return this.#highlight;
  }

  /**
   * Sets the value of the highlight property and updates the content if needed.
   * @param  {string} value Either a keyword, a url or a file path pointing to a syntax file.
   *
   * @test mod.highlight = false; return mod.highlight // false
   * @test mod.highlight = 'html'; return mod.highlight // 'html';
   * @test mod.setAttribute( 'highlight', 'false' ); return mod.highlight // false
   * @test mod.setAttribute( 'highlight', 'html' ); return mod.highlight // 'html'
   */
  set highlight(value) {
    switch (value) {
      case "false":
      case false:
        value = false;
        break;
      case "":
      value = "default";
      default:
        this.highlighter = this.highlighter || new Highlighter(this);
    }
    this.#highlight = value;
    if (this.contentNode) this.updateIfNeeded();
  }

  /**
   * Gets the edit property
   * @returns {Boolian}
   *
   * @test typeof mod.edit // 'boolean'
   */
  get edit() {
    return this.#edit;
  }

  /**
   * Sets the value of the edit property and enables editing of content
   * @param  {string | boolean}   value   Whether to enable editing.
   *
   * @test mod.setAttribute( 'edit', 'false' );
           return mod.edit;
           // false
   */
  set edit(value) {
    switch (value) {
      case "false":
      case false:
        this.#edit = false;
        if (this.contentNode) this.disableEdit();
        break;
      default:
        this.#edit = true;
        if (this.contentNode) {
          this.enableEdit();
        } else {
          customElements.whenDefined(this.localName).then((cls) => {
            this.enableEdit();
          });
        }
        break;
    }
  }

  /**
   * Gets value of lineNumbers property
   * @returns {boolean}
   */
  get lineNumbers() {
    return this.#lineNumbers;
  }

  /**
   * Sets the value of the lineNumbers property and either adds line numbers or removes them.
   * @param  {string | boolean} value Accepts strings ("true", "false", "") or boolean
   *
   * @test mod.lineNumbers = true; return mod.lineNumbers; // true
   * @test mod.lineNumbers = false; return mod.lineNumbers; // false
   * @test mod.lineNumbers = null; return mod.lineNumbers; // true
   * @test mod.setAttribute ( 'line-numbers', 'true' ); return mod.lineNumbers // true
   * @test mod.setAttribute ( 'line-numbers', '' ); return mod.lineNumbers; // true
   * @test mod.setAttribute ( 'line-numbers', 'false' ); return mod.lineNumbers; // false
   */
  set lineNumbers(value) {
    const container = this.shadowRoot.querySelector("#line-numbers");
    switch (value) {
      case "false":
      case false:
        this.#lineNumbers = false;
        container.textContent = "";
        break;
      default:
        this.#lineNumbers = true;
        if (this.contentNode) this.updateIfNeeded();
        break;
    }
  }

  /**
   * Gets the custom color palette, if there is one.
   * @returns {Map | false} The custom highlighter palette
   *
   * @test mod.palette === false || mod.palette instanceof Map // true
   */
  get palette() {
    if (this.highlighter) return this.highlighter.palette;
    return false;
  }

  /**
   * Set custom color palette for code highlighting.
   * @param  {String|Array|Map}   value   The new palette definitions. Array must be a two dimensional array where each entry is a key => value pair. String must be JSON string representing a two dimensional Array.
   *
   * @test mod.highlight = 'html';
      mod.setAttribute( 'palette', '[["property", "color"]]' );
      return mod.highlighter.palette instanceof Map // true
   *
   * @test const val = mod.palette = false; return val; // false
   */
  set palette(value) {
    if (this.highlighter) {
      this.highlighter.palette = value;
    } else {
      console.error("highlighter has not been initialized");
    }
  }
}

/**
 * @class Highlighter
 * @summary Uses CSS Custom Highlight API to highlight ranges of text in different colors.
 * @author Holmes Bryant <webbmaastaa@gmail.com>
 * @license GPL-3.0
 */
export class Highlighter {
  #palette;
  container;
  suffix = "_" + Math.random().toString(36).substring(2, 15);
  defaultColors = new Map([
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

  defaultSyntaxDef = {
    // css function argument
    argument: /(?<=\()[^)]+/g,

    // css function
    function: /[\w-]+\s*\(|\)/g,

    operator: /[>+~*,*\/=]|(?<!\w[-])/g,

    // normal css property
    property: /(?<!}[\r\n\s]+)\b([\w\d-]+:(?!:))/g,

    number: /(?<!\w)[#+-.]?\d+[%\b\.\w]*/g,

    // HTML tag
    tag: /<\/?[\w-]+|(?<=[\w"])>/g,

    string: /["'`][^"'`]*["'`]/g,

    // css custom property
    variable: /--[\w\d]+-?[\w\d]*/g,

    comment: /(<!--|\/\*)([\s\S]*?)(-->|\*\/)/g,

    // css media query
    keyword: /@[\w]+\b/g
  };

  /**
   * Creates a new instance.
   * @param {HTMLElement} element - The container element for the instance.
   * @param {Palette} palette - The palette object to use.
   * @returns {Highlighter} - The new instance.
   */
  constructor(element, palette) {
    this.container = element;
    this.palette = palette;
    return this;
  }

  /**
   * Highlights the specified text node using the provided syntax rules.
   * @param   {string}  syntax    - The syntax to use for highlighting.
   * @param   {Text}    textNode  - The text node to highlight. If not provided, uses the first child node of the container element.
   * @throws  {Error}   - If the browser does not support CSS Custom Highlight API,
   *                      or there is a problem retrieving the syntax definition.
   *
   * @test (self => {
      return async function (self) {
        return await mod.highlight('html', new Text(''));
      }()
     })(self) // true
   */
  async highlight(syntax = "html", textNode) {
    if (typeof window.Highlight === "undefined") {
      throw new Error("Browser does not support CSS Custom Highlight API");
    }

    textNode =
      textNode || this.container.childNodes[0] || document.createTextNode("");

    const styleId = `highlights${this.suffix}`;
    const existingStyle = document.head.querySelector(`#${styleId}`);
    if (!existingStyle) document.head.append(this.getStyle());

    try {
      const defs = await this.getSyntax(syntax);
      this.highlightCode(defs, textNode);
      return true;
    } catch (error) {
      console.error("Error loading Highlight Syntax: ", error);
      throw error;
    }
  }

  /**
   * Retrieves the syntax object for the specified syntax.
   * If a string is provided, it attempts to import the syntax module dynamically.
   *
   * @param   {string|Syntax}   - syntax - The syntax string or syntax object.
   * @returns {Promise<Syntax>}   - A promise that resolves to the syntax object.
   * @throws  {Error}       - If there was an error loading the syntax module.
   *
   * @test (self => {
   *       return async function (self) {
   *        const mod = await mod.getSyntax();
   *        return typeof mod;
   *       }
   * })(self) // 'object'
   */
  async getSyntax(syntax = this.highlight) {
    if (syntax === "default" ) {
      return this.defaultSyntaxDef;
    }

    if (typeof syntax === "string") {
      let url = syntax;
      const regex = /^(http|\.|\/)/;
      if (!regex.test(syntax)) url = `./syntax.${syntax}.js`;

      try {
        syntax = await import(url);
      } catch (error) {
        throw error;
      }
    }

    return syntax.default;
  }

  /**
   * Highlights the code within the specified text node using the provided syntax rules.
   *
   * @param   {Object}   syntax={}  The syntax rules for highlighting.
   * @param   {Text}     textNode   The text node containing the code to be highlighted.
   * @returns {Set<Range>}      A set of Range objects representing the highlighted code ranges.
   * @throws  {Error}         If the second argument is not a TEXT_NODE.
   *
   * @test mod.highlightCode({}, new Text('')) === true // true
   */
  highlightCode(syntax = {}, textNode) {
    if (textNode.nodeType !== Node.TEXT_NODE) {
      throw new Error(
        `Second argument must be a TEXT_NODE (3). Given nodeType is (${textNode.nodeType})`
      );
    }

    let ranges;
    const string = textNode.textContent;

    for (const prop of Object.keys(syntax)) {
      const value = syntax[prop];

      if (!value) {
        continue;
      } else if (Array.isArray(value)) {
        // Array of key words
        // Set() removes duplicate words
        const words = [...new Set(value)].join("|");
        const regex = new RegExp(`\\b(${words})\\b`, "g");
        ranges = this.setRanges(regex, string, textNode);
      } else if (value instanceof Function) {
        // function returning flat array of range objects
        ranges = new Set(value(string, textNode));
      } else if (value instanceof RegExp) {
        // regular expression
        ranges = this.setRanges(value, string, textNode);
      } else {
        console.error(`Invalid syntax definition for ${prop}: `, `"${value}"`);
        throw new Error(`Invalid syntax definition for ${prop}`);
      }

      this.setHighlight(ranges, prop);
    }

    return true;
  }

  /**
   * Sets ranges based on the provided regular expression and string within the specified node.
   *
   * @param   {RegExp}  regex   The regular expression to match against the string.
   * @param   {string}  string  The string to search for matches.
   * @param   {Node}    node  The node within which the ranges will be set.
   * @returns {Set<Range>}    A set of Range objects representing the matched ranges.
   *
   * @test mod.setRanges(/\w/, '', new Text('')) instanceof Set // true
   */
  setRanges(regex, string, node) {
    const ranges = new Set();
    const matches = string.matchAll(regex);

    for (const match of matches) {
      const start = match.index;
      const end = start + match[0].length;
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.add(range);
    }

    return ranges;
  }

  /**
   * Retrieves the CSS highlights associated with the current suffix.
   * @returns {Map<string, object>} - A map containing the CSS highlights entries.
   *
   * @test mod.getHighlights() instanceof Map // true
   */
  getHighlights() {
    const entries = new Map();
    CSS.highlights.forEach((highlight, name) => {
      if (name.endsWith(this.suffix)) {
        entries.set(name, highlight);
      }
    });
    return entries;
  }

  /**
   * Sets highlights for the specified ranges using the provided type.
   *
   * @param   {Array<Range>}  ranges    An array of Range objects representing the ranges to apply highlights to.
   * @param   {String}    type='test' The type of highlights to apply. Defaults to 'test'.
   * @returns {Boolean}           True on success, False on failure
   *
   * @test mod.setHighlight([new Range()]) // true
   */
  setHighlight(ranges, type = "test") {
    // Add this.suffix to isolate entries in the CSS Highlights Registry
    // Otherwise, highlights between instances interfere with each other
    type = type + this.suffix;
    const highlighter = new Highlight(...ranges);
    try {
      CSS.highlights.set(type, highlighter);
      return true;
    } catch (error) {
      throw error;
      return false;
    }
  }

  /**
   * Creates and returns a style element containing the CSS styles for highlights.
   * @returns {HTMLStyleElement} - The created style element.
   *
   * @test mod.getStyle() instanceof HTMLStyleElement // true
   */
  getStyle() {
    const style = document.createElement("style");
    let content = "";
    style.id = `highlights${this.suffix}`;
    this.palette.forEach((color, key) => {
      content += `::highlight(${key}${this.suffix}) { color: ${color}}\n`;
    });

    style.textContent = content;
    return style;
  }

  /**
   * Removes the highlights associated with the specified type.
   *
   * @param {string} type   The type of highlights to remove.
   *
   */
  remove(type) {
    CSS.highlights.delete(type + this.suffix);
  }

  /**
   * Removes all highlights associated with the current suffix.
   *
   * @returns {string}  The suffix used to identify highlights on an instance
   */
  removeAll() {
    CSS.highlights.forEach((highlight, name) => {
      if (name.endsWith(this.suffix)) {
        CSS.highlights.delete(name);
      }
    });

    return this.suffix;
  }

  /**
   * Clears the CSS highlights registry.
   */
  clearRegistry() {
    CSS.highlights.clear();
  }

  /**
   * Logs the entries in the CSS highlights registry to the console.
   */
  logRegistry() {
    CSS.highlights.forEach((highlight, name) => {
      console.log(name, highlight);
    });
  }

  /**
   * Gets the color palette for the current instance.
   *
   * @test mod.palette instanceof Map // true
   */
  get palette() {
    return this.#palette || this.defaultColors;
  }

  /**
   * Sets the palette for the current instance.
   *
   * @param {Array.<string>|Map.<string, string>|string} value -  The palette data.
   *   - If an array is provided, it will be converted to a Map with key-value pairs.
   *   - If a Map is provided, it will be used directly.
   *   - If a string is provided, it will be parsed as JSON and converted to a Map (if valid).
   *   - If the value is null, undefined, or an empty string, the palette will be cleared.
   *
   * @throws {SyntaxError} If the provided string cannot be parsed as valid JSON.
   *
   * @test (self => { mod.palette = null; return mod.palette !== null})(self) // true
   * @test (self => { mod.palette = [["property":"color"]]; return mod.palette })(self) // mod.palette instanceof Map
   * @test (self => {
          mod.palette = new Map([["property", "color"]]);
          return mod.palette instanceof Map;
    })(self) // true
    *
    * @test (self => {
           mod.setAttribute('palette', '[["property", "color"]]');
           return mod.palette instanceof Map;
     })(self) // true
    *
    * @test (self => {
    *       mod.settAttribute('palette', '');
    *       return mod.palette !== '';
    * })(self) // true
   */
  set palette(value) {
    let map;
    const style = document.head.querySelector(`#highlights${this.suffix}`);

    if (!value || value === "" || value === undefined) {
      this.#palette = null;
    } else if (Array.isArray(value)) {
      map = new Map(value);
    } else if (value instanceof Map) {
      map = value;
    } else {
      try {
        value = JSON.parse(value);
        map = new Map(value);
      } catch (error) {
        console.error(error);
      }
    }

    this.#palette = map;
    const newStyle = this.getStyle();
    if (!style) {
      document.head.append(newStyle);
    } else {
      document.head.replaceChild(newStyle, style);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!customElements.get('a-code')) {
    customElements.define('a-code', ACode);
  }
});


