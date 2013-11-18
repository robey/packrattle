
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
