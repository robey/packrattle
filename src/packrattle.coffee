debugging = require("./packrattle/debugging")
parser = require("./packrattle/parser")
parser_state = require("./packrattle/parser_state")

module.exports = exports = parser.implicit
for k, v of parser then exports[k] = v

exports.setDebugLogger = debugging.setDebugLogger

exports.ParserState = parser_state.ParserState
exports.Match = parser_state.Match
exports.NoMatch = parser_state.NoMatch
