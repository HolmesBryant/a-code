/**
 * HTML/CSS syntax definition file for Highlighter module.
 * This file is not strictly necessary because it is included as the default/fallback syntax.
 *
 *  @author Holmes Bryant <https://github.com/HolmesBryant>
 *  @license GPL-3.0
 */
export default {
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
}

