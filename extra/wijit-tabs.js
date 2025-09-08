/**
 *  A web component that creates a tab set with a variety of effects.
 *	Include equal number of panels and controls.
 *	Controls must have attribute slot='controls'.
 *	The first control activates the first panel, ect.
 *	Controls are optional. You don't have to include them if you don't want them.
 *	The panels can also be swiped on touch devices.
 *
 * @author Holmes Bryant <webbmaastaa@gmail.com>
 * @license GPL-3.0
 *
 * @property {string} effect - The effect to use for the carousel. Valid values are "slide", "fade", and "flip".
 * @property {boolean} auto - Whether to automatically play the carousel.
 * @property {number} repeat - The number of times to repeat the carousel.
 * @property {number} speed - The speed of the carousel in seconds.
 * @property {number} pause - The pause between slides in seconds.
 * @property {string} activeindicator - The class to add to the active indicator.
 *
 *	@example:
 *	<wijit-tabs>
 *	    <button slot="controls">Tab One</button>
 *	    <div>Panel One</div>
 *
 *	    <button slot="controls">Tab Two</button>
 *	    <div>Panel Two</div>
 *	</wijit-tabs>
 */
export class WijitTabs extends HTMLElement {
	/**
	 * The available effects for the carousel.
	 * @private
	 */
	#effects = ['slide', 'fade', 'flip'];

	/**
	 * The current effect being used.
	 * @private
	 */
	#effect = 'fade';

	/**
	 * The speed of each transition in seconds.
	 * @private
	 */
	#speed = '.25s';

	/**
	 * Whether to automatically play the carousel.
	 * @private
	 */
	#auto = false;

	/**
	 * The number of times to repeat the carousel. 0 means repeat infinitly.
	 * @private
	 */
	#repeat = 0;

	/**
	 * The pause between slides in seconds.
	 * @private
	 */
	#pause = 3;

	/**
	 * Whether to make the automatically generated controls visible
	 * @private
	 */
	#autocontrols = false;

	/**
	 * The class to add to the active tab.
	 * @private
	 */
	#activeindicator = 'active-tab';

	/**
	 * The shadow root of the custom element.
	 * @private
	 */
	shadow = ShadowRoot;

	/**
	 * The panel element that holds the slides.
	 * @private
	 */
	panel;

	/**
	 * The slides of the carousel.
	 * @private
	 */
	slides;

	/**
	 * The controls of the carousel.
	 * @private
	 */
	controls;

	/**
	 * The current iteration of the carousel. Used for autoPlay
	 * @private
	 */
	iteration = 1;

	/**
	 * An object to store the old and new values of attributes.
	 * @private
	 */
	#bag = {};

	observers = [];

	/**
	 * An array of attributes to observe for changes.
	 * @static
	 */
	static observedAttributes = ['effect', 'auto', 'repeat', 'speed', 'pause', 'autocontrols', 'activeindicator'];

	/**
	 * Constructs a new WijitCarousel instance.
	 */
	constructor() {
		super();
		this.shadow = this.attachShadow({mode: 'open'});
		this.shadow.innerHTML = `
		<style>
			:host {
				display: block;
				height: 100%;
				position: relative;
				scroll-behavior: smooth;
				width: 100%;
				--speed: ${this.speed}s;
			}

			::slotted([slot=carda]),
			::slotted([slot=cardb]) {
				height: 100%;
				width: 100%;
				object-fit: cover;
			}

			#container {
				all: inherit;
				align-items: center;
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
				perspective: 1800px;
				position: relative;
			}

			#container.flip { overflow: unset; }

			#panel {
				all: inherit;
				display: block;
				height: 100%;
				overflow: visible;
				position: relative;
				transition-property: all;
				transform-style: preserve-3d;
				white-space: nowrap;
				width: 100%;
			}

			#panel.smooth { transition-duration: var(--speed); }

			#container.flip #carda,
			#container.flip #cardb {
				height: 100%;
				overflow: hidden;
				position: absolute;
				backface-visibility: hidden;
				width: 100%;
			}

			#container.flip #carda { transform: rotateY(0deg); }
			#container.flip #cardb { transform: rotateY(180deg); }

			#carda,
			#cardb {
				border-radius: inherit;
				display: inline-block;
				height: 100%;
				overflow: hidden;
				vertical-align: top;
				width: 100%;
			}

			#controls {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-end;

			}

			.hidden { display: none; }

			/* Touch devices */
			/*@media (hover: none) {
				.scroller { overflow-x: auto; }
			}*/
		</style>

		<div id="controls" part="controls">
			<slot name="controls"></slot>
		</div>
		<div id="container" part="container">
			<div id="panel" part="panel" class="smooth">
				<div id="carda" part="card"><slot name="carda"></slot></div>
				<div id="cardb" part="card"><slot name="cardb"></slot></div>
			</div>
		</div>
		<div id="slides" class="hidden" aria-hidden="true"><slot></slot></div>
		`;
	}

