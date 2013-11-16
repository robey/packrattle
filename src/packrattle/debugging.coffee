#
# simple interface for debugging the parser.
#
# if 'setDebugLogger' is given a function, that function will be called a
# LOT of times with debugging info as the parser makes progress (or doesn't).
#

__debug = null

debugLines = (lines) ->
  for line in lines
    if Array.isArray(line) then debugLines(line) else __debug(line)

exports.setDebugLogger = (f) -> __debug = f

exports.debug = (f) ->
  if __debug?
    lines = f()
    unless Array.isArray(lines) then lines = lines.split("\n")
    debugLines(lines)
