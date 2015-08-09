"use strict";

const DQUOTE = "\"".charCodeAt(0);
const SQUOTE = "\'".charCodeAt(0);
const BACKSLASH = "\\".charCodeAt(0);

// quote a string so it can be displayed.
function quote(s) {
  if (s == null) return "null";
  return s.toString().replace(/[^\u0020-\u007e]|\"|\'/g, c => {
    const n = c.charCodeAt(0);
    switch (n) {
      case DQUOTE: return "\\\"";
      case SQUOTE: return "\\\'";
      case BACKSLASH: return "\\\\";
      default:
        const escape = "000" + n.toString(16);
        return "\\u" + escape.slice(escape.length - 4);
    }
  });
}

exports.quote = quote;
