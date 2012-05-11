(function() {

module("PEG.compiler");

test("choices", function() {
  var parser = PEG.buildParser('start = "a" / "b" / "c"');
  parses(parser, "a", "a");
  parses(parser, "b", "b");
  parses(parser, "c", "c");
  doesNotParse(parser, "");
  doesNotParse(parser, "ab");
  doesNotParse(parser, "d");
});

test("sequences", function() {
  var emptySequenceParser = PEG.buildParser('start = ');
  parses(emptySequenceParser, "", []);
  doesNotParse(emptySequenceParser, "abc");

  var nonEmptySequenceParser = PEG.buildParser('start = "a" "b" "c"');
  parses(nonEmptySequenceParser, "abc", ["a", "b", "c"]);
  doesNotParse(nonEmptySequenceParser, "");
  doesNotParse(nonEmptySequenceParser, "ab");
  doesNotParse(nonEmptySequenceParser, "abcd");
  doesNotParse(nonEmptySequenceParser, "efg");

  /*
   * Test that the parsing position returns after unsuccessful parsing of a
   * sequence.
   */
  var posTestParser = PEG.buildParser('start = ("a" "b") / "a"');
  parses(posTestParser, "a", "a");
});

test("labels", function() {
  var parser = PEG.buildParser('start = label:"a"');
  parses(parser, "a", "a");
  doesNotParse(parser, "b");
});

test("simple and", function() {
  var parser = PEG.buildParser('start = "a" &"b" "b"');
  parses(parser, "ab", ["a", "", "b"]);
  doesNotParse(parser, "ac");

  /*
   * Test that the parsing position returns after successful parsing of a
   * predicate is not needed, it is implicit in the tests above.
   */
});

test("simple not", function() {
  var parser = PEG.buildParser('start = "a" !"b"');
  parses(parser, "a", ["a", ""]);
  doesNotParse(parser, "ab");

  /*
   * Test that the parsing position returns after successful parsing of a
   * predicate.
   */
  var posTestParser = PEG.buildParser('start = "a" !"b" "c"');
  parses(posTestParser, "ac", ["a", "", "c"]);
});

test("semantic and", function() {

  var acceptingParser = PEG.buildParser(
    'start = "a" &{ return true; } "b"'
  );
  parses(acceptingParser, "ab", ["a", "", "b"]);

  var rejectingParser = PEG.buildParser(
    'start = "a" &{ return false; } "b"'
  );
  doesNotParse(rejectingParser, "ab");

  var oddParser = PEG.buildParser('start = as:"a"* &{ return ctx.as.length % 2; }');
  doesNotParse(oddParser, "aa");
  parses(oddParser, "aaa", [["a", "a", "a"], ""]);

  var oddParserWithAction = PEG.buildParser(
    'start = as:"a"* &{ return ctx.as.length % 2; } "b" { return ctx.as; }');
  doesNotParse(oddParserWithAction, "aab");     
  parses(oddParserWithAction, "aaab", ["a", "a", "a"]);

  var singleElementUnlabeledParser = PEG.buildParser([
    'start = "a" &{',
    '          return cpos === 1', // TODO: c[urrent]pos and a[ctual]pos?
    '            && xpos(cpos)[0] === 1',
    '            && xpos(cpos)[1] === 2;',
    '        }'
  ].join("\n"));
  parses(singleElementUnlabeledParser, "a", ["a", ""]);

  var singleElementLabeledParser = PEG.buildParser([
    'start = a:"a" &{',
    '          return cpos === 1',
    '            && xpos(cpos)[0] === 1',
    '            && xpos(cpos)[1] === 2',
    '            && ctx.a === "a";',
    '        }'
  ].join("\n"));
  parses(singleElementLabeledParser, "a", ["a", ""]);

  var multiElementUnlabeledParser = PEG.buildParser([
    'start = "a" "b" "c" &{',
    '          return cpos === 3',
    '            && xpos(cpos)[0] === 1',
    '            && xpos(cpos)[1] === 4;',
    '        }'
  ].join("\n"));
  parses(multiElementUnlabeledParser, "abc", ["a", "b", "c", ""]);

  var multiElementLabeledParser = PEG.buildParser([
    'start = a:"a" "b" c:"c" &{',
    '          return cpos === 3',
    '            && xpos(cpos)[0] === 1',
    '            && xpos(cpos)[1] === 4',
    '            && ctx.a === "a"',
    '            && ctx.c === "c";',
    '        }'
  ].join("\n"));
  parses(multiElementLabeledParser, "abc", ["a", "b", "c", ""]);

  var innerElementsUnlabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          "b" "c" "d" &{',
    '            return cpos === 4',
    '              && xpos(cpos)[0] === 1',
    '              && xpos(cpos)[1] === 5;',
    '           }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(innerElementsUnlabeledParser, "abcde", ["a", ["b", "c", "d", ""], "e"]);

  var innerElementsLabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" d:"d" &{',
    '            return cpos === 4',
    '              && xpos(cpos)[0] === 1',
    '              && xpos(cpos)[1] === 5',
    '              && ctx.b === "b"',
    '              && ctx.d === "d";',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(innerElementsLabeledParser, "abcde", ["a", ["b", "c", "d", ""], "e"]);

  var twoLineInnerElementsLabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" . d:"d" &{',
    '            return cpos === 5',
    '              && xpos(cpos)[0] === 2',
    '              && xpos(cpos)[1] === 2',
    '              && ctx.b === "b"',
    '              && ctx.d === "d";',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(twoLineInnerElementsLabeledParser, 
         "abc\nde", ["a", ["b", "c", '\n', "d", ""], "e"]);

  var digitsParser = PEG.buildParser([
    '{ ctx.result = "default"; }',
    'start  = line (nl+ line)* { return ctx.result; }',
    'line   = thing (" "+ thing)*',
    'thing  = digit / mark',
    'digit  = [0-9]',
    'mark   = &{ ctx.result = xpos(cpos); return true; } "x"',
    'nl     = ("\\r" / "\\n" / "\\u2028" / "\\u2029")'
  ].join("\n"));

  parses(digitsParser, "1\n2\n\n3\n\n\n4 5 x", [7, 5]);

  /* Non-Unix newlines */
  parses(digitsParser, "1\rx", [2, 1]);   // Old Mac
  parses(digitsParser, "1\r\nx", [2, 1]); // Windows
  parses(digitsParser, "1\n\rx", [3, 1]); // mismatched

  /* Strange newlines */
  parses(digitsParser, "1\u2028x", [2, 1]); // line separator
  parses(digitsParser, "1\u2029x", [2, 1]); // paragraph separator
});

test("semantic not", function() {

  var acceptingParser = PEG.buildParser(
    'start = "a" !{ return false; } "b"'
  );
  parses(acceptingParser, "ab", ["a", "", "b"]);

  var rejectingParser = PEG.buildParser(
    'start = "a" !{ return true; } "b"'
  );
  doesNotParse(rejectingParser, "ab");

  var evenParser = PEG.buildParser('start = as:"a"* !{ return ctx.as.length % 2; }');
  parses(evenParser, "aa", [["a", "a"], ""]);
  doesNotParse(evenParser, "aaa");

  var evenParserWithAction = PEG.buildParser(
    'start = as:"a"* !{ return ctx.as.length % 2; } "b" { return ctx.as; }');    
  parses(evenParserWithAction, "aab", ["a", "a"]);     
  doesNotParse(evenParserWithAction, "aaab");

  var singleElementUnlabeledParser = PEG.buildParser([
    'start = "a" !{',
    '          return cpos !== 1', // TODO: c[urrent]pos and a[ctual]pos?
    '            || xpos(cpos)[0] !== 1',
    '            || xpos(cpos)[1] !== 2;',
    '        }'
  ].join("\n"));
  parses(singleElementUnlabeledParser, "a", ["a", ""]);

  var singleElementLabeledParser = PEG.buildParser([
    'start = a:"a" !{',
    '          return cpos !== 1',
    '            || xpos(cpos)[0] !== 1',
    '            || xpos(cpos)[1] !== 2',
    '            || ctx.a !== "a";',
    '        }'
  ].join("\n"));
  parses(singleElementLabeledParser, "a", ["a", ""]);

  var multiElementUnlabeledParser = PEG.buildParser([
    'start = "a" "b" "c" !{',
    '          return cpos !== 3',
    '            && xpos(cpos)[0] !== 1',
    '            && xpos(cpos)[1] !== 4;',
    '        }'
  ].join("\n"));
  parses(multiElementUnlabeledParser, "abc", ["a", "b", "c", ""]);

  var multiElementLabeledParser = PEG.buildParser([
    'start = a:"a" "b" c:"c" !{',
    '          return cpos !== 3',
    '            || xpos(cpos)[0] !== 1',
    '            || xpos(cpos)[1] !== 4',
    '            || ctx.a !== "a"',
    '            || ctx.c !== "c";',
    '        }'
  ].join("\n"));
  parses(multiElementLabeledParser, "abc", ["a", "b", "c", ""]);

  var innerElementsUnlabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" d:"d" !{',
    '            return cpos !== 4',
    '              || xpos(cpos)[0] !== 1',
    '              || xpos(cpos)[1] !== 5',
    '              || ctx.b !== "b"',
    '              || ctx.d !== "d";',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(innerElementsUnlabeledParser, "abcde", ["a", ["b", "c", "d", ""], "e"]);

  var innerElementsLabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" d:"d" !{',
    '            return cpos !== 4',
    '              || xpos(cpos)[0] !== 1',
    '              || xpos(cpos)[1] !== 5',
    '              || ctx.b !== "b"',
    '              || ctx.d !== "d";',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(innerElementsLabeledParser, "abcde", ["a", ["b", "c", "d", ""], "e"]);

  var twoLineInnerElementsLabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" . d:"d" !{',
    '            return cpos !== 5',
    '              || xpos(cpos)[0] !== 2',
    '              || xpos(cpos)[1] !== 2',
    '              || ctx.b !== "b"',
    '              || ctx.d !== "d";',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(twoLineInnerElementsLabeledParser, 
         "abc\nde", ["a", ["b", "c", '\n', "d", ""], "e"]);

  var digitsParser = PEG.buildParser([
    '{ сtx.result = "default"; }',
    'start  = line (nl+ line)* { return ctx.result; }',
    'line   = thing (" "+ thing)*',
    'thing  = digit / mark',
    'digit  = [0-9]',
    'mark   = !{ ctx.result = xpos(cpos); return false; } "x"',
    'nl     = ("\\r" / "\\n" / "\\u2028" / "\\u2029")'
  ].join("\n"));

  parses(digitsParser, "1\n2\n\n3\n\n\n4 5 x", [7, 5]);

  /* Non-Unix newlines */
  parses(digitsParser, "1\rx", [2, 1]);   // Old Mac
  parses(digitsParser, "1\r\nx", [2, 1]); // Windows
  parses(digitsParser, "1\n\rx", [3, 1]); // mismatched

  /* Strange newlines */
  parses(digitsParser, "1\u2028x", [2, 1]); // line separator
  parses(digitsParser, "1\u2029x", [2, 1]); // paragraph separator
});

test("optional expressions", function() {
  var parser = PEG.buildParser('start = "a"?');
  parses(parser, "", "");
  parses(parser, "a", "a");
});

test("zero or more expressions", function() {
  var parser = PEG.buildParser('start = "a"*');
  parses(parser, "", []);
  parses(parser, "a", ["a"]);
  parses(parser, "aaa", ["a", "a", "a"]);
});

test("one or more expressions", function() {
  var parser = PEG.buildParser('start = "a"+');
  doesNotParse(parser, "");
  parses(parser, "a", ["a"]);
  parses(parser, "aaa", ["a", "a", "a"]);
});

test("actions", function() {

  var singleElementUnlabeledParser = PEG.buildParser(
    'start = "a" { return typeof ctx !== "undefined"' +
                      '&& typeof chunk !== "undefined"; }');
  parses(singleElementUnlabeledParser, "a", "");

  var singleElementLabeledParser = PEG.buildParser(
    'start = a:"a" { return [ ctx.a,' +
                            ' chunk.pos, chunk.end, chunk.match,' +
                            ' xpos(chunk.pos), xpos(chunk.end) ]; }'
  );
  parses(singleElementLabeledParser, "a", [ "a", 
                                            0, 1, "a", 
                                            [1, 1], [1, 2]]);

  var multiElementUnlabeledParser = PEG.buildParser(
    'start = "a" "b" "c" { return typeof ctx !== "undefined"' +
                              '&& typeof chunk !== "undefined"; }');
  parses(multiElementUnlabeledParser, "abc", "");

  var multiElementLabeledParser = PEG.buildParser([
    'start = a:"a" "b" c:"c" {',
    '  return [ ctx.a, ctx.c,',
    '           chunk.pos, chunk.end, chunk.match,',
    '           xpos(chunk.pos), xpos(chunk.end) ];',
    '}'
    ].join("\n"));
  parses(multiElementLabeledParser, "abc", [ "a", "c", 
                                             0, 3, "abc", 
                                             [1, 1], [1, 3]]);

  var innerElementsUnlabeledParser = PEG.buildParser(
    'start = "a" ("b" "c" "d" { return typeof ctx !== "undefined"' +
                                   '&& typeof chunk !== "undefined"; }) "e"'
  );
  parses(innerElementsUnlabeledParser, "abcde", ["a", "", "e"]);

  var innerElementsLabeledParser = PEG.buildParser([
    'start = "a"',
    '        (',
    '          b:"b" "c" d:"d" {',
    '            return [ ctx.b, ctx.d,',
    '                     chunk.pos, chunk.end, chunk.match,',
    '                     xpos(chunk.pos), xpos(chunk.end) ];',
    '          }',
    '        )',
    '        "e"'
  ].join("\n"));
  parses(
    innerElementsLabeledParser,
    "abcde",
    ["a", [ "b", "d", 
            1, 4, "bcd",
            [1, 2], [1, 4] ], "e"]
  );

  /*
   * Test that the parsing position returns after successfull parsing of the
   * action expression and action returning |null|.
   */
  var posTestParser = PEG.buildParser(
    'start = "a" { return null; } / "a"'
  );
  parses(posTestParser, "a", "a");

  /* Test that the action is not called when its expression does not match. */
  var notAMatchParser = PEG.buildParser(
    'start = "a" { ok(false, "action got called when it should not be"); }'
  );
  doesNotParse(notAMatchParser, "b");

  var actionKnowsPositionParser = PEG.buildParser(
    'start = [a-c]* { return chunk.pos; }'    
  );    
  parses(actionKnowsPositionParser, "abc", 0);

  var actionKnowsEndPositionParser = PEG.buildParser(
    'start = "a" "b" [c-e]* { return chunk.end; }'
  );
  parses(actionKnowsEndPositionParser, "abcde", 5);

  var actionKnowsMatchParser = PEG.buildParser(
    'start = [a-d]* { return chunk.match; }'
  );
  parses(actionKnowsMatchParser, "abcd", "abcd");

  var actionKnowsPositionInsideParser = PEG.buildParser(
    'start = [a-c]* ([d-f]* { return chunk.pos; })'
  );
  parses(actionKnowsPositionInsideParser, "acdef", [["a", "c"], 2]);

  var actionKnowsEndPositionInsideParser = PEG.buildParser(
    'start = "e" "d" ([bc]* { return chunk.end; }) "a"'
  );
  parses(actionKnowsEndPositionInsideParser, "edcba", ["e", "d", 4, "a"]);

  var actionKnowsMatchInsideParser = PEG.buildParser(
    'start = [vad]* ([tier]* { return chunk.match; }) "s" [temn]*'
  );
  parses(actionKnowsMatchInsideParser, "advertisment", [["a","d","v"], "erti", "s", ["m","e","n","t"]]);

  var actionDontKnowOtherContextParser = PEG.buildParser(
    'start = "a" ("b" { ctx.b = 17; return chunk.match; }) ("c" { return (typeof ctx.b === "undefined"); })'    
  );    
  parses(actionDontKnowOtherContextParser, "abc", ["a", ["b"], [""]]);

  var numbersParser = PEG.buildParser([
    '{ ctx.result = "default"; }',
    'start  = line (nl+ line)* { return ctx.result; }',
    'line   = thing (" "+ thing)*',
    'thing  = digit / mark',
    'digit  = [0-9]',
    'mark   = "x" { ctx.result = xpos(chunk.pos); }',
    'nl     = ("\\r" / "\\n" / "\\u2028" / "\\u2029")'
  ].join("\n"));

  parses(numbersParser, "1\n2\n\n3\n\n\n4 5 x", [7, 5]);

  /* Non-Unix newlines */
  parses(numbersParser, "1\rx", [2, 1]);   // Old Mac
  parses(numbersParser, "1\r\nx", [2, 1]); // Windows
  parses(numbersParser, "1\n\rx", [3, 1]); // mismatched

  /* Strange newlines */
  parses(numbersParser, "1\u2028x", [2, 1]); // line separator
  parses(numbersParser, "1\u2029x", [2, 1]); // paragraph separator
});

test("initializer", function() {
  var variableInActionParser = PEG.buildParser(
    '{ ctx.a = 42; }; start = "a" { return ctx.a; }'
  );
  parses(variableInActionParser, "a", 42);

  var functionInActionParser = PEG.buildParser(
    '{ ctx.f = function() { return 42; } }; start = "a" { return ctx.f(); }'
  );
  parses(functionInActionParser, "a", 42);

  var variableInSemanticAndParser = PEG.buildParser(
    '{ ctx.a = 42; }; start = "a" &{ return ctx.a === 42; }'
  );
  parses(variableInSemanticAndParser, "a", ["a", ""]);

  var functionInSemanticAndParser = PEG.buildParser(
    '{ ctx.f = function() { return 42; } }; start = "a" &{ return ctx.f() === 42; }'
  );
  parses(functionInSemanticAndParser, "a", ["a", ""]);

  var variableInSemanticNotParser = PEG.buildParser(
    '{ ctx.a = 42; }; start = "a" !{ return ctx.a !== 42; }'
  );
  parses(variableInSemanticNotParser, "a", ["a", ""]);

  var functionInSemanticNotParser = PEG.buildParser(
    '{ ctx.f = function() { return 42; } }; start = "a" !{ return ctx.f() !== 42; }'
  );
  parses(functionInSemanticNotParser, "a", ["a", ""]);
});

test("rule references", function() {
  var parser = PEG.buildParser([
    'start   = static / dynamic',
    'static  = "C" / "C++" / "Java" / "C#"',
    'dynamic = "Ruby" / "Python" / "JavaScript"'
  ].join("\n"));
  parses(parser, "Java", "Java");
  parses(parser, "Python", "Python");
});

test("literals", function() {
  var zeroCharParser = PEG.buildParser('start = ""');
  parses(zeroCharParser, "", "");
  doesNotParse(zeroCharParser, "a");

  var oneCharCaseSensitiveParser = PEG.buildParser('start = "a"');
  parses(oneCharCaseSensitiveParser, "a", "a");
  doesNotParse(oneCharCaseSensitiveParser, "");
  doesNotParse(oneCharCaseSensitiveParser, "A");
  doesNotParse(oneCharCaseSensitiveParser, "b");

  var multiCharCaseSensitiveParser = PEG.buildParser('start = "abcd"');
  parses(multiCharCaseSensitiveParser, "abcd", "abcd");
  doesNotParse(multiCharCaseSensitiveParser, "");
  doesNotParse(multiCharCaseSensitiveParser, "abc");
  doesNotParse(multiCharCaseSensitiveParser, "abcde");
  doesNotParse(multiCharCaseSensitiveParser, "ABCD");
  doesNotParse(multiCharCaseSensitiveParser, "efgh");

  var oneCharCaseInsensitiveParser = PEG.buildParser('start = "a"i');
  parses(oneCharCaseInsensitiveParser, "a", "a");
  parses(oneCharCaseInsensitiveParser, "A", "A");
  doesNotParse(oneCharCaseInsensitiveParser, "");
  doesNotParse(oneCharCaseInsensitiveParser, "b");

  var multiCharCaseInsensitiveParser = PEG.buildParser(
    'start = "abcd"i'
  );
  parses(multiCharCaseInsensitiveParser, "abcd", "abcd");
  parses(multiCharCaseInsensitiveParser, "ABCD", "ABCD");
  doesNotParse(multiCharCaseInsensitiveParser, "");
  doesNotParse(multiCharCaseInsensitiveParser, "abc");
  doesNotParse(multiCharCaseInsensitiveParser, "abcde");
  doesNotParse(multiCharCaseInsensitiveParser, "efgh");

  /*
   * Test that the parsing position moves forward after successful parsing of
   * a literal.
   */
  var posTestParser = PEG.buildParser('start = "a" "b"');
  parses(posTestParser, "ab", ["a", "b"]);
});

test("anys", function() {
  var parser = PEG.buildParser('start = .');
  parses(parser, "a", "a");
  doesNotParse(parser, "");
  doesNotParse(parser, "ab");

  /*
   * Test that the parsing position moves forward after successful parsing of
   * an any.
   */
  var posTestParser = PEG.buildParser('start = . .');
  parses(posTestParser, "ab", ["a", "b"]);
});

test("classes", function() {
  var emptyClassParser = PEG.buildParser('start = []');
  doesNotParse(emptyClassParser, "");
  doesNotParse(emptyClassParser, "a");
  doesNotParse(emptyClassParser, "ab");

  var invertedEmptyClassParser = PEG.buildParser('start = [^]');
  doesNotParse(invertedEmptyClassParser, "");
  parses(invertedEmptyClassParser, "a", "a");
  doesNotParse(invertedEmptyClassParser, "ab");

  var nonEmptyCaseSensitiveClassParser = PEG.buildParser(
    'start = [ab-d]'
  );
  parses(nonEmptyCaseSensitiveClassParser, "a", "a");
  parses(nonEmptyCaseSensitiveClassParser, "b", "b");
  parses(nonEmptyCaseSensitiveClassParser, "c", "c");
  parses(nonEmptyCaseSensitiveClassParser, "d", "d");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "A");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "B");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "C");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "D");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "e");
  doesNotParse(nonEmptyCaseSensitiveClassParser, "ab");

  var invertedNonEmptyCaseSensitiveClassParser = PEG.buildParser(
    'start = [^ab-d]'
  );
  parses(invertedNonEmptyCaseSensitiveClassParser, "A", "A");
  parses(invertedNonEmptyCaseSensitiveClassParser, "B", "B");
  parses(invertedNonEmptyCaseSensitiveClassParser, "C", "C");
  parses(invertedNonEmptyCaseSensitiveClassParser, "D", "D");
  parses(invertedNonEmptyCaseSensitiveClassParser, "e", "e");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "a", "a");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "b", "b");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "c", "c");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "d", "d");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "");
  doesNotParse(invertedNonEmptyCaseSensitiveClassParser, "ab");

  var nonEmptyCaseInsensitiveClassParser = PEG.buildParser(
    'start = [ab-d]i'
  );
  parses(nonEmptyCaseInsensitiveClassParser, "a", "a");
  parses(nonEmptyCaseInsensitiveClassParser, "b", "b");
  parses(nonEmptyCaseInsensitiveClassParser, "c", "c");
  parses(nonEmptyCaseInsensitiveClassParser, "d", "d");
  parses(nonEmptyCaseInsensitiveClassParser, "A", "A");
  parses(nonEmptyCaseInsensitiveClassParser, "B", "B");
  parses(nonEmptyCaseInsensitiveClassParser, "C", "C");
  parses(nonEmptyCaseInsensitiveClassParser, "D", "D");
  doesNotParse(nonEmptyCaseInsensitiveClassParser, "");
  doesNotParse(nonEmptyCaseInsensitiveClassParser, "e");
  doesNotParse(nonEmptyCaseInsensitiveClassParser, "ab");

  var invertedNonEmptyCaseInsensitiveClassParser = PEG.buildParser(
    'start = [^ab-d]i'
  );
  parses(invertedNonEmptyCaseInsensitiveClassParser, "e", "e");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "a", "a");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "b", "b");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "c", "c");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "d", "d");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "A", "A");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "B", "B");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "C", "C");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "D", "D");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "");
  doesNotParse(invertedNonEmptyCaseInsensitiveClassParser, "ab");

  /*
   * Test that the parsing position moves forward after successful parsing of
   * a class.
   */
  var posTestParser = PEG.buildParser('start = [ab-d] [ab-d]');
  parses(posTestParser, "ab", ["a", "b"]);
});

