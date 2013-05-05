# a priority queue, which stores an item with an associated priority
# (number). higher numbers are bumped up ahead of lower ones.
# for our internal array representation, the tail of the array is the head
# of the queue.
class PriorityQueue
  constructor: ->
    @queue = []

  length: -> @queue.length

  isEmpty: -> @queue.length == 0

  get: ->
    if @queue.length == 0 then throw new Error("Queue is empty")
    @queue.pop().item

  put: (item, priority) ->
    @putRange(0, @queue.length, item, priority)

  putRange: (left, right, item, priority) ->
    if left >= right
      # end of line.
      return @queue.splice(left, 0, { item, priority })
    n = left + Math.floor((right - left) / 2)
    if @queue[n].priority >= priority
      @putRange left, n, item, priority
    else
      @putRange n + 1, right, item, priority


exports.PriorityQueue = PriorityQueue
