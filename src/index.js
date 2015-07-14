const resolve = require("./packrattle/resolve");
module.exports = exports = resolve;

const combiners = require("./packrattle/combiners");
exports.alt = combiners.alt;
exports.chain = combiners.chain;
exports.check = combiners.check;
exports.commit = combiners.commit;
exports.drop = combiners.drop;
exports.not = combiners.not;
exports.optional = combiners.optional;
exports.reduce = combiners.reduce;
exports.repeat = combiners.repeat;
exports.repeatIgnore = combiners.repeatIgnore;
exports.repeatSeparated = combiners.repeatSeparated;
exports.seq = combiners.seq;
exports.seqIgnore = combiners.seqIgnore;

const parser = require("./packrattle/parser");
exports.newParser = parser.newParser;

const parser_state = require("./packrattle/parser_state");
exports.ParserState = parser_state.ParserState;
exports.Span = parser_state.Span;

const priority_queue = require("./packrattle/priority_queue");
exports.PriorityQueue = priority_queue.PriorityQueue;

const simple = require("./packrattle/simple");
exports.end = simple.end;
exports.regex = simple.regex;
exports.reject = simple.reject;
exports.string = simple.string;
exports.succeed = simple.succeed;