test("cache", function() {
  /*
   * Should trigger a codepath where the cache is used (for the "a" rule).
   */
  var parser = PEG.buildParser([
    'start = (a b) / (a c)',
    'a     = "a"',
    'b     = "b"',
    'c     = "c"'
  ].join("\n"));
  parses(parser, "ac", ["a", "c"]);
});

test("indempotence", function() {
  var parser1 = PEG.buildParser('start = "abcd"');
  var parser2 = PEG.buildParser('start = "abcd"');

  strictEqual(parser1.toSource(), parser2.toSource());
});

test("error details", function() {
  var EOI = "end of input";

  var literalParser = PEG.buildParser('start = "abcd"');
  doesNotParseWithDetails(
    literalParser,
    "",
    ["\"abcd\""],
    null,
    'Expected "abcd", but '+EOI+' found.'
  );
  doesNotParseWithDetails(
    literalParser,
    "efgh",
    ["\"abcd\""],
    "e",
    'Expected "abcd", but "e" found.'
  );
  doesNotParseWithDetails(
    literalParser,
    "abcde",
    [],
    "e",
    'Expected '+EOI+', but "e" found.'
  );

  var classParser = PEG.buildParser('start = [a-d]');
  doesNotParseWithDetails(
    classParser,
    "",
    ["[a-d]"],
    null,
    'Expected [a-d], but '+EOI+' found.'
  );
  var negativeClassParser = PEG.buildParser('start = [^a-d]');
  doesNotParseWithDetails(
    negativeClassParser,
    "",
    ["[^a-d]"],
    null,
    'Expected [^a-d] but '+EOI+' found.'
  );

  var anyParser = PEG.buildParser('start = .');
  doesNotParseWithDetails(
    anyParser,
    "",
    ["any character"], // "{*}"
    null,
    'Expected any character, but '+EOI+' found.'
  );

  var namedRuleWithLiteralParser = PEG.buildParser(
    'start "digit" = [0-9]'
  );
  doesNotParseWithDetails(
    namedRuleWithLiteralParser,
    "a",
    ["digit"], // "{digit}"
    "a",
    'Expected digit, but "a" found.'
  );

  var namedRuleWithAnyParser = PEG.buildParser('start "whatever" = .');
  doesNotParseWithDetails(
    namedRuleWithAnyParser,
    "",
    ["whatever"], // "{whatever}"
    null,
    'Expected whatever, but '+EOI+' found.'
  );

  var namedRuleWithNamedRuleParser = PEG.buildParser([
    'start "digits" = digit+',
    'digit "digit"  = [0-9]'
  ].join("\n"));
  doesNotParseWithDetails(
    namedRuleWithNamedRuleParser,
    "",
    ["digits"],
    null,
    'Expected digits, but '+EOI+' found.'
  );

  var choiceParser1 = PEG.buildParser('start = "a" / "b" / "c"');
  doesNotParseWithDetails(
    choiceParser1,
    "def",
    ["\"a\"", "\"b\"", "\"c\""],
    "d",
    'Expected "a", "b" or "c", but "d" found.'
  );

  var choiceParser2 = PEG.buildParser('start = "a" "b" "c" / "a"');
  doesNotParseWithDetails(
    choiceParser2,
    "abd",
    ["\"c\""],
    "d",
    'Expected "c", but "d" found.'
  );

  var choiceParser3 = PEG.buildParser('start = ("a" { return null; }) "b" "c" / "a"');
  doesNotParseWithDetails(
    choiceParser3,
    "abd",
    [],
    "b",
    'Expected '+EOI+', but "b" found.'
  );

  var choiceParser4 = PEG.buildParser('start = "a" "b" ("c" { return null; }) / "a" "b" "w"');
  doesNotParseWithDetails(
    choiceParser4,
    "abd",
    ["\"c\"", "\"w\""],
    "d",    
    'Expected "c" or "w", but "d" found.'
  );
 
  var choiceParser5 = PEG.buildParser('start = "a" "b" . / "a" "b" "w"');
  doesNotParseWithDetails(
    choiceParser5,
    "ab", // NB: in sorted variant, it will be 'any character or "w"'
    ["any character", "\"w\""],
    null,   
    'Expected any character or "w", but end of input found.'
  );
 
  // "a"  "b" &. "a" / "a" "b" "w" :: "abd"
  // "a"  "b" &. / "a" "b" "w" :: "abd"

  var simpleNotParser = PEG.buildParser('start = !"a" "b"');
  doesNotParseWithDetails(
    simpleNotParser,
    "c",
    ["\"b\""],
    "c",
    'Expected "b", but "c" found.'
  );

  var simpleAndParser = PEG.buildParser('start = &"a" [a-b]');
  doesNotParseWithDetails(
    simpleAndParser,
    "c",
    [],
    "c",
    'Expected '+EOI+', but "c" found.'
  );

  var emptyParser = PEG.buildParser('start = ');
  doesNotParseWithDetails(
    emptyParser,
    "something",
    [],
    "s",
    'Expected '+EOI+', but "s" found.'
  );

  var duplicateErrorParser = PEG.buildParser('start = "a" / "a"');
  doesNotParseWithDetails(
    duplicateErrorParser,
    "",
    ["\"a\""],
    null,
    'Expected "a", but '+EOI+' found.'
  );

  var unsortedErrorsParser = PEG.buildParser('start = "b" / "a"');
  doesNotParseWithDetails(
    unsortedErrorsParser,
    "",
    // NB: differs from original peg.js, I refused sorting errors 
    //     to improve parser simplicity / speed. User may sort
    //     them himself, if he needs it. 
    ["\"b\"", "\"a\""],
    null,
    'Expected "b" or "a" but '+EOI+' found.'
  );
});

