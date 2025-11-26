/**
 * @class ATabset
 * @extends HTMLElement
 * A custom element that creates a tabbed interface.
 */
export default class ATabset extends HTMLElement {
  // Attributes

  /**
   * The orientation of the tabset. Acceptable values are "row", "row-reverse", column", "column-reverse".
   * @type {String}
   */
  _direction = "row";

  /**
   * The index of the currently active tab (1-based).
   * @type {number}
   * @private
   * @default 1
   */
  _active = 1;

  // Private

  #abortController;

  #contents;

  #main;

  #tabs;

  // Public

  /**
   * The observed attributes for this element.
   * @static
   * @type {string[]}
   */
  static observedAttributes = ['direction', 'active'];

  /**
   * The template for the tabset's shadow DOM.
   * @static
   * @type {string}
   */
  static template = `
    <style>
      :host {
        --justify: stretch;
        --pad: .5rem;
        --transition: .25s;
        --height: 100%;
        display: block;
        min-height: var(--height);
      }

      main {
        display: flex;
        flex-direction: column;
        height: inherit;
        overflow: hidden;
      }

      main.tabset-column { flex-direction: row; }
      main.tabset-column-reverse { flex-direction: row-reverse; }

      main.tabset-column nav,
      main.tabset-column-reverse nav { flex-direction: column; }

      main.tabset-row-reverse nav { flex-direction: row-reverse; }

      nav {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: var(--justify);
        position: relative;
        z-index: 1;
      }

      #content {
        box-sizing: border-box;
        flex: 2;
        height: inherit;
        position: relative;
        z-index: 0;
      }

      ::slotted(.a-tabset-tab) {
        box-sizing: content-box;
        cursor: pointer;
        height: 100%;
        position: relative;
        text-align: center;
        top: 1px;
        z-index: 1;
      }

      ::slotted(.a-tabset-tab.active) {
        top: 1px;
      }

      ::slotted(.a-tabset-tab.tabset-column),
      ::slotted(.a-tabset-tab.tabset-column-reverse) {
        flex: 0;
        top: 0;
        width: 100%;
      }

      ::slotted(.a-tabset-tab.tabset-column.active) {
        width: 100.5%;
      }

      ::slotted(.a-tabset-tab.tabset-column-reverse.active) {
        left: -1px;
      }

      ::slotted(.a-tabset-content) {
        box-sizing: border-box;
        height: inherit;
        left: 0;
        opacity: 0;
        position: absolute;
        top: 0;
        transition: opacity var(--transition);
        width: 100%;
        z-index: -1;
      }

      ::slotted(.a-tabset-content.active) {
        position: relative;
        display: block;
        opacity: 1;
        z-index: 1;
      }
    </style>

    <main part="main">
      <nav part="tabs">
        <slot name="title"></slot>
      </nav>

      <div id="content" part="content">
        <slot name="content"></slot>
      </div>
    </main>
  `;

  /**
   * @constructor
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = ATabset.template;
  }

  /**
   * Called when an observed attribute changes.
   * @param {string} attr The name of the attribute.
   * @param {string} oldval The old value of the attribute.
   * @param {string} newval The new value of the attribute.
   */
  attributeChangedCallback(attr, oldval, newval) {
    this[attr] = newval;
  }

  /**
   * Called when the element is connected to the DOM.
   */
  connectedCallback() {
    this.#abortController = new AbortController();
    this.#main = this.shadowRoot.querySelector('main')
    this.#tabs = this.querySelectorAll('[slot="title"]');
    this.#contents = this.querySelectorAll('[slot="content"]');
    this.setDirection(this.direction);
    this.renderTabs();
    this.selectTab(this.active);
  }

  /**
   * Called when the element is disconnected from the DOM.
   */
  disconnectedCallback() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    this.#contents = null;
    this.#tabs = null;
    this.#main = null;
  }

  async fetchData(elem, src) {
    fetch(src).
    then( response => response.text())
    .then( text => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      elem.innerHTML = doc.body.innerHTML;
    })
    .catch (error => {
      console.error(error);
    });
  }

  handleClick(event) {
    const idx = Array.from(this.#tabs).indexOf(event.target) + 1;
    this.active = idx;
  }

  /**
   * Sets the orientation of the tabset
   */
  setDirection(value) {
    const allowed = ['tabset-row', 'tabset-column', 'tabset-row-reverse', 'tabset-column-reverse'];
    if (!this.#main) return;
    this.#main.className = `tabset-${value}`;
    for (const tab of this.#tabs) {
      tab.classList.remove(...allowed);
      tab.classList.add(`tabset-${value}`);
    }
  }

  /**
   * Renders the tabs and their corresponding content.
   */
  renderTabs() {
    if (!this.#tabs) return;
    for (const tab of this.#tabs) {
      tab.classList.add('a-tabset-tab');
      tab.addEventListener('click', event => {
        this.handleClick(event);
      }, { signal: this.#abortController.signal });
    }

    for (const content of this.#contents) {
      content.classList.add('a-tabset-content');
    }
  }

  /**
   * Selects a tab by its index.
   * @param {number} index The index of the tab to select (1-based).
   */
  selectTab(index) {
    if (!this.#tabs) return;
    const realIndex = index - 1;
    if (index > this.#tabs.length || index < 1) return;

    for (let i = 0; i < this.#tabs.length; i++) {
      // if content element has a data-src attribute, fetch the data
      const datasrc = this.#contents[i].dataset.src;
      this.#contents[i].classList.toggle('active', i === realIndex);
      this.#tabs[i].classList.toggle('active', i === realIndex);
      if (i === realIndex) {
        this.#tabs[i].classList.add('active');
        if (datasrc) this.fetchData(this.#contents[i], datasrc);
      } else {
        this.#tabs[i].classList.remove('active');
        if (datasrc) {
          const children = this.#contents[i].children;
          for (const child of children) child.remove();
        }
      }
    }

    if (index !== this.active) this.active = index;
  }

  /**
   * Gets the current direction value.
   * @returns {string} The current direction value.
   */
  get direction() { return this._direction; }

  /**
   * Sets the direction value and calls setDirection().
   * @param {string} value The new direction value.
   */
  set direction(value) {
    this._direction = value;
    this.setDirection(value);
  }

  /**
   * Gets the index of the currently active tab (1-based).
   * @returns {number} The index of the currently active tab.
   */
  get active() { return this._active; }

  /**
   * Sets the index of the active tab (1-based).
   * @param {number} value The new active tab index.
   */
  set active(value) {
    value = +value;
    this._active = value;
    this.selectTab(value);
  }
}

if (!customElements.get('a-tabset')) {
  customElements.define('a-tabset', ATabset);
}
