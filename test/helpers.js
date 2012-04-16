parses = function(parser, input, expected) {
  deepEqual(parser.parse(input), expected);
};

function keys(obj) {
  var a = [];
  for (prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      a.push(prop);
    }
  }
  return a;
}

parsesWithStartRule = function(parser, input, startRule, expected) {
  deepEqual(parser.parse(input, startRule), expected);
};

doesNotParse = function(parser, input) {
  raises(function() { parser.parse(input); }, parser.MatchFailed);
};

doesNotParseWithMessage = function(parser, input, message) {
  raises(
    function() { parser.parse(input); },
    function(e) {
      if (e instanceof parser.MatchFailed) {
        //equal(e.message, message);
        return (e.message === message);
      } else {
        ok(false, 'Raised unexpected error');
        return false;
      }
    }
  );
};

doesNotParseWithSyntaxError = function(parser, input, message) {
  raises(
    function() { parser.parse(input); },
    function(e) {
      return e instanceof parser.SyntaxError && e.message === message;
    }
  );
};

doesNotParseWithPos = function(parser, input, line, column) {
  raises(
    function() { parser.parse(input); },
    function(e) {
      return e instanceof parser.MatchFailed
        && e.xpos[0] === line
        && e.xpos[1] === column;
    }
  );
};

parserParses = function(input, expected) {
  parses(PEG.parser, input, expected);
};

parserDoesNotParse = function(input) {
  doesNotParse(PEG.parser, input);
};

/* parserDoesNotParseWithMessage = function(input, message) {
  doesNotParseWithMessage(PEG.parser, input, message);
}; */

parserDoesNotParseWithSyntaxError = function(input, message) {
  doesNotParseWithSyntaxError(PEG.parser, input, message);
};

function _testCtxLevel(lvl, props) {
  var li = 0;
  var passed = true;
  for (prop in lvl) {
    if (lvl.hasOwnProperty(prop) &&
        (prop !== '__p') &&
        (prop !== '__c') &&
        (prop !== '__l')) li++;
  }
  var pi = 0;
  for (prop in props) {
    passed = passed && lvl.hasOwnProperty(prop);
    passed = passed && (lvl[prop] === props[prop]);
    pi++;
  }
  return passed && (pi === li);
};

/* tree looks like this:
[ {'a': 0, 'b': 2 }, // top level
  {'f': 1, 'g': 5, 'c': 3 }, // level one
  {'l': 2 } ] // level two */
parsesToContextTree = function(parser, input, tree) {
  var ctx = parser.parse(input);
  if ((ctx === null) || (typeof ctx === 'undefined')) {
    ok(false, 'ctx is null or not defined');
    return;
  }
  // travel to top
  var p = ctx;
  while (p) {
    if (!_testCtxLevel(p, tree[p.__l])) {
      ok(false, 'level '+p.__l+' not matches '+
                '('+keys(p)+' <-> '+keys(tree[p.__l])+')');
      return;
    };
    p = p.__p;
  }
  // travel to bottom
  var c = ctx.__c;
  while (c) {
    if (!_testCtxLevel(c, tree[c.__l])) {
      ok(false, 'level '+c.__l+' not matches '+
                '('+keys(c)+' <-> '+keys(tree[c.__l])+')');
      return;
    }
    c = c.__c;
  }
  ok(true);
}