test("error positions", function() {
  var simpleParser = PEG.buildParser('start = "a"');

  /* Regular match failure */
  doesNotParseWithPos(simpleParser, "b", 0, 1, 1);

  /* Trailing input */
  doesNotParseWithPos(simpleParser, "ab", 1, 1, 2);

  var digitsParser = PEG.buildParser([
    'start  = line (("\\r" / "\\n" / "\\u2028" / "\\u2029")+ line)*',
    'line   = digits (" "+ digits)*',
    'digits = digits:[0-9]+ { return ctx.digits.join(""); }'
  ].join("\n"));

  doesNotParseWithPos(digitsParser, "1\n2\n\n3\n\n\n4 5 x", 13, 7, 5);

  /* Non-Unix newlines */
  doesNotParseWithPos(digitsParser, "1\rx", 2, 2, 1);   // Old Mac
  doesNotParseWithPos(digitsParser, "1\r\nx", 3, 2, 1); // Windows
  doesNotParseWithPos(digitsParser, "1\n\rx", 3, 3, 1); // mismatched

  /* Strange newlines */
  doesNotParseWithPos(digitsParser, "1\u2028x", 2, 2, 1); // line separator
  doesNotParseWithPos(digitsParser, "1\u2029x", 2, 2, 1); // paragraph separator
});

