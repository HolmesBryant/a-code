# A-Code Web Component

![alt text](https://img.shields.io/badge/License-GPL--3.0-blue.svg)

a-code is a lightweight, modern custom element for displaying code snippets. It handles indentation normalization, line numbering, and syntax highlighting without polluting the DOM with unnecessary <span> tags.

Demo: [https://holmesbryant.github.io/a-code/](https://holmesbryant.github.io/a-code/)

## Why use A-Code?

### Modern Rendering:

Uses the CSS Custom Highlight API. It does not inject HTML elements into your code text. It uses virtual ranges for high-performance rendering.

### Clean DOM:

Your code resides in a Shadow DOM, isolated from global page styles.

### Smart Indentation:

Automatically detects and strips common leading whitespace so your code aligns perfectly, regardless of how it's nested in your HTML file.

**Note:** In order to normalize the indentation, the component converts all leading spaces on each line of your code to tabs. This means each line of your code should be preceeded by **all spaces** or **all tabs**. Mixing spaces and tabs will most likely produce a result you will not like.

### Dynamic Loading:

Syntax definitions are imported dynamically only when needed.

## Browser Support

This component relies on the **CSS Custom Highlight API**.

- Chrome: 105+

- Edge: 105+

- Safari: 17.2+

- Firefox: 117+

## Usage

### 1. Include the Script

Save a-code.min.js to your project and import it. You must add the `type="module"` attribute to the script tag.

```html
	<script type="module" src="path/to/a-code.min.js">
	</script>
```

### 2. wrap your code in an `<a-code>` tag

```html
	<a-code>
  	function helloWorld() {
    	console.log("Hello!");
  	}
	</a-code>
```

### Displaying HTML (The Textarea Trick)

If you are displaying HTML markup, the browser will try to parse it before a-code reads it. To prevent this, wrap the code inside a `<textarea>`. a-code detects this automatically and uses the textarea's value.

```html
	<a-code>
  	<textarea>
    	<div class="container">
      	<h1>Title</h1>
    	</div>
  	</textarea>
	</a-code>
```

**Note:** If your code snippet itself contains a `</textarea>`, you must escape the slash in the closing tag like so: <\/textarea>. The component will automatically unescape it for display.

```html
<a-code>
	<textarea>
		<img src="false" onerror="alert('foo!')">
		<textarea>
			This textarea is part of the code to display.
		<\/textarea>
	</textarea>
</a-code>
```

## API Reference

### Attributes

| Attribute		|	Type				|	Default	|	Description																										|
| :---------	| :---------- | :------ | :------------------------------------------------------------ |
| highlight		|	String			|	html		| The syntax language to use.																		|
| line-numbers|	Boolean			|	false		|	Displays line numbers in the gutter.													|
| indent			|	Number			| 2				|	The tab size.																									|
| wrap				|	String			|	pre			|	Controls text wrapping. Common values: pre, pre-wrap, nowrap.	|
| inline			|	Boolean			|	false		|	Renders the component inline-block instead of block.					|
| palette			|	JSON String |	null		|	A JSON string defining custom colors.													|

### Properties

You can access and modify these properties on the DOM element using JavaScript.

- **element.value (String):** Get or set the text content of the code block programmatically.

- **element.highlight:** Gets/Sets syntax.

- **element.inline:** Gets/Sets inline mode.

- **element.indent:** Gets/Sets indentation.

- **element.palette:** Gets/Sets the color palette (accepts a Map or Object).

## Examples

### 1. Changing Syntax and Wrapping

Import a specific syntax file (referenced by keyword or url) and allow text to wrap to the next line.

```html
<a-code highlight="javascript" wrap="pre-wrap">
	const longString = "This is a very long string that will wrap automatically if the container is too small.";
</a-code>
```

**Note:** The component looks for syntax.javascript.js in the same directory as a-code.js.

### 2. Line Numbers and Custom Indent

```html
<a-code line-numbers indent="4">
	body {
  	  background: #000;
    	color: #fff;
	}
</a-code>
```

### 3. Programmatic Updates

Using the value setter.

```JavaScript
const codeBlock = document.querySelector('a-code');
codeBlock.value = "console.log('Updated dynamically!');";
codeBlock.highlight = "javascript";
```

### 4. Custom Syntax Path

If your syntax files are stored in a different folder, provide the relative path.

```html
<a-code highlight="./assets/syntax/syntax.python.js">
	def foo():
    	print("bar")
</a-code>
```

## Customization

### Color Palettes

You can customize the colors used for highlighting by passing a palette. This can be done via the attribute (JSON) or property (Map/Array).

Default Token Types: argument, comment, function, keyword, number, operator, property, string, variable, tag.

JavaScript Example:

```JavaScript
const el = document.querySelector('a-code');
const myColors = new Map([
	["argument", "orange"],
	["comment", "gray"],
	["function", "rgb(97, 175, 239)"],
	["keyword", "purple"],
	["string", "#98c379"]
]);
el.palette = myColors;
```

#### Creating Custom Syntax Files

To support a new language, create a JavaScript module file (e.g., syntax.python.js). It must default export an object where keys are token names and values are RegExp (with global flag), Arrays of keywords, or Functions.

Example syntax.python.js:


```JavaScript

```
## In-depth Explaination

### Custom Color Palettes

If you have enabled syntax highlighting, you may define custom color palettes via the "palette" attribute or by directly setting the palette property.

You may define your palette as a two dimensional array of key => value pairs, a JSON string representing a two dimensional array, or a javascript Map. Regardless of how you define it, the component will convert it into a Map.

Each key should correspond to a property in the syntax definition file you are using.
Each value should be a valid css color value.

The default keys are listed in the example below.

Unless your syntax definition file adds new key words, you can just use the default keys. You do not have to include every key, the properties/values are merged into the default scheme, so any keys you omit will take the default color.

```javascript
// Array
customElements.whenDefined('a-code')
.then (() => {
	const instance = document.querySelector('a-code');
	const colors = [
		[ "argument", "hsl(32, 93%, 66%)" ],
		[ "comment", "hsl(221, 12%, 69%)" ],
		[ "function", "hsl(210, 50%, 60%)" ],
		[ "keyword", "hsl(300, 30%, 68%)" ],
		[ "number", "hsl(32, 93%, 50%)" ],
		[ "operator", "red" ],
		[ "property", "orchid" ],
		[ "string", "hsl(114, 31%, 68%)" ],
		[ "variable", "darkkhaki" ],
		[ "tag", "indianred" ]
	];
	// assign Array to palette
	instance.palette = colors;
});
```

```javascript
// Map
customElements.whenDefined( 'a-code' )
.then (() => {
	const instance = document.querySelector( 'a-code' );
	const colors = new Map();
	colors.set( "argument", "orange" );
	colors.set( "comment", "gray" );
	colors.set( "function", "dodgerblue" );
	colors.set( "keyword", "purple" );
	colors.set( "number", "darksalmon" );
	colors.set( "operator", "darkred" );
	colors.set( "property", "orchid" )
	colors.set( "string", "darkgreen" );
	colors.set( "tag", "olive" );
	colors.set( "variable", "darkkhaki" )
	// assign Map to palette
	instance.palette = colors;
});
```

```html
// JSON string
<a-code palette='[["key", "color"]]'>...</a-code>
```

### Custom Syntax Definitions

Syntax files are used when highlighting code.
These files are javascript modules which are imported into the component upon initialization.
The value of the "highlight" attribute on the `a-code` tag corresponds to a syntax file.
for example, if "highlight" has a value of "javascript", the component looks for a file named "syntax.javascript.js" in the same directory as the component script.

You may use your own syntax definitions by creating a syntax definition file.
The default naming scheme for this file is "syntax.[language_name].js", so if you want to create a syntax file for Python, the file name would be "syntax.python.js".

Even though the default location for this type of file is in the same directory as the a-code.js file, it is not mandatory to place your file there. You may place a syntax definition file anywhere that can be imported by javascript, but if you do this, you must give the "highlight" attribute a path or url instead of a simple key word.

A syntax definition file consists of a single exported object containing several properties. You must define this object as the default export.

	// syntax.example.js
	export default {
		argument: ... ,
		comment: ... ,
		function ... ,
		keyword: ... ,
		number: ... ,
		operator: ...,
		string: ...,
		tag: ...,
		variable: ...
	};

Each property corresponds to a CSS Custom Highlight API css rule.

The default properties are the same as those desctribed in **Custom Color Palettes**.

If you add a new property name, you must add a new color palette entry which includes the new property name and a color.

```javascript
//syntax.example.js
export default {
	...
	newProperty: ...
}
```

```javascript
//scripts.js
customElements.whenDefined( 'a-code' )
.then (() => {
	const instance = document.querySelector( 'a-code' );
	instance.palette.set( "newProperty", "LemonChiffon" );
});
```

The value for each property can be an Array, Function, RexExp or null.

Arrays are useful for defining things like keywords.

	export default {
		keywords: ['some', 'key', 'words'],
		...
	}

RegExp expressions are useful for simple matches that do not require extra processing or capture groups.
The RexExp **must** include the "g" flag.
Do not put quotes around the expression.

	export default {
		number: /\b\d+\b/g,
		...
	}

Functions are useful for more complex processing.
Each function takes two arguments (string, node) and must return a flat array of Range objects.

"node" is the node containing the textContent of everything inside the component's start/end tags.
Use "node" when invoking range.setStart(node, index) and range.setEnd(node, index).

"string" is the actual content. It includes spaces, tabs, line breaks etc.

	export default {
		tag: function ( string, node ) {
			let match, range;
			const ranges = [];
			const regex = /<\/?[^>]+>/g;
		  while( match = regex.exec( string ) ) {
				range = new Range();
				range.setStart( node, match.index );
				range.setEnd( node, match.index + match[0].length );
				ranges.push( range );
		  }

		  // return flat array of Range objects
			return ranges;
		},
		...
	}

Null is used when you want to include a property, but don't really have a use for it at the moment.

	export default {
		keywords: null,
		...
	}

**It is important to note that the effect of each following item supercedes the effect of the previous one (depending, of course, on how the definitions are written).**

In the following example, the "tag" definition will match everyting between and including angle brackets (including strings), but since the "string" definition follows it, any strings within the angle brackets will be colored according to the string color, not the tag color.

	// example
	export default {
		tag: /<[^>]+>/g,
		string: /['"].*['"]/g
		...
	}


Under the hood, the component takes the ranges from a supplied Function,
or creates ranges from a supplied RexExp or Array, and passes those ranges to [an instance of Highlight](https://developer.mozilla.org/en-US/docs/Web/API/Highlight).

The Highlight instance is then passed to the global [CSS:highlights static property](https://developer.mozilla.org/en-US/docs/Web/API/CSS/highlights_static).

## Changelog

- v2.0.1

	- Added wrap attribute to control CSS white-space (e.g., pre-wrap).

	- Added value getter/setter to easily change content programmatically.

- v2.0.0

	- Refactor: Styles are now injected using CSSStyleSheet and adoptedStyleSheets into the Shadow DOM. This prevents styles from bleeding out or conflicting with other instances.

	- Refactor: Attributes are now strictly synced with properties.

- v1.13 : Fixed memory leaks and AbortController issues when removing the element from the DOM.

- v1.1 : Default highlight set to html (covers HTML and CSS).
