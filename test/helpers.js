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