test("start rule", function() {
  var parser = PEG.buildParser([
    'a = .* { return "alpha"; }',
    'b = .* { return "beta"; }'
  ].join("\n"));

  /* Default start rule = the first one */
  parses(parser, "whatever", "alpha");

  /* Explicit specification of the start rule */
  parsesWithStartRule(parser, "whatever", "a", "alpha");
  parsesWithStartRule(parser, "whatever", "b", "beta");

  /* Invalid rule name */
  raises(
    function() { parser.parse("whatever", "c"); },
    function(e) {
      return e instanceof Error && e.message === "Invalid rule name: \"c\".";
    }
  );
});

/*
 * Following examples are from Wikipedia, see
 * http://en.wikipedia.org/w/index.php?title=Parsing_expression_grammar&oldid=335106938.
 */

test("arithmetics", function() {
  /*
   * Value   ← [0-9]+ / '(' Expr ')'
   * Product ← Value (('*' / '/') Value)*
   * Sum     ← Product (('+' / '-') Product)*
   * Expr    ← Sum
   */
  var parser = PEG.buildParser([
    'Expr    = Sum',
    'Sum     = head:Product tail:(("+" / "-") Product)* {',
    '            var result = ctx.head;',
    '            for (var i = 0; i < ctx.tail.length; i++) {',
    '              if (ctx.tail[i][0] == "+") { result += ctx.tail[i][1]; }',
    '              if (ctx.tail[i][0] == "-") { result -= ctx.tail[i][1]; }',
    '            }',
    '            return result;',
    '          }',
    'Product = head:Value tail:(("*" / "/") Value)* {',
    '            var result = ctx.head;',
    '            for (var i = 0; i < ctx.tail.length; i++) {',
    '              if (ctx.tail[i][0] == "*") { result *= ctx.tail[i][1]; }',
    '              if (ctx.tail[i][0] == "/") { result /= ctx.tail[i][1]; }',
    '            }',
    '            return result;',
    '          }',
    'Value   = digits:[0-9]+     { return parseInt(ctx.digits.join("")); }',
    '        / "(" expr:Expr ")" { return ctx.expr; }'
  ].join("\n"));

  /* Test "value" rule. */
  parses(parser, "0", 0);
  parses(parser, "123", 123);
  parses(parser, "(42+43)", 42+43);

  /* Test "product" rule. */
  parses(parser, "42", 42);
  parses(parser, "42*43", 42*43);
  parses(parser, "42*43*44*45", 42*43*44*45);
  parses(parser, "42/43", 42/43);
  parses(parser, "42/43/44/45", 42/43/44/45);

  /* Test "sum" rule. */
  parses(parser, "42*43", 42*43);
  parses(parser, "42*43+44*45", 42*43+44*45);
  parses(parser, "42*43+44*45+46*47+48*49", 42*43+44*45+46*47+48*49);
  parses(parser, "42*43-44*45", 42*43-44*45);
  parses(parser, "42*43-44*45-46*47-48*49", 42*43-44*45-46*47-48*49);

  /* Test "expr" rule. */
  parses(parser, "42+43", 42+43);

  /* Complex test */
  parses(parser, "(1+2)*(3+4)",(1+2)*(3+4));
});

