#
# simple interface for debugging the parser.
#
# if 'setDebugLogger' is given a function, that function will be called a
# LOT of times with debugging info as the parser makes progress (or doesn't).
#

debugf = null

setDebugLogger = (f) -> debugf = f

exports.setDebugLogger = setDebugLogger
exports.debug = (f) ->
  if debugf?
    lines = f().split("\n")
    for line in lines then debugf(line)
