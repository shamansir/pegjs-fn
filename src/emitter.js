/* Emits the generated code for the AST. */
PEG.compiler.emitter = function(ast) {
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
      /*
       * Specifies by how many characters do #if/#else and #for unindent their
       * content in the generated code.
       */
      indentStep: 2,

      /* Description of #-commands. Extend to define your own commands. */
      commands: {
        "if":   {
          params:  /^(.*)$/,
          compile: function(state, prefix, params) {
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
          compile: function(state, prefix, params) {
            var c = '__c' + state.forCurrLevel, // __c for "collection"
                l = '__l' + state.forCurrLevel, // __l for "length"
                i = '__i' + state.forCurrLevel; // __i for "index"

            state.forCurrLevel++;
            if (state.forMaxLevel < state.forCurrLevel) {
              state.forMaxLevel = state.forCurrLevel;
            }

            return [
              c + '=' + params[1] + ';'
                + l + '=' + c + '.length;'
                + 'for(' + i + '=0;' + i + '<' + l + ';' + i + '++){'
                + params[0] + '=' + c + '[' + i + '];',
              [params[0], c, l, i]
            ];
          },
          exit:    function(state) { state.forCurrLevel--; },
          stackOp: "push"
        },
        "end":  {
          params:  /^$/,
          compile: function(state) {
            var stack = state.commandStack, exit;

            if (stack.length === 0) { throw new Error("Too many #ends."); }

            exit = Codie.commands[stack[stack.length - 1]].exit;
            if (exit) { exit(state); }

            return ['}', []];
          },
          stackOp: "pop"
        },
        "block": {
          params: /^(.*)$/,
          compile: function(state, prefix, params) {
            var x = '__x', // __x for "prefix",
                n = '__n', // __n for "lines"
                l = '__l', // __l for "length"
                i = '__i'; // __i for "index"

            /*
             * Originally, the generated code used |String.prototype.replace|, but
             * it is buggy in certain versions of V8 so it was rewritten. See the
             * tests for details.
             */
            return [
              x + '="' + stringEscape(prefix.substring(state.indentLevel())) + '";'
                + n + '=(' + params[0] + ').toString().split("\\n");'
                + l + '=' + n + '.length;'
                + 'for(' + i + '=0;' + i + '<' + l + ';' + i + '++){'
                + n + '[' + i +']=' + x + '+' + n + '[' + i + ']+"\\n";'
                + '}'
                + push(n + '.join("")'),
              [x, n, l, i]
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

        function compileCommand(state, prefix, name, params) {
          var command, match, result;

          command = Codie.commands[name];
          if (!command) { throw new Error("Unknown command: #" + name + "."); }

          match = command.params.exec(params);
          if (match === null) {
            throw new Error(
              "Invalid params for command #" + name + ": " + params + "."
            );
          }

          result = command.compile(state, prefix, match.slice(1));
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
            name, match, result, i;

        /* Initialize state. */
        for (name in Codie.commands) {
          if (Codie.commands[name].init) { Codie.commands[name].init(state); }
        }

        /* Compile the template. */
        while ((match = /^([ \t]*)#([a-zA-Z_][a-zA-Z0-9_]*)(?:[ \t]+([^ \t\n][^\n]*))?[ \t]*(?:\n|$)|#\{([^}]*)\}/m.exec(template)) !== null) {
          code += pushRaw(template, match.index, state);
          result = (match[2] !== undefined) && (match[2] !== "")
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
        for (i = 0; i < vars.length; i++) {
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

  var templates = (function() {
    var name,
        templates = {},
        sources = {
          grammar: [ 
            '(function(){',
            '  /* Generated by PEG.js @VERSION (http://pegjs.majda.cz/). */',
            '  /* Compact-Result modification. */',
            '  ',
            /* =============== UTILS =============== */
            '  /* UTILS */',
            '  ',
            /* This needs to be in sync with |pad| in utils.js. */
            '  function pad(input, padding, length) {',
            '    var result = input;',
            '    ',
            '    var plen = length - input.length;',
            '      for (var i = 0; i < plen; i++) {',
            '        result = padding + result;',
            '      }',
            '    ',
            '    return result;',
            '  }',
            '  ',
            /* This needs to be in sync with |escape| in utils.js. */
            '  function escape(ch) {',
            '    var ccode = ch.charCodeAt(0);',
            '    return \'\\\\\' + ((ccode <= 0xFF) ? \'x\' : \'u\') +',
            '           pad(ccode.toString(16).toUpperCase(), \'0\',',
            '               ((ccode <= 0xFF) ? 2 : 4));',
            '    }',
            '  ',
            /* This needs to be in sync with |quote| in utils.js. */
            '  function quote(s) {',
            '    /*',
            '     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a',
            '     * string literal except for the closing quote character, backslash,',
            '     * carriage return, line separator, paragraph separator, and line feed.',
            '     * Any character may appear in the form of an escape sequence.',
            '     *',
            '     * For portability, we also escape escape all control and non-ASCII',
            '     * characters. Note that "\\0" and "\\v" escape sequences are not used',
            '     * because JSHint does not like the first and IE the second.',
            '     */',
            '    return \'"\' + s',
            '      .replace(/\\\\/g, \'\\\\\\\\\')  // backslash',
            '      .replace(/"/g, \'\\\\"\')    // closing quote character',
            '      .replace(/\\x08/g, \'\\\\b\') // backspace',
            '      .replace(/\\t/g, \'\\\\t\')   // horizontal tab',
            '      .replace(/\\n/g, \'\\\\n\')   // line feed',
            '      .replace(/\\f/g, \'\\\\f\')   // form feed',
            '      .replace(/\\r/g, \'\\\\r\')   // carriage return',
            '      .replace(/[\\x00-\\x07\\x0B\\x0E-\\x1F\\x80-\\uFFFF]/g, escape)',
            '      + \'"\';',
            '  }',
            '  ',
            '  function merge(to,from) {',
            '    for (var key in from) { to[key] = from[key]; };',
            '  }',
            '  ',
            /* =============== CONTEXT =============== */
            '  /* CONTEXT */',
            '  ',
            '  // load variables from some object into', 
            '  // specified level of context',
            '  function ctx_load(ctx, lvl, obj) {',
            '    if (!ctx[lvl]) ctx[lvl] = {};',
            '    merge(ctx[lvl], obj);',
            '  }',
            '  // collect all variables from context at specified',
            '  // level and straight lower to 0, and return the',
            '  // result',
            '  function ctx_get(ctx, lvl) {',
            '    var c = {};',
            '    for (var i = lvl; i >= 0; i--) {',
            '      merge(c,ctx[i]);',
            '    }',
            '    return c;',
            '  }',
            '  // collect all variables from context at specified',
            '  // level and straight lower to 0, and inject into',
            '  // specified object',
            '  function ctx_inject(ctx, lvl, target) {',
            '    for (var i = lvl; i >= 0; i--) {',
            '      merge(target,ctx[i]);',
            '    }',
            '  }', 
            '  ',
            /* =============== VARIABLES =============== */
            '  /* VARIABLES */',            
            '  ',
            '  var rules = {};', // FIXME: give "_" prefix for all inner names
            '  ',
            '  var pos, // 0',
            '      failures, // {}',
            '      deep, // 1',
            '      cache, // {}',
            '      ctx, // []',
            '      target = this,',
            '      _g = this;',
            '  ',
            /* =============== FAILURES =============== */
            '  /* FAILURES */',
            '  ',              
            '  function failed(failure) {',
            '    if (pos < failures.rightest) {',
            '      return;',
            '    }',
            '    ',
            '    if (pos > failures.rightest) {',
            '      failures.rightest = pos;',
            '      failures.expected = [];',
            '    }',
            '    ',
            '    failures.expected.push(failure);',
            '  }',
            '  ',
            '  function uniqueList(expected) {',
            '    expected.sort();',
            '    ',
            '    var last = null;',
            '    var unique = [];',
            '    for (var i = 0; i < expected.length; i++) {',
            '      if (expected[i] !== last) {',
            '        unique.push(expected[i]);',
            '        last = expected[i];',
            '      }',
            '    }',
            '    ',
            '    switch (unique.length) {',
            '      case 0:',
            '        return "end of input";',
            '      case 1:',
            '        return unique[0];',
            '      default:',
            '        return unique.slice(0, unique.length - 1).join(", ")',
            '          + " or "',
            '          + unique[unique.length - 1];',
            '    }',
            '  }',
            '  ',
            '  function errorMsg() {',
            '    var expected = uniqueList(failures.expected),',
            '        actualPos = Math.max(pos, failures.rightest),',
            '        actual = (actualPos < input.length)',
            '                 ? quote(input.charAt(actualPos))',
            '                 : "end of input";',
            '    ',
            '    return "Expected " + expected + " but " + actual + " found.";',
            '  }',
            '  ',
            '  function findErrPos() {',
            '    /*',
            '     * The first idea was to use |String.split| to break the input up to the',
            '     * error position along newlines and derive the line and column from',
            '     * there. However IE\'s |split| implementation is so broken that it was',
            '     * enough to prevent it.',
            '     */',
            '    ',
            '    var line = 1;',
            '    var column = 1;',
            '    var seenCR = false;',
            '    ',  
            '    for (var i = 0; i < Math.max(pos, failures.rightest); i++) {',
            '      var ch = input.charAt(i);',
            '      if (ch === "\\n") {',
            '        if (!seenCR) { line++; }',
            '        column = 1;',
            '        seenCR = false;',
            '      } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
            '        line++;',
            '        column = 1;',
            '        seenCR = true;',
            '      } else {',
            '        column++;',
            '        seenCR = false;',
            '      }',
            '    }',
            '    ',
            '    return [ line, column ];',
            '  }',
            '  ',
            /* =============== CACHE =============== */
            '  /* CACHE */',                    
            '  ',
            '  function inCache(name) {',
            '    return cache.hasOwnProperty(name+"@"+pos);',
            '  }',
            '  ',
            '  /* must be used only next to inCache check in a way like:',
            '   * if (inCache(name)) return fromCache(name); */',
            '  function fromCache(name) {',
            '    var cached = cache[name+"@"+pos];',
            '    pos = cached.next',
            '    return cached.result;', 
            '  }',
            '  ',             
            '  /* must be used only next to inCache check in a way like:',
            '   * if (!inCache(name)) return toCache(name, rule()); */',
            '  function toCache(name, result) {',
            '    var res = {',
            '      "next": pos,', // TODO: what 'next' means?
            '      "result": result',
            '    };', 
            '    cache[name+"@"+pos] = res;',
            '    return res;',
            '  }',
            '  ',
            /* =============== INITIALIZER =============== */
            '  /* INITIALIZER */',
            '  ',
            '  #if initializerDef',
            '    function initialize() {',
            '      #block initializer',           
            '    }',
            '  #end',
            '  ',
            /* =============== RULES DEFINITIONS =============== */
            '  /* RULES DEFINITIONS */',             
            '  ',
            '  #for definition in parseFunctions',
            '    #block definition',
            '    ',
            '  #end',
            /* =============== RULES WRAPPER =============== */
            '  /* RULES WRAPPER */',
            '  ',            
            '  for (rule in rules) {',
            '    rules[rule] = (function(name, rule) { return function() {',
            '      if (inCache(name)) return fromCache(name);',
            '      ctx_inject(ctx, deep, target);', // FIXME: inject only before actions
            '      return toCache(name, rule());',
            '    }; })(rule, rules[rule]);',
            '  }',
            '  ',
            /* =============== RESULT OBJECT =============== */
            '  /* RESULT OBJECT + PARSE FUNCTION */',            
            '  ',
            '  var result = {',
            '    /*',
            '     * Parses the input with a generated parser. If the parsing is successfull,',
            '     * returns a value explicitly or implicitly specified by the grammar from',
            '     * which the parser was generated (see |PEG.buildParser|). If the parsing is',
            '     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.',
            '     */',
            /* =============== PARSE FUNCTION =============== */
            '    parse: function(input, startRule) {',
            // TODO: use 'with' to give rules the context?
            '      ',       
            '      // initialize variables',
            '      pos = 0, deep = 1, cache = {}, ctx = []',
            '      failures = { rightest: 0, expected: [] };',
            '      ',
            '      // load object returned from initializer into zero-level of context',
            '      #if initializerDef',
            '        ctx_load(ctx, 0, initialize());',
            '        ',
            '      #end', // TODO: allow to push vars into smth like 'i.', 'r.' variables,
                          //       not only global context  
            '      // find start rule',
            '      if (startRule !== undefined) {',
            '        if (rules[startRule] === undefined) {',
            '          throw new Error("Invalid rule name: " + quote(startRule) + ".");',
            '        }',
            '      } else {',
            '        startRule = #{string(startRule)};',
            '      }',
            '      ',
            '      // and execute it',
            '      var result = rules[startRule]();',
            '      ',
            '      if (result === null || pos !== input.length) {',
            '        throw new this.SyntaxError(', // TODO: test syntax error
            '          errorMsg(), findErrPos()',
            '        );',
            '      }',
            '      ',
            '      return result;',
            '    },',
            '    ',
            '    /* Returns the parser source code. */',
            '    toSource: function() { return this._source; }',
            '  };',
            '  ',
            '  /* Thrown when a parser encounters a syntax error. */',
            '  ',
            '  result.SyntaxError = function(message, errorPos) {',
            '    this.name = "SyntaxError";',
            '    this.message = message;',
            '    this.line = errorPos[0];',
            '    this.column = errorPos[1];', 
            '  };', // TODO: add expected names / types of nodes to SyntaxError (failures object)
            '  ',
            '  result.SyntaxError.prototype = Error.prototype;',
            '  ',
            '  return result;',
            '})()'
          ],
          rule: [
            'rules.#{node.name} = function() {',
            '  #block code',
            '}'
          ],
          choice: [
            '#block currentAlternativeCode',
            '#block nextAlternativesCode'
          ],
          "choice.next": [
            'if (#{resultVar} === null) {',
            '  #block code',
            '}'
          ],
          sequence: [
            'sequence(',
            '  #for expression in beforeLast',
            '    #block expression',
            '  #end',
            '  #block last',
            ');'
          ],
          "sequence.elm": [
            'function() {',
            '  #block code',
            '}'
          ],
          "sequence.elm.rule": [
            '#{code}'
          ],
          simple_and: [
            '#{posVar} = pos;',
            'reportFailures++;',
            '#block expressionCode',
            'reportFailures--;',
            'if (#{resultVar} !== null) {',
            '  #{resultVar} = "";',
            '  pos = #{posVar};',
            '} else {',
            '  #{resultVar} = null;',
            '}'
          ],
          simple_not: [
            '#{posVar} = pos;',
            'reportFailures++;',
            '#block expressionCode',
            'reportFailures--;',
            'if (#{resultVar} === null) {',
            '  #{resultVar} = "";',
            '} else {',
            '  #{resultVar} = null;',
            '  pos = #{posVar};',
            '}'
          ],
          semantic_and: [
            '#{resultVar} = (function(#{formalParams.join(", ")}) {#{node.code}})(#{actualParams.join(", ")}) ? "" : null;'
          ],
          semantic_not: [
            '#{resultVar} = (function(#{formalParams.join(", ")}) {#{node.code}})(#{actualParams.join(", ")}) ? null : "";'
          ],
          optional: [
            'maybe(function() {',
            '  #block expression',
            '});'
          ],
          zero_or_more: [
            'any(function() {',
            '  #block expression',
            '});'
          ],
          "zero_or_more.rule": [
            'any(#{expression});'
          ],
          one_or_more: [
            'some(function() {',
            '  #block expression',
            '});'
          ],
          action: [
            'action(function() {',
            '    #block expression',
            '  }, function() {',            
            '    #block node.code', 
            '  }',
            ');'       
          ],
          "action.rule": [
            'action(#{expression},',
            '  function() {',            
            '    #block node.code', 
            '  }',
            ');'          
          ],
          rule_ref: [
            //'rule(rules.#{node.name});'
            'rules.#{node.name}'
          ],
          literal: [
            '#if node.value.length === 0',
            '  #{resultVar} = "";',
            '#else',
            '  #if !node.ignoreCase',
            '    #if node.value.length === 1',
            '      if (input.charCodeAt(pos) === #{node.value.charCodeAt(0)}) {',
            '    #else',
            '      if (input.substr(pos, #{node.value.length}) === #{string(node.value)}) {',
            '    #end',
            '      #{resultVar} = #{string(node.value)};',            
            '  #else',
            /*
             * One-char literals are not optimized when case-insensitive
             * matching is enabled. This is because there is no simple way to
             * lowercase a character code that works for character outside ASCII
             * letters. Moreover, |toLowerCase| can change string length,
             * meaning the result of lowercasing a character can be more
             * characters.
             */
            '    if (input.substr(pos, #{node.value.length}).toLowerCase() === #{string(node.value.toLowerCase())}) {',
            '    #{resultVar} = input.substr(pos, #{node.value.length});',            
            '  #end',
            '    pos += #{node.value.length};',
            '  } else {',
            '    #{resultVar} = null;',
            '    if (reportFailures === 0) {',
            '      matchFailed(#{string(string(node.value))});',
            '    }',
            '  }',
            '#end'
          ],
          any: [
            'if (input.length > pos) {',
            '  #{resultVar} = input.charAt(pos);',
            '  pos++;',
            '} else {',
            '  #{resultVar} = null;',
            '  if (reportFailures === 0) {',
            '    matchFailed("any character");',
            '  }',
            '}'
          ],
          "class": [
            'if (#{regexp}.test(input.charAt(pos))) {',
            '  #{resultVar} = input.charAt(pos);',
            '  pos++;',
            '} else {',
            '  #{resultVar} = null;',
            '  if (reportFailures === 0) {',
            '    matchFailed(#{string(node.rawText)});',
            '  }',
            '}'
          ]
        };

    for (name in sources) {
      templates[name] = Codie.template(sources[name].join('\n'));
    }

    return templates;
  })();

  function fill(name, vars) {
    vars.string = quote;

    return templates[name](vars);
  }

  /*function resultVar(index) { return "result" + index; }
  function posVar(index)    { return "pos"    + index; }*/

  function isRule(expr) {
    return (expr.type === 'rule_ref'); 
  }

  var emit = buildNodeVisitor({
    grammar: function(node) {
      var initializer = node.initializer !== null
        ? emit(node.initializer)
        : "";
      
      var parseFunctions = [];
      for (var name in node.rules) {
        parseFunctions.push(emit(node.rules[name]));
      }

      console.log('grammar: ', fill("grammar", {
        initializer:    initializer,
        initializerDef: (initializer !== ""),
        parseFunctions: parseFunctions,
        startRule:      node.startRule
      }));

      return fill("grammar", {
        initializer:    initializer,
        initializerDef: (initializer !== ""),
        parseFunctions: parseFunctions,
        startRule:      node.startRule
      });
    },

    initializer: function(node) {
      console.log('/initializer', node);
      return node.code;
    },

    rule: function(node) {
      console.log('/rule', node);

      return fill("rule", {
        node:       node,
        code:       emit(node.expression)
      });
    },

    // ======= COMBINATIONS =======

    choice: function(node/*, context*/) {
      console.log('/choise', node);

      return "'<choise >'";
    },

    sequence: function(node/*, context*/) {
      console.log('/sequence', node);

      var _transform = function(expr) {
        return fill((isRule(expr) ? "sequence.elm.rule" : "sequence.elm"),
                    { code: emit(expr) });
      }; 

      var elms = node.elements;
      var beforeLast = [];
      for (var i = 0; i < (elms.length - 1); i++) {
        beforeLast.push(_transform(elms[i]) + ','); // FIXME: may be appending
                                                    // comma here is not ok
      };

      var last = _transform(elms[elms.length - 1]);

      console.log('::::::', fill("sequence", { beforeLast: beforeLast, 
                                last: last }));

      return fill("sequence", { beforeLast: beforeLast, 
                                last: last });
    },

    labeled: function(node/*, context*/) {
      console.log('/labeled', node.expression);
      return "'<labeled>'";
    },

    simple_and: function(node/*, context*/) {
      console.log('/simple_and', node.expression);
      return "'<simple_and>'";
    },

    simple_not: function(node/*, context*/) {
      console.log('/simple_not', node.expression);
      return "'<simple_not>'";      
    },

    semantic_and: function(node/*, context, previousResults*/) {
      console.log('/sem_and', node.expression);
      return "'<sem_and>'";
    },

    semantic_not: function(node/*, context, previousResults*/) {
      console.log('/sem_not', node.expression);
      return "'<sem_not>'";
    },

    optional: function(node/*, context*/) {
      console.log('/optional', node.expression);
      return "'<optional>'";
    },

    zero_or_more: function(node/*, context*/) {
      console.log('/zero_or_more', node.expression);
      return fill((isRule(node.expression) ? "zero_or_more.rule" 
                                           : "zero_or_more"),
                  { expression: emit(node.expression) });
    },

    one_or_more: function(node/*, context*/) {
      console.log('/one_or_more', node.expression);
      return "'<one_or_more>'";
    },

    action: function(node/*, context*/) {
      console.log('/action', node.expression);
      
      return fill((isRule(node.expression) ? "action.rule" 
                                           : "action"), {
        node: node,
        expression: emit(node.expression)
      });

    },

    rule_ref: function(node/*, context*/) {
      console.log('/rule_ref', node.name);
      return fill("rule_ref", { node: node });
    },

    literal: function(node/*, context*/) {
      console.log('/literal', node.expression);
      return "'<literal>'";
    },

    any: function(node/*, context*/) {
      console.log('/any', node.expression);
      return "'<any>'";
    },

    "class": function(node/*, context*/) {
      console.log('/class', node.expression);
      return "'<class>'";
    }
  });

  return emit(ast);
};

