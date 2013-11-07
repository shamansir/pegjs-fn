/*
 * PEG.js 0.7.0-fn
 *
 * Modified by shaman.sir
 * http://shamansir.github.io/pegjs-fn/
 *
 * An original PEG.js and much much much faster working version than this one is located here:
 *
 * http://pegjs.majda.cz/
 *
 * Copyright (c) 2010-2013 David Majda
 * Licensend under the MIT license.
 */
var PEG = (function(undefined) {
  var modules = {
    define: function(name, factory) {
      var dir    = name.replace(/(^|\/)[^/]+$/, "$1"),
          module = { exports: {} };

      function require(path) {
        var name   = dir + path,
            regexp = /[^\/]+\/\.\.\/|\.\//;

        /* Can't use /.../g because we can move backwards in the string. */
        while (regexp.test(name)) {
          name = name.replace(regexp, "");
        }

        return modules[name];
      }

      factory(module, require);
      this[name] = module.exports;
    }
  };

  modules.define("utils", function(module, require) {
    var utils = {
      /* Like Python's |range|, but without |step|. */
      range: function(start, stop) {
        if (stop === undefined) {
          stop = start;
          start = 0;
        }

        var result = new Array(Math.max(0, stop - start));
        for (var i = 0, j = start; j < stop; i++, j++) {
          result[i] = j;
        }
        return result;
      },

      find: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (callback(array[i])) {
            return array[i];
          }
        }
      },

      indexOf: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (callback(array[i])) {
            return i;
          }
        }
        return -1;
      },

      contains: function(array, value) {
        /*
         * Stupid IE does not have Array.prototype.indexOf, otherwise this function
         * would be a one-liner.
         */
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (array[i] === value) {
            return true;
          }
        }
        return false;
      },

      each: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          callback(array[i], i);
        }
      },

      map: function(array, callback) {
        var result = [];
        var length = array.length;
        for (var i = 0; i < length; i++) {
          result[i] = callback(array[i], i);
        }
        return result;
      },

      pluck: function(array, key) {
        return utils.map(array, function (e) { return e[key]; });
      },

      keys: function(object) {
        var result = [];
        for (var key in object) {
          result.push(key);
        }
        return result;
      },

      values: function(object) {
        var result = [];
        for (var key in object) {
          result.push(object[key]);
        }
        return result;
      },

      clone: function(object) {
        var result = {};
        for (var key in object) {
          result[key] = object[key];
        }
        return result;
      },

      defaults: function(object, defaults) {
        for (var key in defaults) {
          if (!(key in object)) {
            object[key] = defaults[key];
          }
        }
      },

      /*
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      subclass: function(child, parent) {
        function ctor() { this.constructor = child; }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
      },

      /*
       * Returns a string padded on the left to a desired length with a character.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      padLeft: function(input, padding, length) {
        var result = input;

        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }

        return result;
      },

      /*
       * Returns an escape sequence for given character. Uses \x for characters <=
       * 0xFF to save space, \u for the rest.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      escape: function(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;

        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }

        return '\\' + escapeChar + utils.padLeft(charCode.toString(16).toUpperCase(), '0', length);
      },

      /*
       * Surrounds the string with quotes and escapes characters inside so that the
       * result is a valid JavaScript string.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      quote: function(s) {
        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
         * literal except for the closing quote character, backslash, carriage
         * return, line separator, paragraph separator, and line feed. Any character
         * may appear in the form of an escape sequence.
         *
         * For portability, we also escape all control and non-ASCII characters.
         * Note that "\0" and "\v" escape sequences are not used because JSHint does
         * not like the first and IE the second.
         */
        return '"' + s
          .replace(/\\/g, '\\\\')  // backslash
          .replace(/"/g, '\\"')    // closing quote character
          .replace(/\x08/g, '\\b') // backspace
          .replace(/\t/g, '\\t')   // horizontal tab
          .replace(/\n/g, '\\n')   // line feed
          .replace(/\f/g, '\\f')   // form feed
          .replace(/\r/g, '\\r')   // carriage return
          .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, utils.escape)
          + '"';
      },

      /*
       * Escapes characters inside the string so that it can be used as a list of
       * characters in a character class of a regular expression.
       */
      quoteForRegexpClass: function(s) {
        /*
         * Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
         *
         * For portability, we also escape all control and non-ASCII characters.
         */
        return s
          .replace(/\\/g, '\\\\')  // backslash
          .replace(/\//g, '\\/')   // closing slash
          .replace(/\]/g, '\\]')   // closing bracket
          .replace(/\^/g, '\\^')   // caret
          .replace(/-/g,  '\\-')   // dash
          .replace(/\0/g, '\\0')   // null
          .replace(/\t/g, '\\t')   // horizontal tab
          .replace(/\n/g, '\\n')   // line feed
          .replace(/\v/g, '\\x0B') // vertical tab
          .replace(/\f/g, '\\f')   // form feed
          .replace(/\r/g, '\\r')   // carriage return
          .replace(/[\x01-\x08\x0E-\x1F\x80-\uFFFF]/g, utils.escape);
      },

      /*
       * Builds a node visitor -- a function which takes a node and any number of
       * other parameters, calls an appropriate function according to the node type,
       * passes it all its parameters and returns its value. The functions for
       * various node types are passed in a parameter to |buildNodeVisitor| as a
       * hash.
       */
      buildNodeVisitor: function(functions) {
        return function(node) {
          return functions[node.type].apply(null, arguments);
        };
      },

      findRuleByName: function(ast, name) {
        return utils.find(ast.rules, function(r) { return r.name === name; });
      },

      indexOfRuleByName: function(ast, name) {
        return utils.indexOf(ast.rules, function(r) { return r.name === name; });
      }
    };

    module.exports = utils;
  });

  modules.define("grammar-error", function(module, require) {
    var utils = require("./utils");

    /* Thrown when the grammar contains an error. */
    module.exports = function(message) {
      this.name = "GrammarError";
      this.message = message;
    };

    utils.subclass(module.exports, Error);
  });

  modules.define("parser", function(module, require) {
    module.exports = (function(){
      /* Generated by PEG.js-fn @VERSION (http://pegjs.majda.cz/). */
      /* Functional modification by shaman.sir@gmail.com (http://shamansir.github.com/). */

      /* ########### ENVIRONMENT ########### */

      var input,
          options;

      var pos, // 0, parser position
          p_pos; // 0, previous parser position


      // This code encloses all of the user blocks (initializer and/or actions)
      // in their own sandbox, so if there is an initializer, its inner variables
      // will [only] be accessible to actions; this, however, requires an initializer
      // not to have any first-level return statements. Also, this approach keeps parser
      // inner variables safe from user access, except the ones defined above.
      var __p_blocks = (function() { return function() {

        // backwards compatibility with original peg-js
        function offset() { return p_pos; };
        function text() { return input.substring(p_pos, pos); };

        /* ########### USER CODE ########### */


        /* ----------- INITIALIZER ----------- */

          var utils = require("./utils");


        /* ----------- BLOCKS ----------- */

        // Blocks are grouped by rule name and id; they all get access to current context
        // through č variable which they expand into their arguments. Arguments
        // names are precalculated during parser generation process.

        // ƒ and č variables are named so creepy just to ensure that parser writer will not use them
        // for naming variables in his code (only č may clash in this architecture, in fact),
        // we hope any modern environment supports Unicode now

        return {
          "grammar": [
            function(č) {
              // grammar[0]
              return (function(initializer,rules) {

                      return {
                        type:        "grammar",
                        initializer: initializer !== "" ? initializer : null,
                        rules:       rules
                      };

              })(č.initializer,č.rules);
            }
          ],
          "initializer": [
            function(č) {
              // initializer[0]
              return (function(code) {

                      return {
                        type: "initializer",
                        code: code
                      };

              })(č.code);
            }
          ],
          "rule": [
            function(č) {
              // rule[0]
              return (function(name,displayName,expression) {

                      return {
                        type:        "rule",
                        name:        name,
                        expression:  displayName !== ""
                          ? {
                              type:       "named",
                              name:       displayName,
                              expression: expression
                            }
                          : expression
                      };

              })(č.name,č.displayName,č.expression);
            }
          ],
          "choice": [
            function(č) {
              // choice[0]
              return (function(head,tail) {

                      if (tail.length > 0) {
                        var alternatives = [head].concat(utils.map(
                            tail,
                            function(element) { return element[1]; }
                        ));
                        return {
                          type:         "choice",
                          alternatives: alternatives
                        };
                      } else {
                        return head;
                      }

              })(č.head,č.tail);
            }
          ],
          "sequence": [
            function(č) {
              // sequence[0]
              return (function(elements,code) {

                      var expression = elements.length !== 1
                        ? {
                            type:     "sequence",
                            elements: elements
                          }
                        : elements[0];
                      return {
                        type:       "action",
                        expression: expression,
                        code:       code
                      };

              })(č.elements,č.code);
            },
            function(č) {
              // sequence[1]
              return (function(elements) {

                      return elements.length !== 1
                        ? {
                            type:     "sequence",
                            elements: elements
                          }
                        : elements[0];

              })(č.elements);
            }
          ],
          "labeled": [
            function(č) {
              // labeled[0]
              return (function(label,expression) {

                      return {
                        type:       "labeled",
                        label:      label,
                        expression: expression
                      };

              })(č.label,č.expression);
            }
          ],
          "prefixed": [
            function(č) {
              // prefixed[0]
              return (function(expression) {

                      return {
                        type:       "text",
                        expression: expression
                      };

              })(č.expression);
            },
            function(č) {
              // prefixed[1]
              return (function(code) {

                      return {
                        type: "semantic_and",
                        code: code
                      };

              })(č.code);
            },
            function(č) {
              // prefixed[2]
              return (function(expression) {

                      return {
                        type:       "simple_and",
                        expression: expression
                      };

              })(č.expression);
            },
            function(č) {
              // prefixed[3]
              return (function(code) {

                      return {
                        type: "semantic_not",
                        code: code
                      };

              })(č.code);
            },
            function(č) {
              // prefixed[4]
              return (function(expression) {

                      return {
                        type:       "simple_not",
                        expression: expression
                      };

              })(č.expression);
            }
          ],
          "suffixed": [
            function(č) {
              // suffixed[0]
              return (function(expression) {

                      return {
                        type:       "optional",
                        expression: expression
                      };

              })(č.expression);
            },
            function(č) {
              // suffixed[1]
              return (function(expression) {

                      return {
                        type:       "zero_or_more",
                        expression: expression
                      };

              })(č.expression);
            },
            function(č) {
              // suffixed[2]
              return (function(expression) {

                      return {
                        type:       "one_or_more",
                        expression: expression
                      };

              })(č.expression);
            }
          ],
          "primary": [
            function(č) {
              // primary[0]
              return (function(name) {

                      return {
                        type: "rule_ref",
                        name: name
                      };

              })(č.name);
            },
            function(č) {
              // primary[1]
               return { type: "any" };
            },
            function(č) {
              // primary[2]
              return (function(expression) {
                 return expression;
              })(č.expression);
            }
          ],
          "action": [
            function(č) {
              // action[0]
              return (function(braced) {
                 return braced.substr(1, braced.length - 2);
              })(č.braced);
            }
          ],
          "equals": [
            function(č) {
              // equals[0]
               return "=";
            }
          ],
          "colon": [
            function(č) {
              // colon[0]
               return ":";
            }
          ],
          "semicolon": [
            function(č) {
              // semicolon[0]
               return ";";
            }
          ],
          "slash": [
            function(č) {
              // slash[0]
               return "/";
            }
          ],
          "and": [
            function(č) {
              // and[0]
               return "&";
            }
          ],
          "not": [
            function(č) {
              // not[0]
               return "!";
            }
          ],
          "dollar": [
            function(č) {
              // dollar[0]
               return "$";
            }
          ],
          "question": [
            function(č) {
              // question[0]
               return "?";
            }
          ],
          "star": [
            function(č) {
              // star[0]
               return "*";
            }
          ],
          "plus": [
            function(č) {
              // plus[0]
               return "+";
            }
          ],
          "lparen": [
            function(č) {
              // lparen[0]
               return "(";
            }
          ],
          "rparen": [
            function(č) {
              // rparen[0]
               return ")";
            }
          ],
          "dot": [
            function(č) {
              // dot[0]
               return ".";
            }
          ],
          "identifier": [
            function(č) {
              // identifier[0]
              return (function(chars) {
                 return chars;
              })(č.chars);
            }
          ],
          "literal": [
            function(č) {
              // literal[0]
              return (function(value,flags) {

                      return {
                        type:       "literal",
                        value:      value,
                        ignoreCase: flags === "i"
                      };

              })(č.value,č.flags);
            }
          ],
          "string": [
            function(č) {
              // string[0]
              return (function(string) {
                 return string;
              })(č.string);
            }
          ],
          "doubleQuotedString": [
            function(č) {
              // doubleQuotedString[0]
              return (function(chars) {
                 return chars.join("");
              })(č.chars);
            }
          ],
          "simpleDoubleQuotedCharacter": [
            function(č) {
              // simpleDoubleQuotedCharacter[0]
              return (function(char_) {
                 return char_;
              })(č.char_);
            }
          ],
          "singleQuotedString": [
            function(č) {
              // singleQuotedString[0]
              return (function(chars) {
                 return chars.join("");
              })(č.chars);
            }
          ],
          "simpleSingleQuotedCharacter": [
            function(č) {
              // simpleSingleQuotedCharacter[0]
              return (function(char_) {
                 return char_;
              })(č.char_);
            }
          ],
          "class": [
            function(č) {
              // class[0]
              return (function(inverted,parts,flags) {

                      var partsConverted = utils.map(parts, function(part) { return part.data; });
                      var rawText = "["
                        + inverted
                        + utils.map(parts, function(part) { return part.rawText; }).join("")
                        + "]"
                        + flags;

                      return {
                        type:       "class",
                        parts:      partsConverted,
                        // FIXME: Get the raw text from the input directly.
                        rawText:    rawText,
                        inverted:   inverted === "^",
                        ignoreCase: flags === "i"
                      };

              })(č.inverted,č.parts,č.flags);
            }
          ],
          "classCharacterRange": [
            function(č) {
              // classCharacterRange[0]
              return (function(begin,end) {

                      if (begin.data.charCodeAt(0) > end.data.charCodeAt(0)) {
                        throw new this.SyntaxError(
                          "Invalid character range: " + begin.rawText + "-" + end.rawText + "."
                        );
                      }

                      return {
                        data:    [begin.data, end.data],
                        // FIXME: Get the raw text from the input directly.
                        rawText: begin.rawText + "-" + end.rawText
                      };

              })(č.begin,č.end);
            }
          ],
          "classCharacter": [
            function(č) {
              // classCharacter[0]
              return (function(char_) {

                      return {
                        data:    char_,
                        // FIXME: Get the raw text from the input directly.
                        rawText: utils.quoteForRegexpClass(char_)
                      };

              })(č.char_);
            }
          ],
          "simpleBracketDelimitedCharacter": [
            function(č) {
              // simpleBracketDelimitedCharacter[0]
              return (function(char_) {
                 return char_;
              })(č.char_);
            }
          ],
          "simpleEscapeSequence": [
            function(č) {
              // simpleEscapeSequence[0]
              return (function(char_) {

                      return char_
                        .replace("b", "\b")
                        .replace("f", "\f")
                        .replace("n", "\n")
                        .replace("r", "\r")
                        .replace("t", "\t")
                        .replace("v", "\x0B"); // IE does not recognize "\v".

              })(č.char_);
            }
          ],
          "zeroEscapeSequence": [
            function(č) {
              // zeroEscapeSequence[0]
               return "\x00";
            }
          ],
          "hexEscapeSequence": [
            function(č) {
              // hexEscapeSequence[0]
              return (function(digits) {

                      return String.fromCharCode(parseInt(digits, 16));

              })(č.digits);
            }
          ],
          "unicodeEscapeSequence": [
            function(č) {
              // unicodeEscapeSequence[0]
              return (function(digits) {

                      return String.fromCharCode(parseInt(digits, 16));

              })(č.digits);
            }
          ],
          "eolEscapeSequence": [
            function(č) {
              // eolEscapeSequence[0]
              return (function(eol) {
                 return eol;
              })(č.eol);
            }
          ],
        };

      } })();

      // ƒ and č variables are named so creepy just to ensure that parser writer will not use them
      // for naming variables in his code (only č may clash in this architecture, in fact),
      // we hope any modern environment supports Unicode now
      var ƒ = null; // holds a pointer to current rule blocks, will be initialized in parse() function

      /* ########### PARSER ########### */

      var __parser = function() {

      /* =========== PARSER-DEPENDENT CODE =========== */

        /* ----------- RULES DEFINITIONS ----------- */

        var rules = {}; (function() {

        rules.grammar = function() {
          var _code = ƒ.grammar;
          return (
            action(
              seqnc(
                ref(rules.__),
                label("initializer",
                  maybe(
                    ref(rules.initializer)
                  )
                ),
                label("rules",
                  some(
                    ref(rules.rule)
                  )
                )
              ),
              _code[0])
              /*{
                    return {
                      type:        "grammar",
                      initializer: initializer !== "" ? initializer : null,
                      rules:       rules
                    };
                  }*/
          ());
        }

        rules.initializer = function() {
          var _code = ƒ.initializer;
          return (
            action(
              seqnc(
                label("code",
                  ref(rules.action)
                ),
                maybe(
                  ref(rules.semicolon)
                )
              ),
              _code[0])
              /*{
                    return {
                      type: "initializer",
                      code: code
                    };
                  }*/
          ());
        }

        rules.rule = function() {
          var _code = ƒ.rule;
          return (
            action(
              seqnc(
                label("name",
                  ref(rules.identifier)
                ),
                label("displayName",
                  maybe(
                    ref(rules.string)
                  )
                ),
                ref(rules.equals),
                label("expression",
                  ref(rules.choice)
                ),
                maybe(
                  ref(rules.semicolon)
                )
              ),
              _code[0])
              /*{
                    return {
                      type:        "rule",
                      name:        name,
                      expression:  displayName !== ""
                        ? {
                            type:       "named",
                            name:       displayName,
                            expression: expression
                          }
                        : expression
                    };
                  }*/
          ());
        }

        rules.choice = function() {
          var _code = ƒ.choice;
          return (
            action(
              seqnc(
                label("head",
                  ref(rules.sequence)
                ),
                label("tail",
                  any(
                    seqnc(
                      ref(rules.slash),
                      ref(rules.sequence)
                    )
                  )
                )
              ),
              _code[0])
              /*{
                    if (tail.length > 0) {
                      var alternatives = [head].concat(utils.map(
                          tail,
                          function(element) { return element[1]; }
                      ));
                      return {
                        type:         "choice",
                        alternatives: alternatives
                      };
                    } else {
                      return head;
                    }
                  }*/
          ());
        }

        rules.sequence = function() {
          var _code = ƒ.sequence;
          return (
            choice(
              action(
                seqnc(
                  label("elements",
                    any(
                      ref(rules.labeled)
                    )
                  ),
                  label("code",
                    ref(rules.action)
                  )
                ),
                _code[0])
                /*{
                      var expression = elements.length !== 1
                        ? {
                            type:     "sequence",
                            elements: elements
                          }
                        : elements[0];
                      return {
                        type:       "action",
                        expression: expression,
                        code:       code
                      };
                    }*/,
              action(
                label("elements",
                  any(
                    ref(rules.labeled)
                  )
                ),
                _code[1])
                /*{
                      return elements.length !== 1
                        ? {
                            type:     "sequence",
                            elements: elements
                          }
                        : elements[0];
                    }*/
            )
          ());
        }

        rules.labeled = function() {
          var _code = ƒ.labeled;
          return (
            choice(
              action(
                seqnc(
                  label("label",
                    ref(rules.identifier)
                  ),
                  ref(rules.colon),
                  label("expression",
                    ref(rules.prefixed)
                  )
                ),
                _code[0])
                /*{
                      return {
                        type:       "labeled",
                        label:      label,
                        expression: expression
                      };
                    }*/,
              ref(rules.prefixed)
            )
          ());
        }

        rules.prefixed = function() {
          var _code = ƒ.prefixed;
          return (
            choice(
              action(
                seqnc(
                  ref(rules.dollar),
                  label("expression",
                    ref(rules.suffixed)
                  )
                ),
                _code[0])
                /*{
                      return {
                        type:       "text",
                        expression: expression
                      };
                    }*/,
              action(
                seqnc(
                  ref(rules.and),
                  label("code",
                    ref(rules.action)
                  )
                ),
                _code[1])
                /*{
                      return {
                        type: "semantic_and",
                        code: code
                      };
                    }*/,
              action(
                seqnc(
                  ref(rules.and),
                  label("expression",
                    ref(rules.suffixed)
                  )
                ),
                _code[2])
                /*{
                      return {
                        type:       "simple_and",
                        expression: expression
                      };
                    }*/,
              action(
                seqnc(
                  ref(rules.not),
                  label("code",
                    ref(rules.action)
                  )
                ),
                _code[3])
                /*{
                      return {
                        type: "semantic_not",
                        code: code
                      };
                    }*/,
              action(
                seqnc(
                  ref(rules.not),
                  label("expression",
                    ref(rules.suffixed)
                  )
                ),
                _code[4])
                /*{
                      return {
                        type:       "simple_not",
                        expression: expression
                      };
                    }*/,
              ref(rules.suffixed)
            )
          ());
        }

        rules.suffixed = function() {
          var _code = ƒ.suffixed;
          return (
            choice(
              action(
                seqnc(
                  label("expression",
                    ref(rules.primary)
                  ),
                  ref(rules.question)
                ),
                _code[0])
                /*{
                      return {
                        type:       "optional",
                        expression: expression
                      };
                    }*/,
              action(
                seqnc(
                  label("expression",
                    ref(rules.primary)
                  ),
                  ref(rules.star)
                ),
                _code[1])
                /*{
                      return {
                        type:       "zero_or_more",
                        expression: expression
                      };
                    }*/,
              action(
                seqnc(
                  label("expression",
                    ref(rules.primary)
                  ),
                  ref(rules.plus)
                ),
                _code[2])
                /*{
                      return {
                        type:       "one_or_more",
                        expression: expression
                      };
                    }*/,
              ref(rules.primary)
            )
          ());
        }

        rules.primary = function() {
          var _code = ƒ.primary;
          return (
            choice(
              action(
                seqnc(
                  label("name",
                    ref(rules.identifier)
                  ),
                  not(
                    seqnc(
                      maybe(
                        ref(rules.string)
                      ),
                      ref(rules.equals)
                    )
                  )
                ),
                _code[0])
                /*{
                      return {
                        type: "rule_ref",
                        name: name
                      };
                    }*/,
              ref(rules.literal),
              ref(rules.class),
              action(
                ref(rules.dot),
                _code[1])
                /*{ return { type: "any" }; }*/,
              action(
                seqnc(
                  ref(rules.lparen),
                  label("expression",
                    ref(rules.choice)
                  ),
                  ref(rules.rparen)
                ),
                _code[2])
                /*{ return expression; }*/
            )
          ());
        }

        rules.action = function() {
          var _code = ƒ.action;
          return (
            as("action",
              action(
                seqnc(
                  label("braced",
                    ref(rules.braced)
                  ),
                  ref(rules.__)
                ),
                _code[0])
                /*{ return braced.substr(1, braced.length - 2); }*/
            )
          ());
        }

        rules.braced = function() {
          return (
            text(
              seqnc(
                match("{"),
                any(
                  choice(
                    ref(rules.braced),
                    ref(rules.nonBraceCharacters)
                  )
                ),
                match("}")
              )
            )
          ());
        }

        rules.nonBraceCharacters = function() {
          return (
            some(
              ref(rules.nonBraceCharacter)
            )
          ());
        }

        rules.nonBraceCharacter = function() {
          return (
            re(/^[^{}]/, "[^{}]")
          ());
        }

        rules.equals = function() {
          var _code = ƒ.equals;
          return (
            action(
              seqnc(
                match("="),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "="; }*/
          ());
        }

        rules.colon = function() {
          var _code = ƒ.colon;
          return (
            action(
              seqnc(
                match(":"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return ":"; }*/
          ());
        }

        rules.semicolon = function() {
          var _code = ƒ.semicolon;
          return (
            action(
              seqnc(
                match(";"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return ";"; }*/
          ());
        }

        rules.slash = function() {
          var _code = ƒ.slash;
          return (
            action(
              seqnc(
                match("/"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "/"; }*/
          ());
        }

        rules.and = function() {
          var _code = ƒ.and;
          return (
            action(
              seqnc(
                match("&"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "&"; }*/
          ());
        }

        rules.not = function() {
          var _code = ƒ.not;
          return (
            action(
              seqnc(
                match("!"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "!"; }*/
          ());
        }

        rules.dollar = function() {
          var _code = ƒ.dollar;
          return (
            action(
              seqnc(
                match("$"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "$"; }*/
          ());
        }

        rules.question = function() {
          var _code = ƒ.question;
          return (
            action(
              seqnc(
                match("?"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "?"; }*/
          ());
        }

        rules.star = function() {
          var _code = ƒ.star;
          return (
            action(
              seqnc(
                match("*"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "*"; }*/
          ());
        }

        rules.plus = function() {
          var _code = ƒ.plus;
          return (
            action(
              seqnc(
                match("+"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "+"; }*/
          ());
        }

        rules.lparen = function() {
          var _code = ƒ.lparen;
          return (
            action(
              seqnc(
                match("("),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "("; }*/
          ());
        }

        rules.rparen = function() {
          var _code = ƒ.rparen;
          return (
            action(
              seqnc(
                match(")"),
                ref(rules.__)
              ),
              _code[0])
              /*{ return ")"; }*/
          ());
        }

        rules.dot = function() {
          var _code = ƒ.dot;
          return (
            action(
              seqnc(
                match("."),
                ref(rules.__)
              ),
              _code[0])
              /*{ return "."; }*/
          ());
        }

        rules.identifier = function() {
          var _code = ƒ.identifier;
          return (
            as("identifier",
              action(
                seqnc(
                  label("chars",
                    text(
                      seqnc(
                        choice(
                          ref(rules.letter),
                          match("_")
                        ),
                        any(
                          choice(
                            ref(rules.letter),
                            ref(rules.digit),
                            match("_")
                          )
                        )
                      )
                    )
                  ),
                  ref(rules.__)
                ),
                _code[0])
                /*{ return chars; }*/
            )
          ());
        }

        rules.literal = function() {
          var _code = ƒ.literal;
          return (
            as("literal",
              action(
                seqnc(
                  label("value",
                    choice(
                      ref(rules.doubleQuotedString),
                      ref(rules.singleQuotedString)
                    )
                  ),
                  label("flags",
                    maybe(
                      match("i")
                    )
                  ),
                  ref(rules.__)
                ),
                _code[0])
                /*{
                      return {
                        type:       "literal",
                        value:      value,
                        ignoreCase: flags === "i"
                      };
                    }*/
            )
          ());
        }

        rules.string = function() {
          var _code = ƒ.string;
          return (
            as("string",
              action(
                seqnc(
                  label("string",
                    choice(
                      ref(rules.doubleQuotedString),
                      ref(rules.singleQuotedString)
                    )
                  ),
                  ref(rules.__)
                ),
                _code[0])
                /*{ return string; }*/
            )
          ());
        }

        rules.doubleQuotedString = function() {
          var _code = ƒ.doubleQuotedString;
          return (
            action(
              seqnc(
                match("\""),
                label("chars",
                  any(
                    ref(rules.doubleQuotedCharacter)
                  )
                ),
                match("\"")
              ),
              _code[0])
              /*{ return chars.join(""); }*/
          ());
        }

        rules.doubleQuotedCharacter = function() {
          return (
            choice(
              ref(rules.simpleDoubleQuotedCharacter),
              ref(rules.simpleEscapeSequence),
              ref(rules.zeroEscapeSequence),
              ref(rules.hexEscapeSequence),
              ref(rules.unicodeEscapeSequence),
              ref(rules.eolEscapeSequence)
            )
          ());
        }

        rules.simpleDoubleQuotedCharacter = function() {
          var _code = ƒ.simpleDoubleQuotedCharacter;
          return (
            action(
              seqnc(
                not(
                  choice(
                    match("\""),
                    match("\\"),
                    ref(rules.eolChar)
                  )
                ),
                label("char_",
                  ch()
                )
              ),
              _code[0])
              /*{ return char_; }*/
          ());
        }

        rules.singleQuotedString = function() {
          var _code = ƒ.singleQuotedString;
          return (
            action(
              seqnc(
                match("'"),
                label("chars",
                  any(
                    ref(rules.singleQuotedCharacter)
                  )
                ),
                match("'")
              ),
              _code[0])
              /*{ return chars.join(""); }*/
          ());
        }

        rules.singleQuotedCharacter = function() {
          return (
            choice(
              ref(rules.simpleSingleQuotedCharacter),
              ref(rules.simpleEscapeSequence),
              ref(rules.zeroEscapeSequence),
              ref(rules.hexEscapeSequence),
              ref(rules.unicodeEscapeSequence),
              ref(rules.eolEscapeSequence)
            )
          ());
        }

        rules.simpleSingleQuotedCharacter = function() {
          var _code = ƒ.simpleSingleQuotedCharacter;
          return (
            action(
              seqnc(
                not(
                  choice(
                    match("'"),
                    match("\\"),
                    ref(rules.eolChar)
                  )
                ),
                label("char_",
                  ch()
                )
              ),
              _code[0])
              /*{ return char_; }*/
          ());
        }

        rules.class = function() {
          var _code = ƒ.class;
          return (
            as("character class",
              action(
                seqnc(
                  match("["),
                  label("inverted",
                    maybe(
                      match("^")
                    )
                  ),
                  label("parts",
                    any(
                      choice(
                        ref(rules.classCharacterRange),
                        ref(rules.classCharacter)
                      )
                    )
                  ),
                  match("]"),
                  label("flags",
                    maybe(
                      match("i")
                    )
                  ),
                  ref(rules.__)
                ),
                _code[0])
                /*{
                      var partsConverted = utils.map(parts, function(part) { return part.data; });
                      var rawText = "["
                        + inverted
                        + utils.map(parts, function(part) { return part.rawText; }).join("")
                        + "]"
                        + flags;

                      return {
                        type:       "class",
                        parts:      partsConverted,
                        // FIXME: Get the raw text from the input directly.
                        rawText:    rawText,
                        inverted:   inverted === "^",
                        ignoreCase: flags === "i"
                      };
                    }*/
            )
          ());
        }

        rules.classCharacterRange = function() {
          var _code = ƒ.classCharacterRange;
          return (
            action(
              seqnc(
                label("begin",
                  ref(rules.classCharacter)
                ),
                match("-"),
                label("end",
                  ref(rules.classCharacter)
                )
              ),
              _code[0])
              /*{
                    if (begin.data.charCodeAt(0) > end.data.charCodeAt(0)) {
                      throw new this.SyntaxError(
                        "Invalid character range: " + begin.rawText + "-" + end.rawText + "."
                      );
                    }

                    return {
                      data:    [begin.data, end.data],
                      // FIXME: Get the raw text from the input directly.
                      rawText: begin.rawText + "-" + end.rawText
                    };
                  }*/
          ());
        }

        rules.classCharacter = function() {
          var _code = ƒ.classCharacter;
          return (
            action(
              label("char_",
                ref(rules.bracketDelimitedCharacter)
              ),
              _code[0])
              /*{
                    return {
                      data:    char_,
                      // FIXME: Get the raw text from the input directly.
                      rawText: utils.quoteForRegexpClass(char_)
                    };
                  }*/
          ());
        }

        rules.bracketDelimitedCharacter = function() {
          return (
            choice(
              ref(rules.simpleBracketDelimitedCharacter),
              ref(rules.simpleEscapeSequence),
              ref(rules.zeroEscapeSequence),
              ref(rules.hexEscapeSequence),
              ref(rules.unicodeEscapeSequence),
              ref(rules.eolEscapeSequence)
            )
          ());
        }

        rules.simpleBracketDelimitedCharacter = function() {
          var _code = ƒ.simpleBracketDelimitedCharacter;
          return (
            action(
              seqnc(
                not(
                  choice(
                    match("]"),
                    match("\\"),
                    ref(rules.eolChar)
                  )
                ),
                label("char_",
                  ch()
                )
              ),
              _code[0])
              /*{ return char_; }*/
          ());
        }

        rules.simpleEscapeSequence = function() {
          var _code = ƒ.simpleEscapeSequence;
          return (
            action(
              seqnc(
                match("\\"),
                not(
                  choice(
                    ref(rules.digit),
                    match("x"),
                    match("u"),
                    ref(rules.eolChar)
                  )
                ),
                label("char_",
                  ch()
                )
              ),
              _code[0])
              /*{
                    return char_
                      .replace("b", "\b")
                      .replace("f", "\f")
                      .replace("n", "\n")
                      .replace("r", "\r")
                      .replace("t", "\t")
                      .replace("v", "\x0B"); // IE does not recognize "\v".
                  }*/
          ());
        }

        rules.zeroEscapeSequence = function() {
          var _code = ƒ.zeroEscapeSequence;
          return (
            action(
              seqnc(
                match("\\0"),
                not(
                  ref(rules.digit)
                )
              ),
              _code[0])
              /*{ return "\x00"; }*/
          ());
        }

        rules.hexEscapeSequence = function() {
          var _code = ƒ.hexEscapeSequence;
          return (
            action(
              seqnc(
                match("\\x"),
                label("digits",
                  text(
                    seqnc(
                      ref(rules.hexDigit),
                      ref(rules.hexDigit)
                    )
                  )
                )
              ),
              _code[0])
              /*{
                    return String.fromCharCode(parseInt(digits, 16));
                  }*/
          ());
        }

        rules.unicodeEscapeSequence = function() {
          var _code = ƒ.unicodeEscapeSequence;
          return (
            action(
              seqnc(
                match("\\u"),
                label("digits",
                  text(
                    seqnc(
                      ref(rules.hexDigit),
                      ref(rules.hexDigit),
                      ref(rules.hexDigit),
                      ref(rules.hexDigit)
                    )
                  )
                )
              ),
              _code[0])
              /*{
                    return String.fromCharCode(parseInt(digits, 16));
                  }*/
          ());
        }

        rules.eolEscapeSequence = function() {
          var _code = ƒ.eolEscapeSequence;
          return (
            action(
              seqnc(
                match("\\"),
                label("eol",
                  ref(rules.eol)
                )
              ),
              _code[0])
              /*{ return eol; }*/
          ());
        }

        rules.digit = function() {
          return (
            re(/^[0-9]/, "[0-9]")
          ());
        }

        rules.hexDigit = function() {
          return (
            re(/^[0-9a-fA-F]/, "[0-9a-fA-F]")
          ());
        }

        rules.letter = function() {
          return (
            choice(
              ref(rules.lowerCaseLetter),
              ref(rules.upperCaseLetter)
            )
          ());
        }

        rules.lowerCaseLetter = function() {
          return (
            re(/^[a-z]/, "[a-z]")
          ());
        }

        rules.upperCaseLetter = function() {
          return (
            re(/^[A-Z]/, "[A-Z]")
          ());
        }

        rules.__ = function() {
          return (
            any(
              choice(
                ref(rules.whitespace),
                ref(rules.eol),
                ref(rules.comment)
              )
            )
          ());
        }

        rules.comment = function() {
          return (
            as("comment",
              choice(
                ref(rules.singleLineComment),
                ref(rules.multiLineComment)
              )
            )
          ());
        }

        rules.singleLineComment = function() {
          return (
            seqnc(
              match("//"),
              any(
                seqnc(
                  not(
                    ref(rules.eolChar)
                  ),
                  ch()
                )
              )
            )
          ());
        }

        rules.multiLineComment = function() {
          return (
            seqnc(
              match("/*"),
              any(
                seqnc(
                  not(
                    match("*/")
                  ),
                  ch()
                )
              ),
              match("*/")
            )
          ());
        }

        rules.eol = function() {
          return (
            as("end of line",
              choice(
                match("\n"),
                match("\r\n"),
                match("\r"),
                match("\u2028"),
                match("\u2029")
              )
            )
          ());
        }

        rules.eolChar = function() {
          return (
            re(/^[\n\r\u2028\u2029]/, "[\\n\\r\\u2028\\u2029]")
          ());
        }

        rules.whitespace = function() {
          return (
            as("whitespace",
              re(/^[ \t\x0B\f\xA0\uFEFF\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/, "[ \\t\\x0B\\f\\xA0\\uFEFF\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000]")
            )
          ());
        }

        })();

        /* ----------- OPERATORS ----------- */

        // get current char
        function cc() { return (pos < ilen) ? input.charAt(pos) : EOI; }

        var ref = def(inctx); // will call rule inside context

        function action(f, code) {
          return inctx(function() {
            p_pos = pos; var res; // save previous position
            f(); res = code(cctx);
            if (res === null) { pos = p_pos;
               failed(SOMETHING, NOTHING); }
            return res;
          });
        }
        action = def(action);

        function seqnc(/*f...*/) {
          var p_pos = pos; // save previous position locally
          var fs = arguments,
              s = [],
              on_miss = function(e) {
                            pos = p_pos; throw e; };
          for (var fi = 0, fl = fs.length;
               fi < fl; fi++) {
            s.push(safe(fs[fi], on_miss));
          }
          return s;
        }
        seqnc = def(seqnc);

        function as(name, f) {
          alias = name; var res = f();
          alias = ''; return res;
        }
        as = def(as);

        function choice(/*f...*/) {
          var fs = arguments,
              missed = 0,
              my_e = null,
              on_miss = function(e) {
                my_e = e; missed = 1;
              };
          for (var fi = 0, fl = fs.length;
               fi < fl; fi++) {
            var res = safe(fs[fi], on_miss);
            if (!missed) return res;
            missed = 0;
          }
          throw my_e;
        }
        choice = def(choice);

        function match(str) {
          var slen = str.length;
          if ((pos + slen) > ilen) {
            failed(quote(str), EOI); // exits
          }
          if (input.substr(pos, slen) === str) {
            pos += slen;
            return str;
          }
          failed(quote(str), cc());
        }
        match = def(match);

        function label(lbl, f) {
          return cctx[lbl] = f();
        }
        label = def(label);

        function text(f) {
          var p_pos = pos; // save previous position locally
          f(); return input.substr(p_pos,pos-p_pos);
        }
        text = def(text);

        function some(f) {
          return [f()].concat(any(f)());
        }
        some = def(some);

        function any(f) {
          var s = [],
              missed = 0,
              on_miss = function() { missed = 1; };
          while (!missed) {
            s.push(safe(f, on_miss));
          }
          if (missed) s.splice(-1);
          return s;
        }
        any = def(any);

        function maybe(f) {
          var missed = 0,
              res = safe(f, function() {
            missed = 1;
          });
          if (missed) return '';
          return res;
        }
        maybe = def(maybe);

        function not(f) {
          // save previous position locally
          var p_pos = pos, missed = 0;
          nr = 1; safe(f, function() {
            missed = 1;
          }); nr = 0;
          pos = p_pos;
          if (missed) return '';
          failed(EOI, cc());
        }
        not = def(not);

        function re(rx, desc) {
          var res, desc = desc || rx.source;
          if (res = rx.exec(input.substr(pos))) {
             if (res.index !== 0) failed(desc, cc());
             pos += res[0].length;
             return res[0];
          } else failed(desc, cc());
        }
        re = def(re);

        function ch() { // char
          if (pos >= ilen) failed(ANY, EOI);
          return input[pos++];
        }
        ch = def(ch);

      /* =========== PARSER-INDEPENDENT CODE =========== */

        /* ----------- VARIABLES ----------- */

        var cache, // {}, rule results cache, by name/pos
            ctx, // { ... }, total context
            cctx, // { ... }, current context pointer
            ctxl, // -1, context level
            current, // '-', current rule name
            alias; // '', current rule alias, if defined

        var failures, // {}, failures data
            rmfpos, // 0, rightmost failure position
            nr; // 0, no-report, fire errors w/o reporting

        var /*input, */ilen; // input, input length

        /* ----------- CONTEXT ----------- */

        function ctx_lvl(parent) {
          function CtxLevel() {
              this.__p = parent;
              this.__l = ++ctxl;
              this.__c = null;
          };
          CtxLevel.prototype = parent;
          return new CtxLevel();
        }

        function din() {  // dive in
          if (!cctx.__c) cctx.__c = ctx_lvl(cctx);
          cctx = cctx.__c;
        }
        function dout() { // dive out
          if (!cctx.__p) throw new Error('reached top context level');
          cctx = cctx.__p; --ctxl;
        }
        function inctx(f) { // execute in own context and return
          var r, e;
          din(); r = safe(f, function(err) { e = err; });
          dout(); if (e) throw e;
          return r;
        }

        /* ----------- DEFERRED ----------- */
        // Makes passed function to save its argument values,
        // but not execute until specially requested

        function def(f) {
          return function() {
            return (function(f, args) {
              return function() { return f.apply(null, args); };
            })(f, arguments);
          }
        }

        /* ----------- RULES WRAPPER ----------- */

        var ckey; // cache key
        for (var rule in rules) {
          rules[rule] = (function(name, rule) {
            return function() { current = name; return rule(); };
          })(rule, rules[rule]);
        }

        /* ----------- RESULT OBJECT + PARSE FUNCTION ----------- */

        var result = {
          /*
           * Parses the input with a generated parser. If the parsing is successfull,
           * returns a value explicitly or implicitly specified by the grammar from
           * which the parser was generated (see |PEG.buildParser|). If the parsing is
           * unsuccessful, throws |PEG.parser.MatchFailed| describing the error.
           */
          parse: function(_input, _opts) {
            var _opts = _opts || {};

            // initialize variables
            pos = 0, p_pos = 0, input = _input, options = _opts;

            ilen = input.length, failures = {}, rmfpos = 0, nr = 0;

            cache = {};
            ctxl = -1; ctx = ctx_lvl(), cctx = ctx;
            current = '-';

            var startRule = _opts.startRule || "grammar";
            if (["grammar"].indexOf(startRule) < 0) {
              throw new Error("Can't start parsing from rule " + quote(startRule) + ".");
            }

            // call user initializer and also
            // get blocks lying in the same context
            ƒ = __p_blocks();

            // find start rule
            if (startRule) {
              if (rules[startRule] === undefined) {
                throw new SyntaxError("Rule not found: " + quote(startRule) + ".");
              };
            } else {
              throw new Error("Start rule is not defined in options, no 'start' rule found and first rule in grammar was empty");
            }

            // and execute it
            var res;
            try {
              res = rules[startRule]();
              if ((pos < ilen) ||
                  (res === null)) failed(EOI, cc());
            } catch(e) {
              if (e instanceof MatchFailed) {
                // throw rightmost error instead
                throw adapt(failures[rmfpos]);
              }
              throw e;
            }

            return res;
          },


          /* makes error type accessible outside */
          MatchFailed: MatchFailed,
          SyntaxError: SyntaxError
        };

        /* ----------- UTILS ----------- */

        function Marker(human_str) { this.str=human_str; };
        Marker.prototype.toString = function() { return this.str; };
        var EOI = new Marker('end of input'),
            ANY = new Marker('any character'),
            SOMETHING = new Marker('progress'),
            NOTHING = new Marker('nothing');

        function hexOf(ch) {
          var x = ch.charCodeAt(0),
              v = x.toString(16).toUpperCase(),
              h = (x > 0xFF),
              i = (h ? 4 : 2) - v.length;
          while (i--) v = v + '0';
          return '\\' + (h ? 'u' : 'x') + v;
        }

        function quote(s) {
          /*
           * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
           * string literal except for the closing quote character, backslash,
           * carriage return, line separator, paragraph separator, and line feed.
           * Any character may appear in the form of an escape sequence.
           *
           * For portability, we also escape escape all control and non-ASCII
           * characters. Note that "\0" and "\v" escape sequences are not used
           * because JSHint does not like the first and IE the second.
           */
          return '"' + s
            .replace(/\\/g, '\\\\')  // backslash
            .replace(/"/g, '\\"')    // closing quote character
            .replace(/\x08/g, '\\b') // backspace
            .replace(/\t/g, '\\t')   // horizontal tab
            .replace(/\n/g, '\\n')   // line feed
            .replace(/\f/g, '\\f')   // form feed
            .replace(/\r/g, '\\r')   // carriage return
            .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, hexOf)
            + '"';
        }

        /* ----------- FAILURES ----------- */

        function MatchFailed(what, found, expected) {
          this.what = what;
          this.expected = expected || [];
          this.found = found;
          this.offset = pos;
          this.xpos = [-1, -1];
          this.line = -1;
          this.column = -1;
        }
        MatchFailed.prototype = new Error();
        MatchFailed.prototype.toString =
           function() { return 'MatchFailed: '+emsg(this); };
        var merr = function(fnd, exp) {
          return new MatchFailed(alias || current, fnd, exp);
        };

        function failed(expected, found) {
          var expected = alias || expected;
          // if no report required, just throw
          if (nr) throw merr(found, [expected]);
          if (pos > rmfpos) rmfpos = pos;
          var e = failures[pos] ||
                 (failures[pos] = merr(found));
          /*if (e.found !== found)*/ e.found = found;
          var prev = e.expected;
          var f; for (var i = prev.length; i--;) {
            if (prev[i] === expected) {
              f = 1; break;
            }
          }; if (!f) prev.push(expected);
          throw e;
        }

        function safe(f, callback) {
          try { return f();
          } catch(e) {
            if (e instanceof MatchFailed) {
              if (callback) callback(e);
            } else { throw e; }
          }
        }

        function emsg(e) {
          var found_str, exp_str;
          if (e.found instanceof Marker) {
            found_str = e.found.str;
          } else {
            found_str = quote(e.found);
          }
          if (e.expected instanceof Marker) {
            exp_str = e.expected.str;
          } else if ((e.expected.length === 1) &&
              (e.expected[0] instanceof Marker)) {
            exp_str = e.expected[0].str;
          } else {
            var xs = e.expected;
            exp_str = ((xs.length > 1)
                      ? (xs.slice(0,-1).join(', ')+' '+
                        'or '+xs.slice(-1))
                      : xs[0]);
          }
          return /*'Stopped at '+quote(e.what)+': */'Expected '+exp_str+
                 ' but '+found_str+' found.';
        }
        function adapt(e) {
          e.message = emsg(e);
          if ((e.found instanceof Marker) && (e.found === EOI)) e.found = null;
          var xs = e.expected.sort();
          if ((xs.length === 1) &&
              (xs[0] === EOI)) {
            e.expected = [];
          }
          for (var i = xs.length; i--;)
            { if (xs[i] instanceof Marker) xs[i] = xs[i].str; };
          return e;
        }

        function SyntaxError(msg) { // may be thrown from parser
          this.message = msg;
        }
        SyntaxError.prototype = new Error();
        SyntaxError.prototype.toString =
           function() { return 'SyntaxError: '+this.message; };

        /* ---------- RETURN RESULT OBJECT ----------- */

        return result;

      };


      /* ----------- RETURN PARSER ----------- */
      return __parser();

    })();;
  });

  modules.define("compiler/passes/collect-blocks", function(module, require) {
    var utils = require("../../utils");

    /* Collect all the code blocks and parameters they require.

       Since passing named parameters is nearly impossible in JS (the are several solutions,
       but they hardly affect the speed, which will not work in our case) — we need
       to collect names of the parameters (labels) to integrate in the code blocks.
       They depend on the order of nodes and nesting, so we create a tree structure
       of every rule among with collecting code blocks and when we get the complete
       structure, we pass them in. In fact, this tree is somewhat very similar in inner structure
       to contexts maps we get in generate-code pass (except actual values, of course, and
       the fact that while generating code we go inside context following the
       rule-reference), but since I want generated code to stay relatively easy-readible
       (and easy-changeble), I descided to keep contexts in generated parsers instead of
       thinking on how to give this pre-built tree to the parser. May be this solution
       will be required to change, anyway, I take the risk again. */
    module.exports = function(ast) {

        var blocks = {},
            curRule = '';

        var diver = (function() {

          var root = null,
              cur = null,
              parent = null,
              level = -1;

          var _labels,
              _blocks;

          return {

            _reset: function() {
              root = null;
              cur = null;
              parent = null;
              level = -1;
              _labels = {};
              _blocks = [];
            },

            start: function(rule, node) {
              this._reset();
              level = 0;
              root = { level: level, node: node };
              cur = root;
            },

            step: function(node) {
              cur.next = { level: level, node: node,
                           parent: parent };
              cur.next.prev = cur;
              cur = cur.next;
            },

            /* step_back: function() { cur = cur.prev; }, */

            // level means how deep the node is located in an ast tree;
            // to simplify labels-collecting logic, there are also a
            // `prev` and `next` pointers for each node, they work in a
            // linked-list fashion, ignoring the level of the node, and representing
            // the human-friendly left-to-right order, with one exception:
            // a wrapping node goes in a chain just after all of its inner nodes -
            // so `next` pointer of a last inner node points to the
            // wrapping node, and `next` pointer of a wrapping node
            // points to a node going after this wrapping node located on
            // the same level
            level_in: function(node) {
              parent = { level: level, node: node,
                         parent: parent };
              level++;
            },

            level_out: function(node) {
              level--;
              cur.next = parent;
              cur.next.prev = cur;
              cur = cur.next;
              parent = cur ? cur.parent : null;
            },

            // code blocks information is saved in two structures;
            // the first one is within the node, named `blockAddr`, and it contains
            // unique block address as a pair (rule_name, incremental_id);
            // the second one is global blocks registry object, where it is located
            // under mentioned unique address and contains code function itself and
            // required params names as a string array
            save_block: function(rule) {
              var node = cur.node;
              var rule = rule || curRule;
              var bl = blocks[rule]
                       ? blocks[rule].length : 0;

              node.blockAddr = { rule: rule,
                                 id: bl };
              var block = { params: [],
                            code: node.code };

              if (bl === 0) { blocks[rule] = []; }
              blocks[rule].push(block);
              _blocks.push(cur);

              root.node.hasBlocks = true;
            },

            save_label: function(label) {
              if (!_labels[label]) { _labels[label] = []; }
              _labels[label].push(/*{ node: node } || */cur);
            },

            // when the rule finished to be processed,
            // we know all the labels in the current rule and
            // all the code blocks corresponding to the current rule;
            // so we iterate through labels and find the blocks that
            // correspond to each one and add it there as a parameter
            finish: function(rule) {
              for (var label in _labels) {
                var l_nodes = _labels[label],
                    count = l_nodes.length;
                while(count--) {
                  this._matchLabelToBlocks(rule, label, l_nodes[count], _blocks);
                }
              }
            },

            _matchLabelToBlocks: function(rule, label, l_node, blocks) {
              var l_level = l_node.level;
              var wrap_block;
              // if label node is wrapped in some block-having node,
              // than this block has access to this label, save it as its parameter
              if (wrap_block = this._hasWrappingBlock(l_node)) {
                this._addCodeBlockParam(rule, wrap_block, label);
              }
              // if there are next blocks on the same level or below, they
              // also have access to this label
              var n = l_node.next;
              while (n && (n.level >= l_level)) {
                if (this._hasCodeBlock(n)) {
                  this._addCodeBlockParam(rule, n, label);
                }
                n = n.next;
              }
            },

            _hasCodeBlock: function(dnode) {
              return dnode.node.blockAddr;
            },

            _addCodeBlockParam: function(rule, dnode, param) {
              blocks[rule][dnode.node.blockAddr.id].params.push(param);
            },

            _hasWrappingBlock: function(dnode) {
              if (dnode.parent && this._hasCodeBlock(dnode.parent)) { return dnode.parent; }
              if (dnode.parent && dnode.parent.parent &&
                  (dnode.parent.node.type === 'sequence') &&
                  this._hasCodeBlock(dnode.parent.parent)) { return dnode.parent.parent; }
              return null;
            }

          };

        })();

        var collect = utils.buildNodeVisitor({

          grammar: function(node) {
            utils.each(node.rules, function(rule) {
              curRule = rule.name;
              collect(rule);
            });

            node.blocks = blocks;
          },

          rule:         function(node) { diver.start(curRule, node);
                                         collect(node.expression);
                                         diver.finish(curRule); },
          named:        function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          choice:       function(node) { diver.level_in(node);
                                         utils.each(node.alternatives,
                                            function(node) { collect(node);
                                                             /*diver.step_back();*/ });
                                         diver.level_out(node); },
          sequence:     function(node) { diver.level_in(node);
                                         utils.each(node.elements, collect);
                                         diver.level_out(node); },
          labeled:      function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node);
                                         diver.save_label(node.label); },
          text:         function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          simple_and:   function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          simple_not:   function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          semantic_and: function(node) { diver.step(node);
                                         diver.save_block(); },
          semantic_not: function(node) { diver.step(node);
                                         diver.save_block(); },
          optional:     function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          zero_or_more: function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          one_or_more:  function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node); },
          action:       function(node) { diver.level_in(node);
                                         collect(node.expression);
                                         diver.level_out(node);
                                         diver.save_block(); },
          rule_ref:     function(node) { diver.step(node); },
          literal:      function(node) { diver.step(node); },
          any:          function(node) { diver.step(node); },
          "class":      function(node) { diver.step(node); }

        });

        collect(ast);

    };
  });

  modules.define("compiler/passes/compute-occurences", function(module, require) {
    var utils = require("../../utils");

    /* Computes how much each rule occurs in parser. */
    module.exports = function(ast) {

        var stats = {};

        // TODO: change nodeVisitor to use switch?
        // also, may be write a walker that smartly walks deep in standard AST tree
        var compute = utils.buildNodeVisitor({
          grammar: function(node) {
            utils.each(node.rules, compute);

            node.stats = stats;
          },

          rule:         goDeep,
          named:        addAndGoDeep('named'),
          choice:       addAndGoThrough('choice', 'alternatives'),
          sequence:     addAndGoThrough('sequence', 'elements'),
          labeled:      addAndGoDeep('labeled'),
          text:         addAndGoDeep('text'),
          simple_and:   addAndGoDeep('simple_and'),
          simple_not:   addAndGoDeep('simple_not'),
          semantic_and: justAdd('semantic_and'),
          semantic_not: justAdd('semantic_not'),
          optional:     addAndGoDeep('optional'),
          zero_or_more: addAndGoDeep('zero_or_more'),
          one_or_more:  addAndGoDeep('one_or_more'),
          action:       addAndGoDeep('action'),
          rule_ref:     justAdd('rule_ref'),
          literal:      function(node) { if (!node.ignoreCase) {
                                           stats.literal = (stats.literal || 0)+1;
                                         } else {
                                           stats.literal_re = (stats.literal_re || 0)+1;
                                         } },
          any:          justAdd('any'),
          "class":      justAdd('klass')

        });

        compute(ast);

        // UTILS

        function goDeep(node) {
          compute(node.expression);
        }

        function justAdd(name) {
          return function(node) {
            stats[name] = (stats[name] || 0)+1;
          };
        }

        function addAndGoDeep(name) {
          return function(node) {
            stats[name] = (stats[name] || 0)+1;
            compute(node.expression);
          };
        }

        function addAndGoThrough(name, prop) {
            return function(node) {
                stats[name] = (stats[name] || 0)+1;
                utils.each(node[prop], compute);
            };
        }

    };
  });

  modules.define("compiler/passes/generate-fn-driven-javascript", function(module, require) {
    var utils = require("../../utils");

    /* Generates the parser code. */
    module.exports = function(ast, options) {
      options = options || {};
      if (options.cache === undefined) {
        options.cache = false;
      }
      if (options.trackLineAndColumn === undefined) {
        options.trackLineAndColumn = false;
      }
      if (options.doNotSortExpectations === undefined) {
        options.doNotSortExpectations = false;
      }

      var quote = utils.quote,
          quoteForRegexpClass = utils.quoteForRegexpClass,
          each = utils.each,
          map = utils.map,
          buildNodeVisitor = utils.buildNodeVisitor;

      /*
       * Codie 1.1.0m
       *
       * https://github.com/dmajda/codie
       *
       * Copyright (c) 2011-2012 David Majda
       * Licensend under the MIT license.
       */
      var Codie = (function(undefined) {

      function stringEscape(s) {
        function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
         * string literal except for the closing quote character, backslash,
         * carriage return, line separator, paragraph separator, and line feed.
         * Any character may appear in the form of an escape sequence.
         *
         * For portability, we also escape escape all control and non-ASCII
         * characters. Note that "\0" and "\v" escape sequences are not used
         * because JSHint does not like the first and IE the second.
         */
        return s
          .replace(/\\/g,   '\\\\') // backslash
          .replace(/"/g,    '\\"')  // closing double quote
          .replace(/\x08/g, '\\b')  // backspace
          .replace(/\t/g,   '\\t')  // horizontal tab
          .replace(/\n/g,   '\\n')  // line feed
          .replace(/\f/g,   '\\f')  // form feed
          .replace(/\r/g,   '\\r')  // carriage return
          .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
          .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
          .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
          .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
      }

      function push(s) { return '__p.push(' + s + ');'; }

      function pushRaw(template, length, state) {
        function unindent(code, level, unindentFirst) {
          return code.replace(
            new RegExp('^.{' + level +'}', "gm"),
            function(str, offset) {
              if (offset === 0) {
                return unindentFirst ? '' : str;
              } else {
                return "";
              }
            }
          );
        }

        var escaped = stringEscape(unindent(
              template.substring(0, length),
              state.indentLevel(),
              state.atBOL
            ));

        return escaped.length > 0 ? push('"' + escaped + '"') : '';
      }

      var Codie = {
        /* Codie version (uses semantic versioning). */
        VERSION: "1.1.0m", // modified a bit by shaman.sir

        /*
         * Specifies by how many characters do #if/#else and #for unindent their
         * content in the generated code.
         */
        indentStep: 2,

        /* Description of #-commands. Extend to define your own commands. */
        commands: {
          "if":   {
            params:  /^(.*)$/,
            compile: function(state, filler, params) {
              return ['if(' + params[0] + '){', []];
            },
            stackOp: "push"
          },
          "else": {
            params:  /^$/,
            compile: function(state) {
              var stack = state.commandStack,
                  insideElse = stack[stack.length - 1] === "else",
                  insideIf   = stack[stack.length - 1] === "if";

              if (insideElse) { throw new Error("Multiple #elses."); }
              if (!insideIf)  { throw new Error("Using #else outside of #if."); }

              return ['}else{', []];
            },
            stackOp: "replace"
          },
          "for":  {
            params:  /^([a-zA-Z_][a-zA-Z0-9_]*)[ \t]+in[ \t]+(.*)$/,
            init:    function(state) {
              state.forCurrLevel = 0;  // current level of #for loop nesting
              state.forMaxLevel  = 0;  // maximum level of #for loop nesting
            },
            compile: function(state, filler, params) {
              var c = '__c' + state.forCurrLevel, // __c for "collection"
                  l = '__l' + state.forCurrLevel, // __l for "length"
                  i = '__i' + state.forCurrLevel; // __i for "index"

              state.forCurrLevel++;
              if (state.forMaxLevel < state.forCurrLevel) {
                state.forMaxLevel = state.forCurrLevel;
              }

              return [
                '(function(){'
                 + c + '=' + params[1] + ';'
                     + l + '=' + c + '.length;'
                     + 'for(' + i + '=0;' + i + '<' + l + ';' + i + '++){'
                         + 'var idx = (' + i + ');'
                         + 'var isLast = (' + i + '==(' + l + '-1));'
                         + params[0] + '=' + c + '[' + i + '];',
                [params[0], c, l, i]
              ];
            },
            exit:    function(state) { state.forCurrLevel--;
                                       return ['}})();', []]; },
            stackOp: "push"
          },
          "end":  {
            params:  /^$/,
            compile: function(state) {
              var stack = state.commandStack, exit;

              if (stack.length === 0) { throw new Error("Too many #ends."); }

              exit = Codie.commands[stack[stack.length - 1]].exit;
              if (exit) { return exit(state); }

              return ['}', []];
            },
            stackOp: "pop"
          },
          // TODO: inline-block
          // TODO: add postfix for block
          "block": {
            params: /^(?:<([^ \t>]+)>[ \t]+)?([^ \t]+)(?:[ \t]+<([^ \t>]+)>)?$/, // ^(?:\<([^ \t\>]+)\>[ \t]+)?([^ \t]+)(?:[ \t]+\<([^ \t\>]+)\>)?$
            compile: function(state, filler, params) {
              var f = '__f', // __f for "filler",
                  n = '__n', // __n for "lines"
                  l = '__l', // __l for "length"
                  i = '__i'; // __i for "index"

              /*
               * Originally, the generated code used |String.prototype.replace|, but
               * it is buggy in certain versions of V8 so it was rewritten. See the
               * tests for details.
               */
              return [
                f + '="' + stringEscape(filler.substring(state.indentLevel())) + '";'
                  + n + '=(' + params[1] + ').toString().split("\\n");'
                  + l + '=' + n + '.length;'
                  + 'if(' + l + '>0){'
                  + n + '[0]="' + (params[0] || '') + '"+' + n + '[0];'
                  + n + '[' + l + '-1]='  + n + '[' + l + '-1]+"' + (params[2] || '') + '";'
                  + '}'
                  + 'for(' + i + '=0;' + i + '<' + l + ';' + i + '++){'
                  + n + '[' + i + ']=' + f + '+' + n + '[' + i + ']+"\\n";'
                  + '}'
                  + push(n + '.join("")'),
                [f, n, l, i]
              ];
            },
            stackOp: "nop"
          }
        },

        /*
         * Compiles a template into a function. When called, this function will
         * execute the template in the context of an object passed in a parameter and
         * return the result.
         */
        template: function(template) {
          var stackOps = {
            push:    function(stack, name) { stack.push(name); },
            replace: function(stack, name) { stack[stack.length - 1] = name; },
            pop:     function(stack)       { stack.pop(); },
            nop:     function()            { }
          };

          function compileExpr(state, expr) {
            state.atBOL = false;
            return [push(expr), []];
          }

          function compileCommand(state, filler, name, params) {
            var command, match, result;

            command = Codie.commands[name];
            if (!command) { throw new Error("Unknown command: #" + name + "."); }

            match = command.params.exec(params);
            if (match === null) {
              throw new Error(
                "Invalid params for command #" + name + ": " + params + "."
              );
            }

            result = command.compile(state, filler, match.slice(1));
            stackOps[command.stackOp](state.commandStack, name);
            state.atBOL = true;
            return result;
          }

          var state = {               // compilation state
                commandStack: [],     //   stack of commands as they were nested
                atBOL:        true,   //   is the next character to process at BOL?
                indentLevel:  function() {
                  return Codie.indentStep * this.commandStack.length;
                }
              },
              code = '',              // generated template function code
              vars = ['__p=[]'],      // variables used by generated code
              match, result;

          /* Initialize state. */
          for (var name in Codie.commands) {
            if (Codie.commands[name].init) { Codie.commands[name].init(state); }
          }

          /* Compile the template. */
          while ((match = /^([ \t]*)#([a-zA-Z_][a-zA-Z0-9_]*)(?:[ \t]+([^ \t\n][^\n]*))?[ \t]*(?:\n|$)|#\{([^}]*)\}/m.exec(template)) !== null) {
            code += pushRaw(template, match.index, state);
            result = match[2] !== undefined && match[2] !== ""
              ? compileCommand(state, match[1], match[2], match[3] || "") // #-command
              : compileExpr(state, match[4]);                             // #{...}
            code += result[0];
            vars = vars.concat(result[1]);
            template = template.substring(match.index + match[0].length);
          }
          code += pushRaw(template, template.length, state);

          /* Check the final state. */
          if (state.commandStack.length > 0) { throw new Error("Missing #end."); }

          /* Sanitize the list of variables used by commands. */
          vars.sort();
          for (var i = 0; i < vars.length; i++) {
            if (vars[i] === vars[i - 1]) { vars.splice(i--, 1); }
          }

          /* Create the resulting function. */
          return new Function("__v", [
            '__v=__v||{};',
            'var ' + vars.join(',') + ';',
            'with(__v){',
            code,
            'return __p.join("").replace(/^\\n+|\\n+$/g,"");};'
          ].join(''));
        }
      };

      return Codie;

      })();

      var PRIVATE_VAR_PREFIX = '__p_'; // '__p', '$_', ...

      var PARSER_GLOBALS = {
          'CODE': 'ƒ',
          'CTX': 'č'/*'¢ºΩ©ć'*/,
          'INPUT': 'input',
          'OPTIONS': 'options',
          'POS': 'pos',
          'PPOS': 'p_pos',
          '_BLOCKS': PRIVATE_VAR_PREFIX + 'blocks',
          '_COORD': PRIVATE_VAR_PREFIX + 'coord',
          '_COORD_CACHE': PRIVATE_VAR_PREFIX + 'coord_cache',
          '_COORD_RESET': PRIVATE_VAR_PREFIX + 'reset_coord'
      };

      var templates = (function() {
        var templates = {},
            sources = {
              grammar: [
                '(function(){',
                '  /* Generated by PEG.js-fn @VERSION (http://pegjs.majda.cz/). */',
                '  /* Functional modification by shaman.sir@gmail.com (http://shamansir.github.com/). */',
                '  ',
                '  /* ########### ENVIRONMENT ########### */',
                '  ',
                '  var #{INPUT},',
                '      #{OPTIONS};',
                '  ',
                '  var #{POS}, // 0, parser position',
                '      #{PPOS}; // 0, previous parser position',
                '  ',
                // TODO: more comments
                // TODO: reorganize order to make rules be first, user code in the middle and
                //       utils (even global) in the end
                // TODO: ensure input variable is accesible to user
                // TODO: integer constants as rules ids
                // TODO: look through peg.js pull requests
                '  #if initializerDef || blocksDef',
                '    ',
                '    // This code encloses all of the user blocks (initializer and/or actions)',
                '    // in their own sandbox, so if there is an initializer, its inner variables',
                '    // will [only] be accessible to actions; this, however, requires an initializer',
                '    // not to have any first-level return statements. Also, this approach keeps parser',
                '    // inner variables safe from user access, except the ones defined above.',
                '    var #{_BLOCKS} = (function() { return function() {',
                '      ',
                '      // backwards compatibility with original peg-js',
                '      function offset() { return #{PPOS}; };',
                '      function text() { return #{INPUT}.substring(#{PPOS}, #{POS}); };',
                '      #if options.trackLineAndColumn',
                '        function line() { return #{_COORD}(#{PPOS})[1]; };',
                '        function column() { return #{_COORD}(#{PPOS})[0]; };',
                '        function cell() { return #{_COORD}(#{PPOS}); };',
                '      #end',
                '      ',
                /* =============== USER BLOCK ================ */
                '      /* ########### USER CODE ########### */',
                '      ',
                '      #if initializerDef',
                '        ',
                '        /* ----------- INITIALIZER ----------- */',
                '        #block initializer',
                '      #end',
                '      ',
                '      #if blocksDef',
                '        /* ----------- BLOCKS ----------- */',
                '        ',
                '        // Blocks are grouped by rule name and id; they all get access to current context',
                '        // through #{CTX} variable which they expand into their arguments. Arguments',
                '        // names are precalculated during parser generation process.',
                // FIXME: No Unicode + AJAX != <3 ? ========
                '        ',
                '        // #{CODE} and #{CTX} variables are named so creepy just to ensure that parser writer will not use them',
                '        // for naming variables in his code (only #{CTX} may clash in this architecture, in fact),',
                '        // we hope any modern environment supports Unicode now',
                '        ',
                '        return {',
                '          #for rule in rulesNames',
                '            #if blocks[rule]',
                // TODO: generate integer constants for rules ids
                '              #{string(rule)}: [',
                '                #for userBlock in blocks[rule]',
                '                  #if userBlock.params.length > 0',
                '                    function(#{CTX}) {',
                '                      // #{rule}[#{idx}]',
                '                      return (function(#{userBlock.params}) {',
                '                        #block userBlock.code',
                '                      })(#{userBlock.paramsCode});',
                '                    #if !isLast',
                '                      },',
                '                    #else',
                '                      }',
                '                    #end',
                '                  #else',
                '                    function(#{CTX}) {',
                '                      // #{rule}[#{idx}]',
                '                      #block userBlock.code',
                '                    #if !isLast',
                '                      },',
                '                    #else',
                '                      }',
                '                    #end',
                '                  #end',
                '                #end',
                '              #if !isLast',
                '                ],',
                '              #else',
                '                ]',
                '              #end',
                '            #end',
                '          #end',
                '        };',
                '        ',
                '      #else',
                '        return {};',
                '      #end',
                '    } })();',
                '    ',
                '    // #{CODE} and #{CTX} variables are named so creepy just to ensure that parser writer will not use them',
                '    // for naming variables in his code (only #{CTX} may clash in this architecture, in fact),',
                '    // we hope any modern environment supports Unicode now',
                '    var #{CODE} = null; // holds a pointer to current rule blocks, will be initialized in parse() function',
                '  #end',
                '  ',
                '  /* ########### PARSER ########### */',
                '  ',
                '  var __parser = function() {',
                '    ',
                '  /* =========== PARSER-DEPENDENT CODE =========== */',
                '    ',
                /* =================== RULES DEFINITIONS ============ */
                '    /* ----------- RULES DEFINITIONS ----------- */',
                '    ',
                '    var rules = {}; (function() {', // FIXME: give "_" prefix for all inner names, or, better, generate int IDs for them?
                '    ',
                '    #for definition in rulesDefs',
                '      #block definition',
                '      ',
                '    #end',
                '    })();',
                '    ',
                /* =================== OPERATORS ==================== */
                '    /* ----------- OPERATORS ----------- */',
                '    ',
                '    // get current char',
                '    function cc() { return (#{POS} < ilen) ? #{INPUT}.charAt(#{POS}) : EOI; }',
                '    ',
                // rule_ref ==========
                '    #if stats.rule_ref',
                '      var ref = def(inctx); // will call rule inside context',
                '      ',
                '    #end',
                // action ============
                '    #if stats.action',
                '      function action(f, code) {',
                '        return inctx(function() {',
                //         TODO: test action inside action
                '          #{PPOS} = #{POS}; var res; // save previous position',
                '          f(); res = code(cctx);',
                '          if (res === null) { #{POS} = #{PPOS};',
                '             failed(SOMETHING, NOTHING); }',
                '          return res;',
                '        });',
                '      }',
                '      action = def(action);',
                '      ',
                '    #end',
                // sequence ==========
                '    #if stats.sequence',
                '      function seqnc(/*f...*/) {',
                '        var p_pos = #{POS}; // save previous position locally',
                '        var fs = arguments,',
                '            s = [],',
                '            on_miss = function(e) {',
                '                          #{POS} = p_pos; throw e; };',
                '        for (var fi = 0, fl = fs.length;',
                '             fi < fl; fi++) {',
                '          s.push(safe(fs[fi], on_miss));',
                '        }',
                '        return s;',
                '      }',
                '      seqnc = def(seqnc);',
                '      ',
                '    #end',
                // named =============
                '    #if stats.named',
                '      function as(name, f) {',
                '        alias = name; var res = f();',
                '        alias = \'\'; return res;',
                '      }',
                '      as = def(as);',
                '      ',
                '    #end',
                // choice ============
                '    #if stats.choice',
                '      function choice(/*f...*/) {',
                '        var fs = arguments,',
                '            missed = 0,',
                '            my_e = null,',
                '            on_miss = function(e) {',
                '              my_e = e; missed = 1;',
                '            };',
                '        for (var fi = 0, fl = fs.length;',
                '             fi < fl; fi++) {',
                '          var res = safe(fs[fi], on_miss);',
                '          if (!missed) return res;',
                '          missed = 0;',
                '        }',
                '        throw my_e;',
                '      }',
                '      choice = def(choice);',
                '      ',
                '    #end',
                // match =============
                '    #if stats.literal',
                '      function match(str) {',
                '        var slen = str.length;',
                '        if ((#{POS} + slen) > ilen) {',
                '          failed(quote(str), EOI); // exits',
                '        }',
                '        if (#{INPUT}.substr(#{POS}, slen) === str) {',
                '          #{POS} += slen;',
                '          return str;',
                '        }',
                '        failed(quote(str), cc());',
                '      }',
                '      match = def(match);',
                '      ',
                '    #end',
                // labeled ===========
                '    #if stats.labeled',
                '      function label(lbl, f) {',
                '        return cctx[lbl] = f();',
                '      }',
                '      label = def(label);',
                '      ',
                '    #end',
                // text ===========
                '    #if stats.text',
                '      function text(f) {',
                '        var p_pos = #{POS}; // save previous position locally',
                '        f(); return #{INPUT}.substr(p_pos,#{POS}-p_pos);',
                '      }',
                '      text = def(text);',
                '      ',
                '    #end',
                // one_or_more ======
                '    #if stats.one_or_more',
                '      function some(f) {',
                '        return [f()].concat(any(f)());',
                '      }',
                '      some = def(some);',
                '      ',
                '    #end',
                // zero_or_more =======
                '    #if stats.zero_or_more || stats.one_or_more',
                '      function any(f) {',
                '        var s = [],',
                '            missed = 0,',
                '            on_miss = function() { missed = 1; };',
                '        while (!missed) {',
                '          s.push(safe(f, on_miss));',
                '        }',
                '        if (missed) s.splice(-1);',
                '        return s;',
                '      }',
                '      any = def(any);',
                '      ',
                '    #end',
                // optional ==========
                '    #if stats.optional',
                '      function maybe(f) {',
                '        var missed = 0,',
                '            res = safe(f, function() {',
                '          missed = 1;',
                '        });',
                '        if (missed) return \'\';',
                '        return res;',
                '      }',
                '      maybe = def(maybe);',
                '      ',
                '    #end',
                // semantic_and =======
                '    #if stats.semantic_and',
                '      function pre(code) {',
                '        #{PPOS} = #{POS}; // save previous position as equal to current one',
                '        return code(cctx) ? \'\'',
                '                          : failed(cc(), EOI);',
                '      }',
                '      pre = def(pre);',
                '      ',
                '    #end',
                // semantic_not =======
                '    #if stats.semantic_not',
                '      function xpre(code) {',
                '        #{PPOS} = #{POS}; // save previous position as equal to current one',
                '        return code(cctx) ? failed(cc(), EOI)',
                '                            : \'\';',
                '      }',
                '      xpre = def(xpre);',
                '      ',
                '    #end',
                // simple_and ==========
                '    #if stats.simple_and',
                '      function and(f) {',
                '        // save previous position locally',
                '        var p_pos = #{POS}, missed = 0;',
                '        nr = 1; safe(f, function() {',
                '          missed = 1;',
                '        }); nr = 0;',
                '        #{POS} = p_pos;',
                '        if (missed) failed(EOI, cc());',
                '        return \'\';',
                '      }',
                '      and = def(and);',
                '      ',
                '    #end',
                // simple_not ==========
                '    #if stats.simple_not',
                '      function not(f) {',
                '        // save previous position locally',
                '        var p_pos = #{POS}, missed = 0;',
                '        nr = 1; safe(f, function() {',
                '          missed = 1;',
                '        }); nr = 0;',
                '        #{POS} = p_pos;',
                '        if (missed) return \'\';',
                '        failed(EOI, cc());',
                '      }',
                '      not = def(not);',
                '      ',
                '    #end',
                // klass || literal_re
                '    #if stats.klass || stats.literal_re',
                '      function re(rx, desc) {', // == imatch
                '        var res, desc = desc || rx.source;',
                '        if (res = rx.exec(#{INPUT}.substr(#{POS}))) {',
                '           if (res.index !== 0) failed(desc, cc());',
                '           #{POS} += res[0].length;',
                '           return res[0];',
                '        } else failed(desc, cc());',
                '      }',
                '      re = def(re);',
                '      ',
                '    #end',
                // any
                '    #if stats.any',
                '      function ch() { // char',
                '        if (#{POS} >= ilen) failed(ANY, EOI);',
                '        return #{INPUT}[#{POS}++];',
                '      }',
                '      ch = def(ch);',
                '      ',
                '    #end',

                '  /* =========== PARSER-INDEPENDENT CODE =========== */',
                '    ',
                /* =================== VARIABLES ==================== */
                '    /* ----------- VARIABLES ----------- */',
                '    ',
                '    var cache, // {}, rule results cache, by name/pos',
                '        ctx, // { ... }, total context',
                '        cctx, // { ... }, current context pointer',
                '        ctxl, // -1, context level',
                '        current, // \'-\', current rule name',
                '        alias; // \'\', current rule alias, if defined',
                '    ',
                '    var failures, // {}, failures data',
                '        rmfpos, // 0, rightmost failure position',
                '        nr; // 0, no-report, fire errors w/o reporting',
                '    ',
                '    var /*input, */ilen; // input, input length',
                '    ',
                /* =================== CACHE ======================== */
                '    #if options.cache',
                '      /* ----------- CACHE ----------- */',
                '      ',
                '      // it is important to get cache key before executing',
                '      // the rule body, because pos is required to be in the',
                '      // state it was left before applying the rule, untouchable,',
                '      // to make cache work properly',
                '      function _ckey(name) { return name+"@"+#{POS}; } // get cache key',
                '      ',
                '      function cached(key) { // is there\'s something in cache',
                '        return cache.hasOwnProperty(key);',
                '      }',
                '      ',
                '      function _cache(key) { // load out of cache',
                '        var cached = cache[key];',
                '        #{POS} = cached.next;',
                '        return cached.result;',
                '      }',
                '      ',
                '      function cache_(key, result) { // store in cache',
                '        var res = {',
                '          "next": #{POS},',
                '          "result": result',
                '        };',
                '        cache[key] = res;',
                '        return res.result;',
                '      }',
                '      ',
                '    #end',
                /* =================== CONTEXT ====================== */
                '    /* ----------- CONTEXT ----------- */',
                '    ',
                '    #if blocksDef || stats.action || stats.rule_ref || stats.semantic_and || stats.semantic_not',
                '      function ctx_lvl(parent) {',
                '        function CtxLevel() {',
                '            this.__p = parent;',
                '            this.__l = ++ctxl;',
                '            this.__c = null;',
                '        };',
                '        CtxLevel.prototype = parent;',
                '        return new CtxLevel();',
                '      }',
                '      ',
                '      function din() {  // dive in',
                '        if (!cctx.__c) cctx.__c = ctx_lvl(cctx);',
                '        cctx = cctx.__c;',
                '      }',
                '      function dout() { // dive out',
                '        if (!cctx.__p) throw new Error(\'reached top context level\');',
                '        cctx = cctx.__p; --ctxl;',
                '      }',
                '      function inctx(f) { // execute in own context and return',
                '        var r, e;',
                '        din(); r = safe(f, function(err) { e = err; });',
                '        dout(); if (e) throw e;',
                '        return r;',
                '      }',
                '    #else',
                '      function ctx_lvl() {',
                '        return { __l: 0 };',
                '      }',
                '    #end',
                '    ',
                /* =================== DEFERRED ===================== */
                '    /* ----------- DEFERRED ----------- */',
                '    // Makes passed function to save its argument values,',
                '    // but not execute until specially requested',
                '    ',
                '    function def(f) {',
                '      return function() {',
                '        return (function(f, args) {',
                '          return function() { return f.apply(null, args); };',
                '        })(f, arguments);',
                '      }',
                '    }',
                '    ',
                /* =================== RULES WRAPPER ================ */
                '    /* ----------- RULES WRAPPER ----------- */',
                '    ',
                '    var ckey; // cache key',
                '    for (var rule in rules) {',
                '      rules[rule] = (function(name, rule) {',
                '        #if options.cache',
                '          return function() {',
                '            current = name; ckey = _ckey(name);',
                '            if (cached(ckey)) return _cache(ckey);',
                '            return cache_(ckey, rule());',
                '          };',
                '        #else',
                '          return function() { current = name; return rule(); };',
                '        #end',
                '      })(rule, rules[rule]);',
                '    }',
                '    ',
                /* =================== RESULT OBJECT ================ */
                '    /* ----------- RESULT OBJECT + PARSE FUNCTION ----------- */',
                '    ',
                '    var result = {',
                '      /*',
                '       * Parses the input with a generated parser. If the parsing is successfull,',
                '       * returns a value explicitly or implicitly specified by the grammar from',
                '       * which the parser was generated (see |PEG.buildParser|). If the parsing is',
                '       * unsuccessful, throws |PEG.parser.MatchFailed| describing the error.',
                '       */',
                /* =================== PARSE FUNCTION =============== */
                '      parse: function(_input, _opts) {',
                '        var _opts = _opts || {};',
                '        ',
                '        // initialize variables',
                '        #{POS} = 0, #{PPOS} = 0, #{INPUT} = _input, #{OPTIONS} = _opts;',
                '        ',
                '        ilen = #{INPUT}.length, failures = {}, rmfpos = 0, nr = 0;',
                '        #if options.trackLineAndColumn',
                '          #{_COORD_RESET}();',
                '        #end',
                '        ',
                '        cache = {};',
                '        ctxl = -1; ctx = ctx_lvl(), cctx = ctx;',
                '        current = \'-\';',
                '        ',
                '        #if startRule',
                '          var startRule = _opts.startRule || #{string(startRule)};',
                '        #else',
                '          #if alwdStartRules',
                '            var startRule = _opts.startRule || #{string(firstAlwdStartRule)};',
                '          #else',
                '            #if firstRule',
                '              var startRule = _opts.startRule || #{string(firstRule)};',
                '            #else',
                '              var startRule = _opts.startRule || "start";',
                '            #end',
                '          #end',
                '        #end',
                '        #if alwdStartRules',
                //'          if ((startRule != "start") &&',
                '          if (#{alwdStartRules}.indexOf(startRule) < 0) {',
                '            throw new Error("Can\'t start parsing from rule " + quote(startRule) + ".");', //"Rule " + quote(startRule) + " is not in the list of allowed start rules."
                '          }',
                '        #else',
                '          #if firstRule',
                '            if ((startRule != "start") &&',
                '                (startRule != #{string(firstRule)}))',
                '              throw new Error("Rule " + quote(startRule) + " is not the first rule and is not allowed because of that.");',
                '            }',
                '          #end',
                         // if there will be no firstRule, then there are no rules at all in grammar,
                         // so startRule will for sure not be found few lines of code later
                '        #end',
                '        ',
                '        #if initializerDef || blocksDef',
                '          // call user initializer and also',
                '          // get blocks lying in the same context',
                '          #{CODE} = #{_BLOCKS}();',
                '          ',
                '        #end',
                '        // find start rule',
                '        if (startRule) {',
                '          if (rules[startRule] === undefined) {',
                '            throw new SyntaxError("Rule not found: " + quote(startRule) + ".");',  // TODO: GrammarError?
                '          };',
                '        } else {',
                '          throw new Error("Start rule is not defined in options, no \'start\' rule found and first rule in grammar was empty");', // TODO: GrammarError
                //'          startRule = #{string(startRule)};',
                '        }',
                '        ',
                '        // and execute it',
                '        var res;',
                '        try {',
                '          res = rules[startRule]();',
                '          if ((#{POS} < ilen) || ',
                '              (res === null)) failed(EOI, cc());',
                '        } catch(e) {',
                '          if (e instanceof MatchFailed) {',
                '            // throw rightmost error instead',
                '            throw adapt(failures[rmfpos]);',
                '          }',
                '          throw e;',
                '        }',
                '        ',
                '        return res;',
                '      },',
                '      ',
             // '      /* Returns the parser source code. */',
             // '      toSource: function() { return this._source; },',
                '      ',
                '      /* makes error type accessible outside */',
                '      MatchFailed: MatchFailed,',
                '      SyntaxError: SyntaxError',
                '    };',
                '    ',
                /* =============== UTILS ===================== */
                '    /* ----------- UTILS ----------- */',
                '    ',
                '    function Marker(human_str) { this.str=human_str; };',
                '    Marker.prototype.toString = function() { return this.str; };',
                '    var EOI = new Marker(\'end of input\'),',
                '        ANY = new Marker(\'any character\'),',
                '        SOMETHING = new Marker(\'progress\'),',
                '        NOTHING = new Marker(\'nothing\');',
                '    ',
                /* This needs to be in sync with |hexOf| in utils.js. */
                '    function hexOf(ch) {',
                '      var x = ch.charCodeAt(0),',
                '          v = x.toString(16).toUpperCase(),',
                '          h = (x > 0xFF),',
                '          i = (h ? 4 : 2) - v.length;',
                '      while (i--) v = v + \'0\';',
                '      return \'\\\\\' + (h ? \'u\' : \'x\') + v;',
                '    }',
                '    ',
                /* This needs to be in sync with |quote| in utils.js. */
                '    function quote(s) {',
                '      /*',
                '       * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a',
                '       * string literal except for the closing quote character, backslash,',
                '       * carriage return, line separator, paragraph separator, and line feed.',
                '       * Any character may appear in the form of an escape sequence.',
                '       *',
                '       * For portability, we also escape escape all control and non-ASCII',
                '       * characters. Note that "\\0" and "\\v" escape sequences are not used',
                '       * because JSHint does not like the first and IE the second.',
                '       */',
                '      return \'"\' + s',
                '        .replace(/\\\\/g, \'\\\\\\\\\')  // backslash',
                '        .replace(/"/g, \'\\\\"\')    // closing quote character',
                '        .replace(/\\x08/g, \'\\\\b\') // backspace',
                '        .replace(/\\t/g, \'\\\\t\')   // horizontal tab',
                '        .replace(/\\n/g, \'\\\\n\')   // line feed',
                '        .replace(/\\f/g, \'\\\\f\')   // form feed',
                '        .replace(/\\r/g, \'\\\\r\')   // carriage return',
                '        .replace(/[\\x00-\\x07\\x0B\\x0E-\\x1F\\x80-\\uFFFF]/g, hexOf)',
                '        + \'"\';',
                '    }',
                '    ',
                /* =================== FAILURES ===================== */
                '    /* ----------- FAILURES ----------- */',
                '    ',
                '    function MatchFailed(what, found, expected) {',
                '      this.what = what;',
                '      this.expected = expected || [];',
                '      this.found = found;',
                '      this.offset = #{POS};',
                '      this.xpos = [-1, -1];',
                '      this.line = -1;',
                '      this.column = -1;',
                '    }',
                '    MatchFailed.prototype = new Error();',
                '    MatchFailed.prototype.toString = ',
                '       function() { return \'MatchFailed: \'+emsg(this); };',
                '    var merr = function(fnd, exp) {',
                '      return new MatchFailed(alias || current, fnd, exp);',
                '    };',
                '    ',
                '    function failed(expected, found) {',
                '      var expected = alias || expected;',
                '      // if no report required, just throw',
                '      if (nr) throw merr(found, [expected]);',
                '      if (#{POS} > rmfpos) rmfpos = #{POS};',
                '      var e = failures[#{POS}] ||',
                '             (failures[#{POS}] = merr(found));',
                '      /*if (e.found !== found)*/ e.found = found;',
                '      var prev = e.expected;',
                '      var f; for (var i = prev.length; i--;) {',
                '        if (prev[i] === expected) {',
                '          f = 1; break;',
                '        }',
                '      }; if (!f) prev.push(expected);',
                '      throw e;',
                '    }',
                '    ',
                '    function safe(f, callback) {',
                '      try { return f();',
                '      } catch(e) {',
                '        if (e instanceof MatchFailed) {',
                '          if (callback) callback(e);',
                '        } else { throw e; }',
                '      }',
                '    }',
                '    ',
                '    function emsg(e) {',
                '      var found_str, exp_str;',
                '      if (e.found instanceof Marker) {',
                '        found_str = e.found.str;',
                '      } else {',
                '        found_str = quote(e.found);',
                '      }',
                '      if (e.expected instanceof Marker) {',
                '        exp_str = e.expected.str;',
                '      } else if ((e.expected.length === 1) &&',
                '          (e.expected[0] instanceof Marker)) {',
                '        exp_str = e.expected[0].str;',
                '      } else {',
                '        var xs = e.expected;',
                '        exp_str = ((xs.length > 1)',
                '                  ? (xs.slice(0,-1).join(\', \')+\' \'+',
                '                    \'or \'+xs.slice(-1))',
                '                  : xs[0]);',
                '      }',
                '      return /*\'Stopped at \'+quote(e.what)+\': */\'Expected \'+exp_str+',
                '             \' but \'+found_str+\' found.\';', // \'+
                //'           \'at \'+e.xpos.join(\':\');',
                '    }',
                '    function adapt(e) {',
                '      #if options.trackLineAndColumn',
                '        var xpos = #{_COORD}(e.offset);',
                '        e.xpos = xpos; e.line = xpos[1]; e.column = xpos[0];',
                '      #end',
                '      e.message = emsg(e);',
                '      if ((e.found instanceof Marker) && (e.found === EOI)) e.found = null;',
                '      #if options.doNotSortExpectations',
                '        var xs = e.expected;',
                '      #else',
                '        var xs = e.expected.sort();',
                '      #end',
                '      if ((xs.length === 1) &&',
                '          (xs[0] === EOI)) {',
                '        e.expected = [];',
                '      }',
                '      for (var i = xs.length; i--;)',
                '        { if (xs[i] instanceof Marker) xs[i] = xs[i].str; };',
                '      return e;',
                '    }',
                '    ',
                '    function SyntaxError(msg) { // may be thrown from parser',
                '      this.message = msg;',
                '    }',
                '    SyntaxError.prototype = new Error();',
                '    SyntaxError.prototype.toString = ',
                '       function() { return \'SyntaxError: \'+this.message; };',
                '    ',
                '    /* ---------- RETURN RESULT OBJECT ----------- */',
                '    ',
                '    return result;',
                '    ',
                '  };',
                '  ',
                '  #if options.trackLineAndColumn',
                '    /* ----------- COORDINATES CALCULATION ----------- */',
                '    // a function to find line-column position from a char-based position',
                '    var #{_COORD_CACHE}; // cache of 2d position: [ last_pos, column, line, seen_cr ]',
                '    function #{_COORD_RESET}() { #{_COORD_CACHE} = [ 0, 1, 1, 0 ]; };',
                '             #{_COORD_RESET}();',
                '    function #{_COORD}(pos) {',
                '      /*',
                '       * The first idea was to use |String.split| to break the input up to the',
                '       * error position along newlines and derive the line and column from',
                '       * there. However IE\'s |split| implementation is so broken that it was',
                '       * enough to prevent it.',
                '       */',
                '      var cl = 1, ln = 1,',
                '          cr = 0, // bool, was CR found or not?',
                '          c = #{_COORD_CACHE};',
                '      ',
                '      if (pos !== c[0]) {',
                '        if (pos < c[0]) {',
                '          #{_COORD_RESET}();',
                '        } else {',
                '          cl = c[1], ln = c[2], cr = c[3];',
                '        }',
                '        var from = c[0], to = pos;',
                '        for (var i = from, ch; i < to; i++) {',
                '          ch = #{INPUT}.charAt(i);',
                '          if (ch === "\\n") {',
                '            if (!cr) { ln++; }',
                '            cl = 1; cr = 0;',
                '          } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
                '            ln++; cl = 1; cr = 1;',
                '          } else /*if (ch.length)*/ {',
                '            cl++; cr = 0;',
                '          }',
                '        }',
                '        #{_COORD_CACHE} = [ pos, cl, ln, cr ];',
                '        return [ cl, ln ];',
                '      } else return [ c[1], c[2] ];',
                '    }',
                '  #end',
                '  ',
                '  /* ----------- RETURN PARSER ----------- */',
                '  return __parser();',
                '  ',
                '})();'
              ],
              rule: [
                'rules.#{node.name} = function() {',
                '  #if node.hasBlocks',
                '    var _code = #{CODE}.#{node.name};',
                '  #end',
                '  return (',
                '    #block code',
                '  ());',
                '}'
              ],
              named: [
                'as(#{string(node.name)},',
                '  #block expression',
                ')'
              ],
              choice: [
                'choice(',
                '  #for expression in beforeLast',
                '    #block expression <,>',
                '  #end',
                '  #block last',
                ')'
              ],
              sequence: [
                '#if last !== null',
                '  seqnc(',
                '    #for expression in beforeLast',
                '      #block expression <,>',
                '    #end',
                '    #block last',
                '  )',
                '#else',
                '  seqnc()',
                '#end'
              ],
              labeled: [
                'label(#{string(node.label)},',
                '  #block expression',
                ')'
              ],
              text: [
                'text(',
                '  #block expression',
                ')'
              ],
              // TODO: compose all similar templates into one?
              simple_and: [
                'and(',
                '  #block expression',
                ')'
              ],
              simple_not: [
                'not(',
                '  #block expression',
                ')'
              ],
              semantic_and: [
                //'pre(#{CODE}.#{blockAddr.rule}[#{blockAddr.id}](cctx))',
                'pre(_code[#{blockAddr.id}])',
                '    #block </*{> code <}*/>'
              ],
              semantic_not: [
                //'xpre(#{CODE}.#{blockAddr.rule}[#{blockAddr.id}](cctx))',
                'xpre(_code[#{blockAddr.id}])',
                '     #block </*{> code <}*/>'
              ],
              optional: [
                'maybe(',
                '  #block expression',
                ')'
              ],
              zero_or_more: [
                'any(',
                '  #block expression',
                ')'
              ],
              one_or_more: [
                'some(',
                '  #block expression',
                ')'
              ],
              action: [
                'action(',
                '  #block expression <,>',
                //'  #{CODE}.#{blockAddr.rule}[#{blockAddr.id}])',
                '  _code[#{blockAddr.id}])',
                '  #block </*{> code <}*/>'
              ],
              rule_ref: [
                'ref(rules.#{node.name})'
              ],
              literal: [
                '#if !node.ignoreCase',
                '  match(#{string(node.value)})',
                '#else',
                '  re(/#{node.value}/i, quote(#{string(node.value)}))',
                '#end'
              ],
              "class": [
                're(#{regexp}, #{string(rawText)})'
              ]
            };

        for (var name in sources) {
          templates[name] = Codie.template(sources[name].join('\n'));
        }

        return templates;
      })();

      function fill(name, vars) {
        vars.string  = quote;
        vars.options = options;

        return templates[name](vars);
      }

      function ensureHasAddr(node) {
        if (!node.blockAddr) {
            throw new Error('No block address data for '+
                  node.type+' node, seems \'collect-blocks\' '+
                  'pass was not performed or failed');
        }
      }

      var startCommentRegexp = new RegExp('\\/\\*', 'g'),
          endCommentRegexp = new RegExp('\\*\\/', 'g');
      function escapeCode(code) {
        return code.replace(startCommentRegexp, '\/-*').replace(endCommentRegexp, '*\-/');
      }

      var emit = buildNodeVisitor({
        grammar: function(node) {
          var initializer = node.initializer !== null
            ? emit(node.initializer)
            : "";

          var rulesDefs = [];
          var rulesNames = [];
          each(node.rules, function(subnode) {
            rulesDefs.push(emit(subnode));
            rulesNames.push(subnode.name);
            if (subnode.name === 'start') { hasRuleNamedStart = true; }
          });

          var blocksDef = false;
          each(rulesNames, function(rule) {
            var CTX_VAR = PARSER_GLOBALS['CTX'];
            if (node.blocks[rule]) {
              blocksDef = true;
              each(node.blocks[rule], function(block) {
                block.paramsCode = (block.params.length > 0)
                                   ? CTX_VAR + '.' + block.params.join(','+CTX_VAR+'.')
                                   : '';
              });
            }
          });

          var alwdStartRules = options.allowedStartRules,
              alwdStartRulesVal = (alwdStartRules && alwdStartRules.length)
                                  ? ('["' + alwdStartRules.join('","') + '"]')
                                  : null,
              firstAlwdStartRule = (alwdStartRules && alwdStartRules.length)
                                   ? alwdStartRules[0] : null;

          var context = {
            initializer:    initializer,
            initializerDef: (initializer !== ""),
            rulesNames:     rulesNames,
            rulesDefs:      rulesDefs,
            startRule:      node.startRule,
            firstRule:      rulesNames.length ? rulesNames[0] : null,
            alwdStartRules: alwdStartRulesVal,
            firstAlwdStartRule: firstAlwdStartRule,
            blocks:         node.blocks,
            blocksDef:      blocksDef,
            stats:          node.stats };

          for (var alias in PARSER_GLOBALS) {
            context[alias] = PARSER_GLOBALS[alias];
          }

          return fill("grammar", context);
        },

        initializer: function(node) {
          return node.code;
        },

        rule: function(node) {
          return fill("rule", {
            node:       node,
            code:       emit(node.expression),
            // special variables names
            CODE:       PARSER_GLOBALS['CODE']
          });
        },

        // ======= COMBINATIONS =======

        named: function(node) {
          return fill('named', { node: node,
                                 expression: emit(node.expression) });
        },

        choice: function(node) {
          var elms = node.alternatives;
          var beforeLast = [];
          for (var i = 0; i < (elms.length - 1); i++) {
            beforeLast.push(emit(elms[i]));
          }

          var last = emit(elms[elms.length - 1]);

          return fill("choice", { beforeLast: beforeLast,
                                  last: last });
        },

        sequence: function(node) {
          var elms = node.elements;
          var beforeLast = [];
          for (var i = 0, il = elms.length; i < (il - 1); i++) {
            beforeLast.push(emit(elms[i]));
          }

          var last = (elms.length > 0)
                     ? emit(elms[elms.length - 1])
                     : null;

          return fill("sequence", { beforeLast: beforeLast,
                                    last: last });
        },

        labeled: function(node) {
          return fill("labeled", { node: node,
                                   expression: emit(node.expression) });
        },

        text: function(node) {
          return fill("text", { node: node,
                                expression: emit(node.expression) });
        },

        simple_and: function(node) {
          return fill("simple_and",
                      { expression: emit(node.expression) });
        },

        simple_not: function(node) {
          return fill("simple_not",
                      { expression: emit(node.expression) });
        },

        semantic_and: function(node) {
          ensureHasAddr(node);
          return fill("semantic_and", { node: node,
                                        code: escapeCode(node.code),
                                        blockAddr: node.blockAddr });
        },

        semantic_not: function(node) {
          ensureHasAddr(node);
          return fill("semantic_not", { node: node,
                                        code: escapeCode(node.code),
                                        blockAddr: node.blockAddr });
        },

        optional: function(node) {
          return fill("optional",
                      { expression: emit(node.expression) });
        },

        zero_or_more: function(node) {
          return fill("zero_or_more",
                      { expression: emit(node.expression) });
        },

        one_or_more: function(node) {
          return fill("one_or_more",
                      { expression: emit(node.expression) });
        },

        action: function(node) {
          ensureHasAddr(node);
          return fill("action", {
            node: node,
            code: escapeCode(node.code),
            expression: emit(node.expression),
            blockAddr: node.blockAddr
          });
        },

        rule_ref: function(node) {
          return fill("rule_ref", { node: node });
        },

        literal: function(node) {
          return fill("literal", { node: node });
        },

        any: function(node) {
          return "ch()"; // TODO: make template?
        },

        "class": function(node) {
          var regexp;

          if (node.parts.length > 0) {
            regexp = '/^['
              + (node.inverted ? '^' : '')
              + map(node.parts, function(part) {
                  return (part instanceof Array)
                    ? (quoteForRegexpClass(part[0])
                       + '-'
                       + quoteForRegexpClass(part[1]))
                    : quoteForRegexpClass(part);
                }).join('')
              + ']/' + (node.ignoreCase ? 'i' : '');
          } else {
            /*
             * Stupid IE considers regexps /[]/ and /[^]/ syntactically invalid, so
             * we translate them into euqivalents it can handle.
             */
            regexp = node.inverted ? '/^[\\S\\s]/' : '/^(?!)/';
          }

          return fill("class", { rawText: node.rawText,
                                 regexp: regexp });
        }

      });

      ast.code = emit(ast);
    };
  });

  modules.define("compiler/passes/remove-proxy-rules", function(module, require) {
    var utils = require("../../utils");

    /*
     * Removes proxy rules -- that is, rules that only delegate to other rule.
     */
    module.exports = function(ast, options) {
      function isProxyRule(node) {
        return node.type === "rule" && node.expression.type === "rule_ref";
      }

      function replaceRuleRefs(ast, from, to) {
        function nop() {}

        function replaceInExpression(node, from, to) {
          replace(node.expression, from, to);
        }

        function replaceInSubnodes(propertyName) {
          return function(node, from, to) {
            utils.each(node[propertyName], function(subnode) {
              replace(subnode, from, to);
            });
          };
        }

        var replace = utils.buildNodeVisitor({
          grammar:      replaceInSubnodes("rules"),
          rule:         replaceInExpression,
          named:        replaceInExpression,
          choice:       replaceInSubnodes("alternatives"),
          sequence:     replaceInSubnodes("elements"),
          labeled:      replaceInExpression,
          text:         replaceInExpression,
          simple_and:   replaceInExpression,
          simple_not:   replaceInExpression,
          semantic_and: nop,
          semantic_not: nop,
          optional:     replaceInExpression,
          zero_or_more: replaceInExpression,
          one_or_more:  replaceInExpression,
          action:       replaceInExpression,

          rule_ref:
            function(node, from, to) {
              if (node.name === from) {
                node.name = to;
              }
            },

          literal:      nop,
          "class":      nop,
          any:          nop
        });

        replace(ast, from, to);
      }

      var indices = [];

      utils.each(ast.rules, function(rule, i) {
        if (isProxyRule(rule)) {
          replaceRuleRefs(ast, rule.name, rule.expression.name);
          if (!utils.contains(options.allowedStartRules, rule.name)) {
            indices.push(i);
          }
        }
      });

      indices.reverse();

      utils.each(indices, function(index) {
        ast.rules.splice(index, 1);
      });
    };
  });

  modules.define("compiler/passes/report-left-recursion", function(module, require) {
    var utils        = require("../../utils"),
        GrammarError = require("../../grammar-error");

    /* Checks that no left recursion is present. */
    module.exports = function(ast) {
      function nop() {}

      function checkExpression(node, appliedRules) {
        check(node.expression, appliedRules);
      }

      function checkSubnodes(propertyName) {
        return function(node, appliedRules) {
          utils.each(node[propertyName], function(subnode) {
            check(subnode, appliedRules);
          });
        };
      }

      var check = utils.buildNodeVisitor({
        grammar:     checkSubnodes("rules"),

        rule:
          function(node, appliedRules) {
            check(node.expression, appliedRules.concat(node.name));
          },

        named:       checkExpression,
        choice:      checkSubnodes("alternatives"),
        action:      checkExpression,

        sequence:
          function(node, appliedRules) {
            if (node.elements.length > 0) {
              check(node.elements[0], appliedRules);
            }
          },

        labeled:      checkExpression,
        text:         checkExpression,
        simple_and:   checkExpression,
        simple_not:   checkExpression,
        semantic_and: nop,
        semantic_not: nop,
        optional:     checkExpression,
        zero_or_more: checkExpression,
        one_or_more:  checkExpression,

        rule_ref:
          function(node, appliedRules) {
            if (utils.contains(appliedRules, node.name)) {
              throw new GrammarError(
                "Left recursion detected for rule \"" + node.name + "\"."
              );
            }
            check(utils.findRuleByName(ast, node.name), appliedRules);
          },

        literal:      nop,
        "class":      nop,
        any:          nop
      });

      check(ast, []);
    };
  });

  modules.define("compiler/passes/report-missing-rules", function(module, require) {
    var utils        = require("../../utils"),
        GrammarError = require("../../grammar-error");

    /* Checks that all referenced rules exist. */
    module.exports = function(ast) {
      function nop() {}

      function checkExpression(node) { check(node.expression); }

      function checkSubnodes(propertyName) {
        return function(node) { utils.each(node[propertyName], check); };
      }

      var check = utils.buildNodeVisitor({
        grammar:      checkSubnodes("rules"),
        rule:         checkExpression,
        named:        checkExpression,
        choice:       checkSubnodes("alternatives"),
        action:       checkExpression,
        sequence:     checkSubnodes("elements"),
        labeled:      checkExpression,
        text:         checkExpression,
        simple_and:   checkExpression,
        simple_not:   checkExpression,
        semantic_and: nop,
        semantic_not: nop,
        optional:     checkExpression,
        zero_or_more: checkExpression,
        one_or_more:  checkExpression,

        rule_ref:
          function(node) {
            if (!utils.findRuleByName(ast, node.name)) {
              throw new GrammarError(
                "Referenced rule \"" + node.name + "\" does not exist."
              );
            }
          },

        literal:      nop,
        "class":      nop,
        any:          nop
      });

      check(ast);
    };
  });

  modules.define("compiler", function(module, require) {
    var utils = require("./utils");

    module.exports = {
      /*
       * Compiler passes.
       *
       * Each pass is a function that is passed the AST. It can perform checks on it
       * or modify it as needed. If the pass encounters a semantic error, it throws
       * |PEG.GrammarError|.
       */
      passes: {
        check: {
          reportMissingRules:  require("./compiler/passes/report-missing-rules"),
          reportLeftRecursion: require("./compiler/passes/report-left-recursion")
        },
        transform: {
          removeProxyRules:    require("./compiler/passes/remove-proxy-rules"),
          collectBlocks:       require("./compiler/passes/collect-blocks"),
          computeOccurences:   require("./compiler/passes/compute-occurences")
        },
        generate: {
          generateJavascript:  require("./compiler/passes/generate-fn-driven-javascript")
        }
      },

      /*
       * Generates a parser from a specified grammar AST. Throws |PEG.GrammarError|
       * if the AST contains a semantic error. Note that not all errors are detected
       * during the generation and some may protrude to the generated parser and
       * cause its malfunction.
       */
      compile: function(ast, passes) {

        var options = arguments.length > 2 ? utils.clone(arguments[2]) : {},
            stage;

        /*
         * Extracted into a function just to silence JSHint complaining about
         * creating functions in a loop.
         */
        function runPass(pass) {
          pass(ast, options);
        }

        utils.defaults(options, {
          allowedStartRules:  [ast.rules[0].name],
          cache:              false,
          optimize:           "speed",
          output:             "parser"
        });

        for (stage in passes) {
          utils.each(passes[stage], runPass);
        }

        switch (options.output) {
          case "parser": return eval(ast.code);
          case "source": return ast.code;
        }
      }
    };
  });

  modules.define("peg", function(module, require) {
    var utils = require("./utils");

    module.exports = {
      /* PEG.js version (uses semantic versioning). */
      VERSION: "0.7.0-fn",

      GrammarError: require("./grammar-error"),
      parser:       require("./parser"),
      compiler:     require("./compiler"),

      /*
       * Generates a parser from a specified grammar and returns it.
       *
       * The grammar must be a string in the format described by the metagramar in
       * the parser.pegjs file.
       *
       * Throws |PEG.parser.SyntaxError| if the grammar contains a syntax error or
       * |PEG.GrammarError| if it contains a semantic error. Note that not all
       * errors are detected during the generation and some may protrude to the
       * generated parser and cause its malfunction.
       */
      buildParser: function(grammar) {
        function convertPasses(passes) {
          var converted = {}, stage;

          for (stage in passes) {
            converted[stage] = utils.values(passes[stage]);
          }

          return converted;
        }

        var options = arguments.length > 1 ? utils.clone(arguments[1]) : {},
            plugins = "plugins" in options ? options.plugins : [],
            config  = {
              parser: this.parser,
              passes: convertPasses(this.compiler.passes)
            };

        utils.each(plugins, function(p) { p.use(config, options); });

        return this.compiler.compile(
          config.parser.parse(grammar),
          config.passes,
          options
        );
      }
    };
  });

  return modules["peg"]
})();