test("non-context-free language", function() {
  /* The following parsing expression grammar describes the classic
   * non-context-free language { a^n b^n c^n : n >= 1 }:
   *
   * S ← &(A c) a+ B !(a/b/c)
   * A ← a A? b
   * B ← b B? c
   */
  var parser = PEG.buildParser([
    'S = &(A "c") a:"a"+ B:B !("a" / "b" / "c") { return ctx.a.join("") + ctx.B; }',
    'A = a:"a" A:A? b:"b" { return ctx.a + ctx.A + ctx.b; }',
    'B = b:"b" B:B? c:"c" { return ctx.b + ctx.B + ctx.c; }'
  ].join("\n"));

  parses(parser, "abc", "abc");
  parses(parser, "aaabbbccc", "aaabbbccc");
  doesNotParse(parser, "aabbbccc");
  doesNotParse(parser, "aaaabbbccc");
  doesNotParse(parser, "aaabbccc");
  doesNotParse(parser, "aaabbbbccc");
  doesNotParse(parser, "aaabbbcc");
  doesNotParse(parser, "aaabbbcccc");
});

test("nested comments", function() {
  /*
   * Begin ← "(*"
   * End ← "*)"
   * C ← Begin N* End
   * N ← C / (!Begin !End Z)
   * Z ← any single character
   */
  var parser = PEG.buildParser([
    'C     = begin:Begin ns:N* end:End { return ctx.begin + ctx.ns.join("") + ctx.end; }',
    'N     = C',
    '      / !Begin !End z:Z { return ctx.z; }',
    'Z     = .',
    'Begin = "(*"',
    'End   = "*)"'
  ].join("\n"));

  parses(parser, "(**)", "(**)");
  parses(parser, "(*abc*)", "(*abc*)");
  parses(parser, "(*(**)*)", "(*(**)*)");
  parses(
    parser,
    "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)",
    "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)"
  );
});

// TODO: test our version of cache
// TODO: test rules prepared once module is loaded
// TODO: test operators prepared once module is loaded
// TODO: test operators not executed when not required and executed in order
// TODO: test all exported functions (including xpos here and there)
// TODO: test parser options (i.e., name of 'ctx' var)
// TODO: test levels of context and variables are inaccessible between code block at the same level
// TODO: test errors a lot
// TODO: test that none of operators or rules are accessible inside client code
// TODO: test that all of exported functions are accessible inside client code
// TODO: test that only one exception reaches parser even if something failed couple of times
// TODO: test that even rules parts are already compiled before first parse
// TODO: test that chunk accessible only in action
// TODO: test ctx is only in initializer, 
//            ctx/cpos is in only in semantic and/not 
//            and ctx/chunk is only in action
// TODO: wrap in inner tests tree when changing to jasmine
// TODO: test rname in MatchFailed error
// TODO: test MatchFailed localisation? (use special codes for "any character" and the stuff)

})();