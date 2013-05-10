
coffee = "./node_modules/coffee-script/bin/coffee"
mocha = "./node_modules/mocha/bin/mocha"

task "build", description: "compile coffeescript", run: ->
  mkdir "-p", "lib"
  exec "#{coffee} -o lib -c src"

task "test", description: "run unit tests", run: (options) ->
  display = options.display or "spec"
  grep = if options.grep? then "--grep '#{options.grep}'" else ""
  exec "#{mocha} -R #{display} --compilers coffee:coffee-script --colors #{grep}"

task "clean", description: "erase built files", run: ->
  rm "-rf", "lib"

task "distclean", description: "erase everything that wasn't in git", must: "clean", run: ->
  rm "-rf", "node_modules"
