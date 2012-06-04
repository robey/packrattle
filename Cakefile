
child_process = require 'child_process'
fibers = require 'fibers'
fs = require 'fs'
glob = require 'glob'
mocha = require 'mocha'
sync = require 'sync'
util = require 'util'

exec = (args...) ->
  command = args.shift()
  process = child_process.spawn command, args
  process.stderr.on "data", (data) -> util.print(data.toString())
  process.stdout.on "data", (data) -> util.print(data.toString())
  fiber = fibers.current
  process.on 'exit', (code) -> fiber.run(code)
  fibers.yield()

run = (command) ->
  console.log "\u001b[35m+ " + command + "\u001b[0m"
  rv = exec("/bin/sh", "-c", command)
  if rv != 0
    console.error "\u001b[31m! Execution failed. :(\u001b[0m"
    process.exit(1)

checkfile = (file1, file2) ->
  data1 = fs.readFileSync(file1, "UTF-8")
  data2 = fs.readFileSync(file2, "UTF-8")
  if data1 != data2
    console.error "\u001b[31m! Files do not match: #{file1} <-> #{file2}\u001b[0m"
    process.exit(1)

# run a task inside a sync-capable fiber
synctask = (name, description, f) ->
  task name, description, -> (sync -> f())

## -----

synctask "test", "run unit tests", ->
  run "./node_modules/mocha/bin/mocha -R Progress --compilers coffee:coffee-script --colors"

synctask "build", "build javascript", ->
  run "mkdir -p lib"
  run "coffee -o lib -c src"

synctask "clean", "erase build products", ->
  run "rm -rf lib"

synctask "distclean", "erase everything that wasn't in git", ->
  run "rm -rf node_modules"

