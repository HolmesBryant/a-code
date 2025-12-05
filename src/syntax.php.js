/**
 * @file syntax.php.js
 * PHP syntax definition file for a-code web component
 */
export default {
  argument: function(string, node) {
    const ranges = [];

    // Regex to find the start of a function definition.
    // Matches "function", optional whitespace, optional name, whitespace, and opening "("
    // This handles both named functions: "function foo(" and anonymous: "function ("
    const defRegex = /function\s+(?:[a-zA-Z_\x80-\xff]\w*\s*)?\(/g;
    const matches = string.matchAll(defRegex);

    for (const match of matches) {
      // The index where the argument list starts - immediately after the opening '('
      const startSearchIndex = match.index + match[0].length;

      // State tracking
      let depthParen = 1; // Start inside the function parentheses
      let depthBracket = 0; // [] (arrays in default values)
      let depthBrace = 0; // {}
      let quoteChar = null; // ' or "

      let currentArgStart = startSearchIndex;

      for (let i = startSearchIndex; i < string.length; i++) {
        const char = string[i];

        // Handle Quotes (Strings within default values, e.g. function($a = ")") )
        if (quoteChar) {
          if (char === quoteChar && string[i - 1] !== '\\') {
            quoteChar = null;
          }
          continue;
        } else if (char === '"' || char === "'") {
          quoteChar = char;
          continue;
        }

        // Handle Nesting
        if (char === '(') depthParen++;
        else if (char === ')') depthParen--;
        else if (char === '[') depthBracket++;
        else if (char === ']') depthBracket--;
        else if (char === '{') depthBrace++;
        else if (char === '}') depthBrace--;

        // Check for End of Argument (Comma) or End of Function Def (Closing Paren)
        const isComma = char === ',' && depthParen === 1 && depthBracket === 0 && depthBrace === 0;
        const isEnd = depthParen === 0;

        if (isComma || isEnd) {
          // Extract raw argument, e.g., "int &$count = 0"
          const rawArg = string.substring(currentArgStart, i);

          if (rawArg.trim()) {
            // Logic to isolate the variable name ($var)
            // 1. We stop looking if we hit an '=' (default value assignment)
            // 2. We look for the pattern starting with $
            const equalsIndex = rawArg.indexOf('=');
            const searchPart = equalsIndex > -1 ? rawArg.substring(0, equalsIndex) : rawArg;

            // Regex matches:
            // 1. Optional reference (&) or variadic (...)
            // 2. The variable starting with $
            const varMatch = searchPart.match(/((?:&|\.\.\.)?\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/);

            if (varMatch) {
              const fullMatchString = varMatch[0]; // e.g. "&$count"

              // Calculate offset relative to the raw argument string
              const matchIndex = searchPart.indexOf(fullMatchString);

              // Absolute start index in the text node
              const start = currentArgStart + matchIndex;
              const end = start + fullMatchString.length;

              try {
                const range = new Range();
                range.setStart(node, start);
                range.setEnd(node, end);
                ranges.push(range);
              } catch (e) {
                console.warn("Could not create range for argument", fullMatchString, e);
              }
            }
          }

          if (isEnd) break;
          currentArgStart = i + 1;
        }
      }
    }

    return ranges;
  },

  // Matches PHP variables: starts with $ followed by valid chars
  variable: /\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/g,

  // Matches standard operators, arrow (->), double arrow (=>), scope (::), and comparison
  operator: /\.|->|=>|::|\?|\?\?|!|\+|-|\*|\/|%|\*\*|=|==|!=|===|!==|<|>|<=|>=|&|\||\^|~|<<|>>|(?<!\w)new(?!\w)|(?<!\w)instanceof(?!\w)/g,

  // Matches Hex, Binary, Octal, Floats, and Integers
  number: /\b0b[01]+\b|\b0x[\da-f]+\b|\b0o[0-7]+\b|\b\d*\.?\d+(?:e[+-]?\d+)?\b/ig,

  // Matches function definitions (after 'function') AND function calls (before '(')
  function: /(?<=function\s+)[a-zA-Z_\x80-\xff]\w*|(?<=\b)[a-zA-Z_\x80-\xff]\w*(?=\s*\()/g,

  // Matches PHP open/close tags
  tag: /<\?(?:php|=)?|\?>/gi,

  keyword: [
    // Control Flow
    'if', 'else', 'elseif', 'endif',
    'while', 'do', 'for', 'foreach', 'as', 'endwhile', 'endfor', 'endforeach',
    'switch', 'case', 'default', 'break', 'continue', 'endswitch', 'match',
    'return', 'goto',

    // Exception Handling
    'try', 'catch', 'finally', 'throw',

    // Definitions & Scope
    'function', 'fn', 'class', 'interface', 'trait', 'enum',
    'extends', 'implements', 'abstract', 'final', 'const',
    'public', 'protected', 'private', 'static', 'var', 'global', 'readonly',
    'namespace', 'use', 'insteadof',

    // Language Constructs
    'echo', 'print', 'include', 'include_once', 'require', 'require_once',
    'isset', 'empty', 'unset', 'die', 'exit', 'eval', 'list', 'clone', 'declare',

    // Types (Scalar & Compound)
    'array', 'string', 'int', 'float', 'bool', 'object', 'callable', 'iterable', 'void', 'mixed', 'never', 'null', 'false', 'true',

    // Magic Constants
    '__LINE__', '__FILE__', '__DIR__', '__FUNCTION__', '__CLASS__', '__TRAIT__', '__METHOD__', '__NAMESPACE__',

    // --- Predefined Interfaces ---
    'Traversable', 'Iterator', 'IteratorAggregate', 'Throwable', 'ArrayAccess',
    'Serializable', 'Countable', 'Stringable', 'UnitEnum', 'BackedEnum',
    'JsonSerializable', 'Reflector', 'DateTimeInterface', 'SessionHandlerInterface', 'InternalIterator',

    // --- Common SPL (Standard PHP Library) Interfaces ---
    'OuterIterator', 'RecursiveIterator', 'SeekableIterator', 'SplObserver', 'SplSubject',

    // --- Superglobals (Global Variables) ---
    '$GLOBALS', '$_SERVER', '$_GET', '$_POST', '$_FILES',
    '$_COOKIE', '$_SESSION', '$_REQUEST', '$_ENV',

    // --- Other Standard Globals ---
    '$argc', '$argv', '$this'
  ],

  // Matches Double quotes, Single quotes, and Backticks (Execution operator)
  // Note: Does not currently handle complex Heredoc/Nowdoc syntaxes
  string: /(["'`])(?:\\.|[^\\])*?\1/g,

  // Matches Single line (//, #) and Multi-line (/* ... */) comments
  comment: /\/\*[\s\S]*?\*\/|(?:\/\/|#).*/g
};