	/**
	 * Called when an attribute of the custom element changes.
	 *
	 * @param {string} attr The name of the attribute that changed.
	 * @param {string} oldval The old value of the attribute.
	 * @param {string} newval The new value of the attribute.
	 */
	attributeChangedCallback(attr, oldval, newval) {
		const old = oldval || this[attr];
		this.#bag[attr] = {new:newval, old:old};
		this[attr] = newval;
	}

	/**
	 * Called after the custom element is inserted into the document.
	 */
	connectedCallback() {
		this.container = this.shadow.querySelector('#container');
		this.panel = this.shadow.querySelector('#panel');
		this.cardA = this.shadow.querySelector('#carda');
		this.cardB = this.shadow.querySelector('#cardb');
		this.slides = [...this.children].filter (item => !item.hasAttribute('slot'));
		this.controls = this.querySelectorAll('*[slot=controls]');
		this.slides[0].setAttribute('slot', 'carda');

		this.effect = this.getAttribute('effect') || this.effect;
		this.speed = this.getAttribute('speed') || this.speed;

		if (this.controls.length === 0) this.createControls();
		this.initControls();
	}

	/**
	 * Creates the controls for the carousel for internal use if user did not include them.
	 */
	createControls() {
		const frag = new DocumentFragment();
		const input = document.createElement('input');
		input.type = 'radio';
		input.name = 'c' + Math.random();
		input.setAttribute('slot', 'controls');

		if (!this.autocontrols) {
			input.setAttribute('aria-hidden', 'true');
			input.setAttribute('hidden', 'true');
		}

		this.slides.forEach ( slide => {
			const control = input.cloneNode(true);
			frag.append(control);
		});

		this.controls = frag.querySelectorAll('input');
		this.controls[0].checked = true;
		this.append(frag);
	}

