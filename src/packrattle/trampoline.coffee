PriorityQueue = require("./priority_queue").PriorityQueue

class Trampoline
  constructor: (@state) ->
    @work = new PriorityQueue()
    # map of (parser -> position -> [ continuations, results ])
    @cache = {}

  push: (priority, description, job) ->
    @work.put { description, job }, priority

  size: -> @work.length()

  # execute the next branch of parsing on the trampoline.
  next: ->
    @state.debug => [
      "fetch next job:"
      for item in @work.inspect() then "[#{item.priority}] #{item.item.description()}"
    ]
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
