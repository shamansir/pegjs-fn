parses = function(parser, input, expected) {
  deepEqual(parser.parse(input), expected);
};

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
      return e instanceof parser.MatchFailed && e.message === message;
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

parserDoesNotParseWithMessage = function(input, message) {
  doesNotParseWithMessage(PEG.parser, input, message);
};
