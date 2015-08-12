## 4.1.0  (12 aug 2015)

- `optional` default value is now null, not the empty string.
- added `named(description)` back to the API. a named parser will change the failure message if it's still the default ("Expected (description)").
- failure messages will coalesce from alternatives, overriding narrower messages (including `named` and `onFail`) unless the branch was committed.
- `alt`, `optional`, and `repeat` will now correctly try all branches. before, packrattle was giving up if the first attempted branch was successful, so it might win the battle while losing the war.
- converted imports/exports to ES6 style (shouldn't be externally different).

## 4.0.1  (30 jul 2015)

- fixed bugs in package.json that made it effectively unloadable

## 4.0.0  (29 jul 2015)

- rewrote in ES6

## 3.0.1  (15 feb 2013)

- fix dependencies: "weakmap" should be listed; "glob" should not

## 3.0.0  (9 feb 2013)

- onMatch() will now pass the ParserState to the user function, so matching spans can be tracked
- scrapped bad logging and replaced it with a graph generator for 'dot' so you can visually walk through the parser's logic
- optimized ParserState for a huge speed improvement
- added describe() to tune the error message for a parser
- refactored & improved the way nested parsers are discovered and stringified for debugging
- fixed several small bugs with commit()

## 2.2.0  (17 nov 2013)

- onMatch() may now return another parser, to behave like "flatmap" in monads [jesse hallett]
- added accept() parser that always matches [jesse hallett]
- fixed a few bugs where commit() wouldn't be remembered across sequences or when throwing an exception from onMatch()
- moved debugging function into ParserState, so debugging can be turned on/off per parser call
- made the 'packrattle' module also an alias for 'implicit', so it can be used instead of the '$' hack

## 2.1.0  (10 may 2013)

- forced the GLL algorithm to prioritize left branches of alt() over right branches, which makes the logic more understandable for ambiguous grammars
- fixed "instance of" checking under recent node releases

## 2.0.0  (22 mar 2013)

- added GLL support, rewriting all of the internals
- made API more orthogonal

## 1.0.3  (16 aug 2012)

- added commit()

## 1.0.2  (28 jul 2012)

- fixed example in the README [michael hart]
- added apache 2 licensing info

## 1.0.1  (29 jun 2012)
