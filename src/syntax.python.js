/**
 * @file syntax.python.js
 * Python syntax definition file for a-code web component
 */
export default {
  argument: function(string, node) {
    const ranges = [];

    // Regex to find the start of a function definition:
    // Matches "def", whitespace, function name, whitespace, and opening "("
    const defRegex = /def\s+[a-zA-Z_]\w*\s*\(/g;
    const matches = string.matchAll(defRegex);

    for (const match of matches) {
      // The index where the argument list actually starts - immediately after the first '('
      const startSearchIndex = match.index + match[0].length;

      // State tracking variables
      let depthParen = 1; // start inside the first definition parenthesis
      let depthBracket = 0; // []
      let depthBrace = 0; // {}
      let quoteChar = null; // ' or "

      let currentArgStart = startSearchIndex;

      // Iterate through the string starting after "def name("
      for (let i = startSearchIndex; i < string.length; i++) {
        const char = string[i];

        // Handle Quotes (Strings within default values, e.g. a=",")
        if (quoteChar) {
          if (char === quoteChar && string[i - 1] !== '\\') {
            quoteChar = null; // End of string
          }
          continue; // Skip processing characters inside strings
        } else if (char === '"' || char === "'") {
          quoteChar = char; // Start of string
          continue;
        }

        // Handle Nesting (Type hints or Default values containing brackets)
        if (char === '(') depthParen++;
        else if (char === ')') depthParen--;
        else if (char === '[') depthBracket++;
        else if (char === ']') depthBracket--;
        else if (char === '{') depthBrace++;
        else if (char === '}') depthBrace--;

        // Check for End of Argument (Comma) or End of Function Def (Closing Paren)
        // Only split if we are at the top level of the argument list
        const isComma = char === ',' && depthParen === 1 && depthBracket === 0 && depthBrace === 0;
        const isEnd = depthParen === 0;

        if (isComma || isEnd) {
          // Extract the raw argument string, e.g., "  a: int = 10  " or " *args "
          const rawArg = string.substring(currentArgStart, i);

          // --- Argument Extraction Logic ---
          if (rawArg.trim()) {
          // Regex to capture optional stars (* or **) and the name
          // Stops before type hints (:) or defaults (=)
          const nameMatch = rawArg.match(/^\s*(\*{0,2})([a-zA-Z_]\w*)/);

            if (nameMatch && nameMatch[2]) {
              const argName = nameMatch[2];

              // Calculate offset:
              // nameMatch[0] is the full matched prefix (e.g. "  *args")
              // Find the last occurrence of the name within that prefix to handle spaces/stars correctly.
              const nameOffsetInMatch = nameMatch[0].lastIndexOf(argName);

              // Absolute start index in the original text node
              const start = currentArgStart + nameMatch.index + nameOffsetInMatch;
              const end = start + argName.length;

              try {
                const range = new Range();
                range.setStart(node, start);
                range.setEnd(node, end);
                ranges.push(range);
              } catch (e) {
                console.warn("Could not create range for argument", argName, e);
              }
            }
          }

          // ---------------------------------

          if (isEnd) break; // Finished parsing this function definition
          currentArgStart = i + 1; // Move start to character after comma
        }
      }
    }

    return ranges;
  },
  // Matches standard operators, bitwise, comparison, assignment, and delimiter colons/dots
  operator: /\+|-|\*|\/|%|\*\*|\/\/|=|==|!=|<=|>=|<|>|&|\||\^|~|!|:|(?<![a-zA-Z0-9_])\.(?![a-zA-Z0-9_])/g,
  // Matches Hex, Binary, Octal, Floats, Integers, and Complex numbers
  number: /\b0x[\da-f]+\b|\b0b[01]+\b|\b0o[0-7]+\b|\b\d+\.?\d*(?:e[+-]?\d+)?j?\b/ig,
  // Matches function definitions (after 'def') AND function calls (before '(')
  function: /(?<=def\s+)\w+|(?<=\b)\w+(?=\s*\()/g,
  // Repurposed to match Decorators (e.g. @classmethod, @app.route)
  tag: /@\s*[\w.]+/g,
  keyword: [
    // --- Logic & Flow ---
    'and', 'or', 'not', 'is', 'in',
    'if', 'elif', 'else',
    'for', 'while', 'break', 'continue',
    'try', 'except', 'finally', 'raise', 'assert',
    'with', 'as', 'pass',
    'return', 'yield', 'lambda',
    'match', 'case', // Python 3.10+

    // --- Definition & Scope ---
    'def', 'class', 'global', 'nonlocal', 'del',
    'import', 'from',

    // --- Async ---
    'async', 'await',

    // --- Constants ---
    'True', 'False', 'None',
    'Ellipsis', 'NotImplemented', '__debug__',

    // --- Built-in Types ---
    'bool', 'int', 'float', 'complex',
    'str', 'bytes', 'bytearray',
    'list', 'tuple', 'set', 'frozenset', 'dict',
    'object', 'type',

    // --- Built-in Functions ---
    'abs', 'aiter', 'all', 'any', 'anext', 'ascii', 'bin', 'breakpoint',
    'callable', 'chr', 'classmethod', 'compile', 'delattr', 'dir', 'divmod',
    'enumerate', 'eval', 'exec', 'filter', 'format', 'getattr', 'globals',
    'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'isinstance', 'issubclass',
    'iter', 'len', 'locals', 'map', 'max', 'memoryview', 'min', 'next',
    'oct', 'open', 'ord', 'pow', 'print', 'property', 'range', 'repr',
    'reversed', 'round', 'setattr', 'slice', 'sorted', 'staticmethod',
    'sum', 'super', 'vars', 'zip', '__import__',

    // --- Built-in Exceptions ---
    'BaseException', 'Exception', 'ArithmeticError', 'BufferError', 'LookupError',
    'AssertionError', 'AttributeError', 'EOFError', 'FloatingPointError',
    'GeneratorExit', 'ImportError', 'ModuleNotFoundError', 'IndexError',
    'KeyError', 'KeyboardInterrupt', 'MemoryError', 'NameError',
    'NotImplementedError', 'OSError', 'OverflowError', 'RecursionError',
    'ReferenceError', 'RuntimeError', 'StopIteration', 'StopAsyncIteration',
    'SyntaxError', 'IndentationError', 'TabError', 'SystemError', 'SystemExit',
    'TypeError', 'UnboundLocalError', 'UnicodeError', 'UnicodeEncodeError',
    'UnicodeDecodeError', 'UnicodeTranslateError', 'ValueError',
    'ZeroDivisionError', 'BlockingIOError', 'ChildProcessError',
    'ConnectionError', 'BrokenPipeError', 'ConnectionAbortedError',
    'ConnectionRefusedError', 'ConnectionResetError', 'FileExistsError',
    'FileNotFoundError', 'InterruptedError', 'IsADirectoryError',
    'NotADirectoryError', 'PermissionError', 'ProcessLookupError',
    'TimeoutError', 'Warning', 'UserWarning', 'DeprecationWarning',
    'PendingDeprecationWarning', 'SyntaxWarning', 'RuntimeWarning',
    'FutureWarning', 'ImportWarning', 'UnicodeWarning', 'BytesWarning',
    'ResourceWarning',

    // --- Special Attributes ---
    '__name__', '__file__', '__doc__', '__package__',
    '__loader__', '__spec__', '__annotations__', '__builtins__',

    // --- ABC Interfaces (collections.abc / typing) ---
    'Container', 'Hashable', 'Iterable', 'Iterator', 'Reversible', 'Generator',
    'Sized', 'Callable', 'Collection', 'Sequence', 'MutableSequence',
    'ByteString', 'Set', 'MutableSet', 'Mapping', 'MutableMapping',
    'MappingView', 'ItemsView', 'KeysView', 'ValuesView',
    'Awaitable', 'Coroutine', 'AsyncIterable', 'AsyncIterator', 'AsyncGenerator'
  ],
  // Matches Triple quotes (double/single) then Single quotes (double/single), handling prefixes (f, r, b, u)
  string: /(?:r|u|f|b|fr|rf)?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gi,
  // Repurposed for "Self", "Cls", and Dunder (Magic) methods
  variable: /\bself\b|\bcls\b|\b__[a-z_]+__\b/g,
  comment: /#.*/g
};
