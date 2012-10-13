
// ===== VERSION =====

var VERSION_FILE = 'VERSION',
    VERSION = (function(version_file) {
        return 'FOO'; // jake.cat(version_file)
    })(VERSION_FILE);

// ===== Directories =====

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

// ===== Files =====

var Files = {
    Parser:  { SRC:  Dirs.SRC + '/parser.pegjs',
               OUT:  Dirs.SRC + '/parser.js' },
    PegJS:   { SRC:  Dirs.SRC + '/peg.js',
               LIB:  Dirs.LIB + '/peg.js' },
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

// ===== Executables =====

var Run = {
    JSHINT: 'jshint',
    UGLIFYJS: 'uglifyjs',
    JASMINE_NODE: 'jasmine-node',
    PEGJS: Dirs.BIN + '/pegjs',
    BENCHMARK: Dirs.BENCHMARK + '/run'
};