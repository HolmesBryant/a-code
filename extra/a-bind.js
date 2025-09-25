export default class ABind extends HTMLElement {
	#o;
	#object = false;
	#p;
	#property = false;
	#e;
	#event = 'input';
	#a;
	#attribute = 'value';
	#oa;
	#objectAttribute = false;
	#f;
	#func = false;
	#oneway = false;
	#once = false;

	abortController;
	elem;
	model;
	hasUpdated = false;

	static observedAttributes = [
		'o',
		'object',
		'p',
		'property',
		'e',
		'event',
		'a',
		'attribute',
		'f',
		'func',
		'oa',
		'object-attribute',
		'oneway',
		'once'
	];

	constructor() {
		super();
		if (!window.abind) window.abind = ABind;
	}

	attributeChangedCallback(attr, oldval, newval) {
		this[attr] = newval;
	}

	async connectedCallback() {
		if (!this.object) return console.error('a-bind requires an object to bind to: object="..." or o=""...');
		this.elem = this.children[0];
		if (!this.elem) return console.error('a-bind element must have one child which is an HTML element', this);
		this.model = await this.getModel(this.object);
		if (!this.model) return; // getModel logs error
		this.abortController = new AbortController();
		const attrs = this.attribute.split(/[,\s]+/);
		for (const attr of attrs) this.setElemAttr(attr.trim());
		this.addElemListeners();
	}

	disconnectedCallback() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}

	addElemListeners() {
		if (!this.property in this.model && ! this.property.startsWith('--')) {
			return console.error(`${Object.prototype.toString.call(object)} does not have property ${property}`);
		}

		this.elem.addEventListener(this.event, (event) => {
			event.preventDefault();
			this.doEvent(event);
		}, { signal: this.abortController.signal });

		document.addEventListener('abind', event => {
			if (this.model !== event.detail.obj) return;
			if (this.property !== event.detail.prop) return;
			if (
				this.objectAttribute &&
				this.model.constructor.observedAttributes !== undefined &&
				this.model.constructor.observedAttributes.indexOf(this.objectAttribute) === -1
			)
			{return};

			if (this.once && this.hasUpdated) return;
			/*if (event.prop === 'editable') {
				console.log(this.once, this.hasUpdated)
			}*/

			const attrs = this.attribute.split(',');
			for (let attr of attrs) {
				attr = attr.trim();
				this.setElemAttr(attr, event.detail.value);
			}
			this.hasUpdated = true;
		}, { signal: this.abortController.signal });
	}

	doEvent(event) {
		let pchain, fchain, presult, fresult;
		const object = this.model;
		const property = this.property;
		const elem = this.elem;
		const attribute = this.attribute;

		if (property && property.startsWith('--')) {
			// property is likely a css variable (custom property)
			object.style.setProperty(property, elem[attribute]);
		} else if (elem.localName === 'select' && elem.hasAttribute('multiple')) {
			// elem is a select[multiple] element
			object[property] = Array.from(elem.selectedOptions).map(option => option.value)
		} else if (elem.type === "checkbox") {
			object[property] = elem.checked ? elem[attribute] : "";
		} else if (property && property.indexOf('.') > -1) {
			// property is a chain ie. property.subproperty
			pchain = property.split('.');
			presult = pchain.shift();
			for (const key of pchain) {
				if (object[key] !== undefined) presult = presult[key];
			}
		} else {
			object[property] = elem[attribute];
		}

		if (this.func) {
			const args = this.func.split(':');
			let func = args.shift();
			args.push(elem[attribute]);

			if (func.indexOf('.') > -1) {
				fchain = func.split('.');
				func = fchain.shift();
			}
			if (object[func] === undefined && window[func] === undefined) {
				const name = object.localName || Object.prototype.toString.call(object);
				return console.error(`${name} does not have function: ${func}`);
			}

			if (fchain) {
				// func is a chain ie. console.log
				if(window[func]) fresult = window[func];
				for (const key of fchain) {
					if (fresult[key] !== undefined) fresult = fresult[key];
				}
				fresult(...args);
			} else if(window[func]) {
				window[func](...args);
			} else {
				object[func].call(object, ...args);
			}
		}
	}

	setElemAttr(attr, value) {
		if (this.oneway) return;
		if (this.elem[attr] === value) return;
		if (this.property && this.property.startsWith('--') && this.model instanceof HTMLElement) {
			// its a css custom property;
			const styles = getComputedStyle(this.model);
			value = styles.getPropertyValue(this.property);
		} else if (this.property && this.property.indexOf('.' > -1)) {
			// property is a chain ie. obj.foo.bar
			let result;
			const chain = this.property.split('.');
			for (const key of chain) {
				if (this.model[key] !== undefined) result = this.model[key];
			}
			value = result;
		} else if (this.objectAttribute) {
			value = (this.model.getAttribute)? this.model.getAttribute(this.objectAttribute) : "";
		} else {
			value = value || this.model[this.property];
		}

		switch (this.elem.localName) {
		case 'input':
			if (this.elem.type === "checkbox") {
				this.elem.checked = this.elem.value === value.toString();
				break;
			}

			if (this.elem.type === "radio") {
				this.elem.checked = this.elem.value == value.toString();
				break;
			}

			if (this.elem.type === "file") return;

			if (value !== undefined) this.elem[attr] = value;
			break;
		case 'select':
			if (this.elem.hasAttribute('multiple')) {
				// The value of Object properties bound to <select multiple> elements must be an Array or comma|space delimited string.
				try {
					const arr = Array.isArray(this.model[this.property]) ? this.model[this.property] : this.model[this.property].split(/[,\s]+/);
		    	for (const option of this.elem.options) option.selected = arr.indexOf(option.value) > -1;
				} catch (e) {
					console.error(`Error: ${this.object}:${this.property}, ${this.attribute}:${value}`, e);
				}
			} else if (value !== undefined) {
				this.elem[attr] = value;
			}
			break;
		default:
			if (attr.startsWith('style.')) {
				const sProp = attr.split('.').pop();
				this.elem.style[sProp] = value;
			} else {
				if (value !== undefined) this.elem[attr] = value;
			}
		}
	}

	static update(obj, prop, value) {
		const evt = new CustomEvent( 'abind', { detail: {obj:obj, prop:prop, value:value}} );
		document.dispatchEvent(evt);
	}

	async getModel(objName, wait = 1) {
		let name, id = '';
		if (objName.startsWith('#')) {
			const elem = document.querySelector(objName);
			if (!elem) throw new Error(`${objName} not found`);
			if (elem instanceof HTMLElement) name = elem.localName;
			id = objName;
		} else {
			name = objName;
		}

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
	      console.error(`Timeout: ${objName} not found.`);
	      resolve(null);
      }, wait * 1000);

      if (window[name]) {
      	// JS Objects must be declared with `var` (not: `const` or `let`);
	      clearTimeout(timeoutId);
      	resolve(window[name]);
      } else if (customElements.get(name)) {
      	// target is custom element and has been registered
	      clearTimeout(timeoutId);
	      resolve(document.querySelector(name + id));
      } else {
      	// target is custom element and has not yet been registered
	      customElements.whenDefined(name).then(() => {
	        clearTimeout(timeoutId);
	        resolve(document.querySelector(name + id));
	      }).catch((error) => {
	        clearTimeout(timeoutId);
	        console.error(`Error: ${name} ${id} is not a valid javascript object, function or custom element`);
	        resolve(null);
	      });
      }
    });
	}

	get o() { return this.#object }
	set o(value) { this.#object = value }

	get object() { return this.#object }
	set object(value) { this.#object = value }

	get p() { return this.#property }
	set p(value) { this.#property = value }

	get property() { return this.#property }
	set property(value) { this.#property = value }

	get e() { return this.#event }
	set e(value) { this.#event = value; }

	get event() { return this.#event }
	set event(value) { this.#event = value }

	get a() { return this.#attribute }
	set a(value) { this.#attribute = value }

	get attribute() { return this.#attribute }
	set attribute(value) { this.#attribute = value }

	get f() { return this.#func }
	set f(value) { this.#func = value }

	get func() { return this.#func }
	set func(value) { this.#func = value }

	get oa() { return this.#objectAttribute }
	set oa(value) { this.objectAttribute = value}

	get objectAttribute() { return this.#objectAttribute }
	set objectAttribute(value) {
		const hasUpperCase = /[\p{Lu}]/u.test(value);
		if (hasUpperCase) {
			console.warn(`An item binds to an object attribute but the value contains upper case characters. Attribute names are normally lower-kebab-case. Make sure you are binding to an attribute instead of a property:`, value, this);
		}
		this.#objectAttribute = value;
	}

	get oneway() { return this.#oneway }
	set oneway(value) {
		value = value !== "false" && value !== false;
		this.#oneway = value
	}

	get once() { return this.#once }
	set once(value) {
		value = value !== false && value !== 'false';
		this.#once = value;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	if (!customElements.get('a-bind')) {
		customElements.define('a-bind', ABind);
	}
});