	/**
	 * Initializes the carousel controls if user supplies them
	 */
	initControls() {
		for (let i = 0; i < this.controls.length; i++) {
			// if there are more controls than panels, ignore the extra controls.
			if (!this.slides[i]) continue;
			this.slides[i].setAttribute('data-panel', i);
			this.controls[i].setAttribute('data-target', i);
			this.controls[i].addEventListener('click', evt => {
				// preventDefault prevents inputs from being auto focused;
				if (evt.target.localName !== 'input') evt.preventDefault();

				for (const control of this.controls) {
					control.classList.remove(this.activeindicator);
					if (this.#bag.activeindicator) {
						control.classList.remove(this.#bag.activeindicator.old);
					}
				}

				// if the control was clicked by a human, turn off autoPlay
				if (evt.isTrusted) this.stopAuto();
				evt.target.classList.add(this.activeindicator);
				this.transition(evt);
			});
		}
	}

	/**
	 * Transitions the carousel to the next slide.
	 *
	 * @param {Event} event The click event that triggered the transition.
	 */
	transition(event) {
		const rando = this.#effects[Math.floor(Math.random() * this.#effects.length)];
		const effect = (this.effect === 'random') ? rando : this.effect;

		// Update the `effect` property with the new effect.
		this.#bag.effect.old = this.#bag.effect.new;
		this.#bag.effect.new = effect;

		// Disable controls during the transition.
		this.disableControlsDuringTransition();

		// If the effect has changed, initialize the new effect.
		if (this.#bag.effect.old !== this.#bag.effect.new) {
			this.initEffect(effect);
		}

		switch (effect) {
		case 'slide':
			this.slideEffect(event);
			break;
		case 'flip':
			this.flipEffect(event);
			break;
		default:
			this.fadeEffect(event);
			break;
		}
	}

	/**
	 * Initializes the specified effect for the carousel.
	 *
	 * @param {string} effect The effect to initialize.
	 */
	initEffect(effect) {
		const activeCard = this.panel.children[0].id || 'carda';
		const otherCard = this.panel.children[1].id || 'cardb';

		// Get the active and other card elements.
		const activeElem = this.querySelector(`*[slot=${activeCard}]`);
		const otherElem = this.querySelector(`*[slot=${otherCard}]`);

		// If no active Element is found, use otherElem as the active Element.
		const elem = activeElem || otherElem;

		// Move the active element to the `carda` slot.
		elem.setAttribute('slot', 'carda');

		// Remove any existing transform styles from the panel.
		this.panel.style.removeProperty('transform');

		switch (effect) {
		case 'slide':
		  this.container.classList.remove('flip');
		  break;

		case 'flip':
		  this.container.classList.add('flip');
		  break;

		case 'random':
		  break;

		default:
		  this.container.classList.remove('flip');
		  break;
		}
	}

	/**
	 * Transitions the carousel to the specified slide using a slide effect.
	 *
	 * @param {Event} evt The click event that triggered the transition.
	 * @param {boolean} smooth Whether to use a smooth transition.
	 */
	slideEffect(evt, smooth = true) {
		const idx = evt.target.getAttribute('data-target');
		const offset = this.panel.children[1].offsetLeft;
		const distance = `-${offset}px`;
		const delay = (smooth) ? this.speed * 1000 : 0;

		// Get the next and current slot names.
		const nextSlot = this.panel.children[1].querySelector('slot').name;
		const currentSlot = (nextSlot === 'carda') ? 'cardb' : 'carda';

		// Get the current element in the current slot.
		const currentElem = this.querySelector(`*[slot=${currentSlot}]`);

		// Check if the clicked slide is the currently active slide.
		if (this.slides[idx] === currentElem) return;

		// Move the clicked slide to the next slot.
		this.slides[idx].setAttribute('slot', nextSlot);

		// Apply the `translate` property to animate the slide.
		this.panel.style.translate = distance;

		// After the transition delay, remove the `smooth` class to disable smooth transitions.
		setTimeout(() => {
		this.panel.classList.remove('smooth');

		// Append the first child element to the end of the panel.
		this.panel.append(this.panel.children[0]);

		// Reset the `translate` property to hide the previous slide.
		this.panel.style.translate = 0;

		// Remove the `slot` attribute from all slides except the active slide.
		this.slides.forEach((slide) => {
		  if (slide !== this.slides[idx]) {
		    slide.removeAttribute('slot');
		  }
		});

		// After a short delay, re-enable smooth transitions.
		setTimeout(() => {
		  this.panel.classList.add('smooth');
		}, 100);
		}, delay);
	}

	/**
	 * Transitions the carousel to the specified slide using a fade effect.
	 *
	 * @param {Event} evt The click event that triggered the transition.
	 * @param {boolean} smooth Whether to use a smooth transition.
	 */
	fadeEffect(evt, smooth = false) {
		const idx = evt.target.getAttribute('data-target');
		const delay = this.speed * 1000;

		// Set the opacity of the panel to 0 to hide the current slide.
		this.panel.style.opacity = '0.0';

		// After the transition delay, perform the slide effect and re-enable smooth transitions.
		setTimeout(() => {
			this.slideEffect(evt, smooth);

			// Remove the opacity property to show the newly active slide.
			setTimeout (() => {
				this.panel.classList.add('smooth');
				this.panel.style.removeProperty('opacity');
			}, 100)
		}, delay);
	}

	/**
	 * Transitions the carousel to the specified slide using a flip effect.
	 *
	 * @param {Event} evt The click event that triggered the transition.
	 */
	flipEffect(evt) {
		const currentRotation = this.getTransformValue(this.panel.style.transform);
		const modulus = (currentRotation / 180) % 2;
		const rotate = currentRotation + 180;
		const delay = this.speed * 1000;
		const idx = evt.target.getAttribute('data-target');
		const currentSlot = (modulus === 0) ? 'carda' : 'cardb';
		const nextSlot = (modulus === 0) ? 'cardb' : 'carda';
		const currentElem = this.querySelector(`*[slot=${currentSlot}]`);

		// Check if the clicked slide is the currently active slide.
		if (this.slides[idx] === currentElem) return;

		// Move the clicked slide to the next slot.
		this.slides[idx].setAttribute('slot', nextSlot);

		// Apply the `rotateY` property to animate the flip.
		this.panel.style.transform = `rotateY(${rotate}deg)`;

		// After the transition delay, remove the `slot` attribute from all slides except the active slide.
		setTimeout(() => {
			this.slides.forEach((slide) => {
			 	if (slide !== this.slides[idx]) {
					slide.removeAttribute('slot');
				}
			});
		}, delay);
	}

	/**
	 * Disable the carousel controls during a slide transition
	 */
	disableControlsDuringTransition() {
		const delay = this.speed * 1000;
		for (const control of this.controls) {
			control.disabled = true;
			control.classList.add('disabled');
		}

		setTimeout (() => {
			for (const control of this.controls) {
				control.disabled = false;
				control.classList.remove('disabled');
			}
		}, delay);
	}

	/**
	 * Start AutpPlay to automatically advance the slides
	 */
	startAuto() {
		const delay = this.pause * 1000;
		this.autoInterval = setInterval (() => {
			this.autoPlay(this.iteration++);
		}, delay);
	}

	/**
	 * Stop AutoPlay
	 * @return {[type]} [description]
	 */
	stopAuto() {
		this.auto = false;
	}

	/**
	 * Reset AutoPlay when [pause] is changed while AutoPlay is running
	 */
	resetAuto() {
		const delay = this.pause * 1000;
		if (!this.auto) return;
		this.stopAuto();
		this.autoInterval = setInterval(() => {
			this.autoPlay(this.iteration++);
		}, delay);
		this.#auto = true;
		this.notify('auto', this.#auto);
	}

	/**
	 * A method used by startAuto to monitor iterations and activate the next slide
	 *
	 */
	autoPlay(iteration) {
		const count = this.slides.length * this.repeat;
		const idx = iteration % this.controls.length;
		this.controls[idx].click();
		if (count !== 0 && iteration >= count) {
			this.stopAuto();
			iteration = 1;
			return;
		}
	}

	subscribe(observer) {
		// observer is a function
		this.observers.push(observer);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((ob) => ob !== observer);
	}

	notify(property, newval) {
		for (const observer of this.observers) {
			observer(property, newval);
		}
	}

	/**
	 * Takes a css transform value, like '.5s', and returns a number
	 * @param  {string}	getTransformValue	The css transform value
	 * @return {integer}
	 */
	getTransformValue(transformValue) {
		let ret = 0;
		if (transformValue) {
			const re = /(\d+)(\w+)/;
			const matches = transformValue.match(re);
			ret = parseInt(matches[1]);
		}

		return ret;
	}

	get effect () { return this.#effect; }
	set effect (value) {
		this.#effect = value;
		const oldEffect = this.#bag.effect ? this.#bag.effect.old : null;
		this.#bag.effect = {new: value, old: oldEffect};
		if (this.#bag.effect.new !== this.#bag.effect.old) {
			this.initEffect(value);
		}
	}

	get speed () { return this.#speed; }
	set speed (value) {
		value = parseFloat(value);
		this.#speed = value;
		this.style.setProperty('--speed', `${value}s`)
	}

	get auto () { return this.#auto; }
	set auto (value) {
		// Anything other than 'true' or empty string is FALSE
		this.#auto = (value === true || value === 'true' || value === '') ? true : false;
		this.notify('auto', this.#auto);

		if (this.#auto) {
			this.startAuto();
		} else {
			//if value is 'false' or any other value
			clearInterval(this.autoInterval);
		}
	}

	get repeat () { return this.#repeat; }
	set repeat (value) {
		value = parseInt(value);
		this.#repeat = value;
		this.notify('repeat', value);
		this.iteration = 0;
		this.resetAuto();
	}

	get pause () { return this.#pause; }
	set pause (value) {
		value = parseFloat(value);
		this.#pause = value;
		if (this.iteration >= this.slides.length * this.repeat) {
			this.iteration = 0;
		}
		this.resetAuto();
	}

	get autocontrols () { return this.#autocontrols; }
	set autocontrols (value) {
		// if value is 'true' or empty string
		this.#autocontrols = (value === 'true' || value === '') ? true : false;
	}

	get activeindicator () { return this.#activeindicator; }
	set activeindicator (value) {
		this.#activeindicator = value;
	}
}

document.addEventListener('DOMContentLoaded', customElements.define('wijit-tabs', WijitTabs));
