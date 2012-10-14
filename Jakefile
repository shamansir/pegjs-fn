var fs = require('fs');

// aliases
jake.cat = function(file) { return fs.readFileSync(file, 'utf8'); };
jake.echo = function(what, where) { fs.writeFileSync(where, what); }; 
each = function(what, f) { for (var i = 0, l = what.length; i < l; i++) { f(what[i]); } };

// ========== VERSION ==========

var VERSION_FILE = 'VERSION',
    VERSION = (function(file) {
        return jake.cat(file).trim();
    })(VERSION_FILE);

// ========== Directories ==========

var Dirs = {
    SRC:       'src',
    BIN:       'bin',
    SPEC:      'spec',
    BENCHMARK: 'benchmark',
    EXAMPLES:  'examples',
    LIB:       'lib',
    DIST:      'dist'
};
Dirs.DIST_WEB  = Dirs.DIST + '/web';
Dirs.DIST_NODE = Dirs.DIST + '/node'; 

// ========== Files ==========

var Files = {
    PegJS:   { SRC:  Dirs.SRC + '/peg.js',
               LIB:  Dirs.LIB + '/peg.js' },  
    Parser:  { SRC:  Dirs.SRC + '/parser.pegjs',
               OUT:  Dirs.SRC + '/parser.js' },
    Package: { SRC:  'package.json',
               DIST: Dirs.DIST_NODE + '/package.json' },
    Dist:    { DEV:  Dirs.DIST_WEB + '/peg-' + VERSION + '.js',
               MIN:  Dirs.DIST_WEB + '/peg-' + VERSION + '.min.js' },
    Info:    { CHANGELOG: 'CHANGELOG',
               LICENSE: 'LICENSE',
               README: 'README.md',
               VERSION: VERSION_FILE
             }
};

// ========== Binaries ==========

var Binaries = {
    JSHINT: 'jshint',
    UGLIFYJS: 'uglifyjs',
    JASMINE_NODE: 'jasmine-node',
    PEGJS: Dirs.BIN + '/pegjs',
    BENCHMARK: Dirs.BENCHMARK + '/run'
};

// ========== Tasks ==========

// :::::::::: default ::::::::::

desc('Coherently call `clean` and `dist` tasks by default');
task('default', ['clean', 'dist'], function() {});

// :::::::::: parser ::::::::::

desc('Generate the grammar parser');
task('parser', function() {
  jake.exec([
    [ Binaries.PEGJS, 
      '--export-var PEG.parser',
      Files.Parser.SRC, Files.Parser.OUT
    ].join(' ')
  ]);
});

// :::::::::: build ::::::::::

desc('Build the PEG.js library');
task('build', function() {
  jake.mkdirP(Dirs.LIB);
  jake.echo(_preprocess(Files.PegJS.SRC), Files.PegJS.LIB);
});

// :::::::::: clean ::::::::::

desc('Remove built PEG.js library (created by `build`)');
task('clean', function() {
  jake.rmRf(Dirs.LIB);
});

// :::::::::: dist ::::::::::

desc('Prepare distribution files');
task('dist', ['build'], function() {

  // Web
  jake.mkdirP(Dirs.DIST_WEB);
  jake.cpR(Files.PegJS.LIB, Files.Dist.DEV);
  jake.exec([
    [ Binaries.UGLIFYJS, 
      '--ascii',
      '-o', Files.Dist.MIN,
      Files.PegJS.LIB
    ].join(' ')
  ]);

  // Node.js
  jake.mkdirP(Dirs.DIST_NODE);
  each([
      Dirs.LIB, 
      Dirs.BIN, 
      Dirs.EXAMPLES,
      Files.Info.CHANGELOG, 
      Files.Info.LICENSE,
      Files.Info.README, 
      Files.Info.VERSION,
      Dirs.DIST_NODE
    ], function(item) { jake.cpR(item, Dirs.DIST_NODE); }    
  );
  jake.echo(_preprocess(Files.Package.SRC), Files.Package.DIST);

});

// :::::::::: distclean ::::::::::

desc('Remove distribution file (created by `dist`)');
task('distclean', function() {
  jake.rmRf(Dirs.DIST);
});

// :::::::::: spec ::::::::::

desc('Run the spec suite');
task('spec', ['build'], function() {
  jake.exec([
    [ Binaries.JASMINE_NODE, 
      '--verbose',
      Dirs.SPEC
    ].join(' ')
  ]);
});

// :::::::::: benchmark ::::::::::

desc('Run the benchmark suite');
task('benchmark', ['build'], function() {
  jake.exec([ Binaries.BENCHMARK ]);
});

// :::::::::: hint ::::::::::

desc('Run JSHint on the source');
task('hint', ['build'], function() {
  var applyTo = new jake.FileList();
  applyTo.include(Dirs.SRC + '/*.js');
  applyTo.include(Dirs.SPEC + '/*.js');
  applyTo.exclude(Dirs.SPEC + '/vendor/*');
  applyTo.include(Dirs.BENCHMARK + '/*.js');
  applyTo.include(Binaries.BENCHMARK);
  applyTo.include(Binaries.PEGJS);
  jake.exec([ Binaries.JSHINT + applyTo.toArray().join(' ') ]);
});

// ========== Utils ==========

//.PHONY: spec benchmark hint parser build clean dist distclean
//.SILENT: spec benchmark hint parser build clean dist distclean

// { Took from old Jakefile by dmajda }
//
// A simple preprocessor that recognizes two directives:
//
//   @VERSION          -- insert PEG.js version
//   @include "<file>" -- include <file> here
//
function _preprocess(file) {
  var input = fs.readFileSync(file, "utf8").trim();
  return input.split("\n").map(function(line) {
    var matches = /^\s*\/\/\s*@include\s*"([^"]*)"\s*$/.exec(line);
    if (matches !== null) {
      var includedFile = SRC_DIR + "/" + matches[1];

      try {
        fs.statSync(includedFile);
      } catch (e) {
        abort("Included file \"" + includedFile + "\" does not exist.");
      }

      return preprocess(includedFile);
    } else {
      return line;
    }
  }).join("\n").replace(/@VERSION/g, VERSION);
}