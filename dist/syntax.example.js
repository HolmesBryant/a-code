/**
 * @summary Syntax definition file for the Highlighter module
 * which is responsible for highlighting code.
 *
 * @description This file exports a single default object
 *              containing several properties.
 *
 * Each property name corresponds to an argument given to a
 * ::highlight() css pseudo-element which is defined in the
 * style sheet in the component's shadow DOM.
 * The css pseudo element defines a text color for all
 * elements matched. Example ::highlight(argument) { color: orange }
 *
 * The value for each property in this file can be one of
 * three types: Array, RegExp or Function.
 *
 * Arrays are useful for defining things like keywords.
 * Example - keyword: ['some', 'key', 'words'
 *
 * RegExp expressions are useful for simple matches that
 * do not require extra processing or capture groups.
 * The RexExp must include the "g" flag.
 * Do not put quotes around the expression.
 * Example - number: /\b\d+\b/
 *
 * Functions are useful for more complex processing.
 * Each function must take two arguments (string, node)
 * and return a flat array of Range objects.
 *
 * "node" is the text node being processed.
 * Use "node" when invoking range.setStart(node, index)
 * and range.setEnd(node, index)
 *"string" is the text content contained by the
 * node, including spaces, tabs, line breaks etc.
 */
export default {
	argument: null,
	attribute: null,
	comment: null,
	function: function(string, node) {
    let match, range;
    const ranges = [];
		const regex = /<\/?[^>]+>/g;
    while (match = regex.exec(string)) {
			range = new Range();
			range.setStart(node, match.index);
			range.setEnd(node, match.index + match[0].length);
			ranges.push(range);
		}

		return ranges;
	},
	keyword: ['some','key', 'words'],
	number: /\b\d+\b/g,
	operator: null,
	string: null,
	tag: null,
}
