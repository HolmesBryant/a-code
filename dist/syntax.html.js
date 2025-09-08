/**
 * HTML/CSS syntax definition file for wijit-code web component.
 * This syntax definition is not necessary because it is included in the component as the default syntax definition.
 * Simply write your tag like:
 * <wijit-code highlight>...</wijit-code>
 *
 *  @author Holmes Bryant <https://github.com/HolmesBryant>
 *  @license GPL-3.0
 */
export default {
	argument: /(?<=\()[^)]+/g,
	function: /[\w-]+\s*\(|\)/g,
	property: /(?<!}[\r\n\s]+)\b([\w\d-]+:(?!:))/g,
	number: /(?<!\w)[#+.-]?\d+[%\b\.\w]*/g,
	operator: /=/g,
	tag: /<\/?[\w-]+|(?<=[\w"])>/g,
	string: /["'`][^"'`]*["'`]/g,
	variable: /--[\w\d]+/g,
	comment: /(<!--|\/\*)([\s\S]*?)(-->|\*\/)/g,
	keyword: /@[\w]+\b/g
}

