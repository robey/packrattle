PriorityQueue = require("./priority_queue").PriorityQueue
debug = require("./debugging").debug

class Trampoline
  constructor: ->
    @work = new PriorityQueue()
    # map of (parser -> position -> [ continuations, results ])
    @cache = {}

  push: (priority, description, job) ->
    @work.put { description, job }, priority
    debug =>
      "(+) push work to trampoline. new contents:\n" +
      (for item in @work.queue
        "( ) #{item.priority} - #{item.item.description()}\n"
      ) +
      "(.)"

  size: -> @work.length()

  # execute the next branch of parsing on the trampoline.
  next: ->
    item = @work.get()
    if item? then item.job()

  ready: -> not @work.isEmpty()

  getCache: (parser, state) ->
    x = @cache[parser.id]
    if not x?
      @cache[parser.id] = x = {}
    entry = x[state.pos]
    if not entry?
      x[state.pos] = entry = { continuations: [], results: [] }
    entry

exports.Trampoline = Trampoline
