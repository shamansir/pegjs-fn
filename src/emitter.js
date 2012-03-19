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
            '  /* Compact-Result modification by shaman.sir@gmail.com. */',
            '  ',
            /* =============== UTILS ===================== */
            '  /* UTILS */',
            '  ',
            '  var EOI = \'end of input\';',
            '  ',
            /* This needs to be in sync with |hexOf| in utils.js. */
            '  function hexOf(ch) {',
            '    var x = ch.charCodeAt(0),',
            '        v = x.toString(16).toUpperCase()',
            '        h = (x > 0xFF),',
            '        i = (h ? 4 : 2) - v.length;',
            '    while (i--) v = v + \'0\';',
            '    return \'\\\\\' + (h ? \'u\' : \'x\') + v;',
            '  }',
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
            '      .replace(/[\\x00-\\x07\\x0B\\x0E-\\x1F\\x80-\\uFFFF]/g, hexOf)',
            '      + \'"\';',
            '  }',
            '  ',
            /* =================== VARIABLES ==================== */
            '  /* VARIABLES */',            
            '  ',
            '  var rules = {},', // FIXME: give "_" prefix for all inner names?
            '      names = {};',
            '  ',
            '  var pos, // 0',
            '      failures, // []',
            '      cache, // {}',
            '      ctx, // { ... }',
            '      cctx, // { ... }',
            '      current; // \'\'',
            '  ',
            '  var /*input, */ilen;',
            '  ',
            /* =================== FAILURES ===================== */
            '  /* FAILURES */',
            '  ',
            '  function MatchFailed(what, found) {',
            '    this.what = what;',
            '    this.found = found;',
            '    this.pos = pos;',
            '    this.xpos = [-1, -1];',
            '  }',
            '  MatchFailed.prototype = new Error();',
            '  ',              
            '  function failed(expected, found) {',
            '    var f; for (var i = failures.length; i--;) {',
            '      if (failures[i] === expected) {',
            '        f = 1; break;',
            '      }',
            '    }; if (!f) failures.push(expected);',
            '    throw new MatchFailed(current, found)',
            '  }',
            '  ',
            '  function safe(f, callback) {',
            '    try { return f();',
            '    } catch(e) {',
            '      if (e instanceof MatchFailed) {',
            '        if (callback) callback(e);',
            '      } else { throw e; }',
            '    }',
            '  }',
            '  ',
            '  function epos(pos) { // error 2-dimtnl position',
            '    /*',
            '     * The first idea was to use |String.split| to break the input up to the',
            '     * error position along newlines and derive the line and column from',
            '     * there. However IE\'s |split| implementation is so broken that it was',
            '     * enough to prevent it.',
            '     */',
            '    ',
            '    var ln = 1, col = 1,',
            '        cr = 0; // bool, was CR found or not?',
            '    ',  
            '    for (var i = 0; i < pos; i++) {',
            '      var ch = input.charAt(i);',
            '      if (ch === "\\n") {',
            '        if (!cr) { ln++; }',
            '        col = 1; cr = 0;',
            '      } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
            '        ln++; col = 1; cr = 1;',
            '      } else {',
            '        col++; cr = 0;',
            '      }',
            '    }',
            '    ',
            '    return [ ln, col ];',
            '  }',
            '  function emsg(e) {',
            '    return \'Stopped at \'+e.what+\': \'+',
            '           \'Expected \'+failures.slice(0,-1).join(\', \')+\' \'+',
            '           \'or \'+failures.slice(-1)+\', but \'+e.found+\' found\'', // \'+
            //'         \'at \'+e.xpos.join(\':\');',
            '  }',            
            '  ',
            /* =================== CACHE ======================== */
            '  /* CACHE */',                    
            '  ',
            '  function cached(name) {',
            '    return (cache.hasOwnProperty(name+"@"+pos)',
            '           ? (name+"@"+pos) : 0);',
            '  }',
            '  ',
            '  function _cache(key) { // load out of cache',
            '    var cached = cache[key];',
            '    pos = cached.next',
            '    return cached.result;', 
            '  }',
            '  ',
            '  function cache_(key, result) { // store in cache',
            '    var res = {',
            '      "next": pos,',
            '      "result": result',
            '    };', 
            '    cache[key] = res;',
            '    return res.result;',
            '  }',
            '  ',
            /* =================== CONTEXT ====================== */
            '  /* CONTEXT */',
            '  ',
            '  function din() { // dive in', 
            '    if (cctx.__c) { cctx = cctx.__c; return; }',
            '    var inner = { __p: cctx,',
            '                  __c: null, __w: [] };',
            '    cctx.__c = inner;',
            '    cctx = inner;',
            '  }',
            '  function dout() { // dive out',
            '    cctx = cctx.__p;',
            '  }',
            '  function inctx(f) { // execute in own context and return',
            '    din(); var r = f();',
            '    dout(); return r;',
            '  }',
            '  function lctx() { // load context',
            '    var t = cctx;',
            '    if (!t.__p) return t;',
            '    var res = {}, w, p;',
            '    while (t) { w = t.__w;',
            '      for (var i = w.length; i--;) {',
                     // FIXME: make shorter
            '        p = w[i]; if (!res.hasOwnProperty(p)) { res[p] = t[p]; }',
            '      }',
            '      t = t.__p;',
            '    }',
            '    return res;',
            '  }',
            '  function ctx_(key, val) { // push to context',
            '    //if (typeof key === \'object\') ctx', // no, will recurse in objects
            '    cctx[key] = val;',
            '    cctx.__w.push(key);',
            '    return val;',
            '  }',
            '  ',
            '  function ctxo_(obj) { // push object to context',
            '    for (var p in obj) ctx_(p, obj[p]);',
            '  }',
            '  ',
            /* =================== DEFERRED ===================== */
            '  /* DEFERRED */',
            '  ',
            /*  function bind(f, args) {
                  return function() {
                      return f.apply(null, args);
                  };
                }
                function wrap(f) {
                  return function() {
                    return bind(f, arguments);
                  };
                }
            */
            '  function def(f) {',
            '    return function() {',
            '      return (function(f, args) {',
            '        return function() { return f.apply(null, args); };',
            '      })(f, arguments);',
            '    }',
            '  }',
            '  ',
            /* =================== OPERATORS ==================== */
            '  /* OPERATORS */',
            // FIXME: include only operators that factually used
            '  ',
            '  // get current char',
            '  function cc() { return quote(input.charAt(pos)); }',
            '  ',
            // rule_ref ==========
            '  #if stats.rule_ref',
            '    var ref = def(inctx); // will call rule inside context',
            '  #end',
            '  ',
            // action ============
            '  #if stats.action',
            '    function action(f, code) {',
            '      return inctx(function() {',
            '        f(); return code(lctx());',
            '      });',
            '    }',
            '    action = def(action);',
            '  ',
            '  #end',
            // sequence ==========
            '  #if stats.sequence',
            '    function seqnc(/*f...*/) {',
            '      var fs = arguments,',
            '          s = [];',
            '      for (var fi = 0, fl = fs.length;',
            '           fi < fl; fi++) {',
            '        s.push(fs[fi]());',
            '      }',
            '      return s;',
            '    }',
            '    seqnc = def(seqnc);',
            '  ',
            '  #end',
            // choice ============
            '  #if stats.choice',
            '    function choice(/*f...*/) {',
            '      var fs = arguments,',
            '          missed = 0,',
            '          my_e = null,',
            '          on_miss = function(e) {',
            '            my_e = e; missed = 1;',
            '          };',
            '      for (var fi = 0, fl = fs.length;', 
            '           fi < fl; fi++) {',
            '        var res = safe(fs[fi], on_miss);',
            '        if (!missed) return res;',
            '        missed = 0;',
            '      }',
            '      throw my_e;',
            '    }',
            '    choice = def(choice);',
            '  ',
            '  #end',
            // match =============
            '  #if stats.literal',
            '    function match(str) {',
            '      var slen = str.length;',
            '      if ((pos + slen) > ilen) {',
            '        failed(quote(str), EOI); // exits',
            '      }',
            '      if (input.substr(pos, slen) === str) {',
            '        pos += slen;',
            '        return str;',
            '      }',
            '      failed(quote(str), cc());',     
            '    }',
            '    match = def(match);',
            '  ',
            '  #end',
            // labeled ===========
            '  #if stats.labeled',
            '    function label(lbl, f) {',
            '      return ctx_(lbl, f());',
            '    }',
            '    label = def(label);',
            '  ',
            '  #end',
            // one_or_more ======
            '  #if stats.one_or_more',
            '    function some(f) {',
            '      return [f()].concat(any(f)());',
            '    }',
            '    some = def(some);',
            '  ',
            '  #end',
            // zero_or_more =======
            '  #if stats.zero_or_more || stats.one_or_more',
            '    function any(f) {',
            '      var s = [],',
            '          missed = 0,',
            '          on_miss = function() { missed = 1; };',
            '      while (!missed) {',
            '        s.push(safe(f, on_miss));',
            '      }',
            '      if (missed) s.splice(-1);',
            '      return s;',
            '    }',
            '    any = def(any);',
            '  ',
            '  #end',
            // optional ==========
            '  #if stats.optional',
            '    function maybe(f) {',
            '      var missed = 0,',
            '          res = safe(f, function() {',
            '        missed = 1;',
            '      });',
            '      if (missed) return \'\';',
            '      return res;',
            '    }',
            '    maybe = def(maybe);',
            '  ',            
            '  #end',  
            // semantic_and =======
            '  #if stats.semantic_and',
            '    function pre(code) {',
            '      return code(lctx()) ? \'\'',
            '                        : failed(cc(), EOI);',
            '    }',
            '    pre = def(pre);',
            '  ',
            '  #end',
            // semantic_not =======
            '  #if stats.semantic_not',
            '    function xpre(code) {',
            '      return code(lctx()) ? failed(cc(), EOI)',
            '                          : \'\';',
            '    }',
            '    xpre = def(xpre);',
            '  ',
            '  #end',
            // simple_and ==========
            '  #if stats.simple_and',
            '    function and(f) {',
            '      var prev = pos;',
            '      f(); pos = prev;',
            '      return \'\';',
            '    }',
            '    and = def(and);',
            '  ',
            '  #end',
            // simple_not ==========
            '  #if stats.simple_not',
            '    function not(f) {',
            '      var prev = pos, missed = 0;',
            '      safe(f, function() {',
            '        missed = 1;',
            '      });',
            '      pos = prev;',
            '      if (missed) return \'\';',
            '      failed(EOI, cc());',
            '    }',
            '    not = def(not);',
            '  ',
            '  #end',
            // klass || literal_re
            '  #if stats.klass || stats.literal_re',
            '    function re(rx, desc) {', // == imatch
            '      var res, desc = desc || rx.source;',
            '      if (res = rx.exec(input.substr(pos))) {',
            '         if (res.index !== 0) failed(desc, cc());',
            '         pos += res[0].length;',
            '         return res[0];',
            '      } else failed(desc, cc());',
            '    }',
            '    re = def(re);',
            '  ',
            '  #end',
            // any
            '  #if stats.any',
            '    function ch() { // char',
            '      if (pos >= ilen) failed(\'some char\', EOI);',
            '      return input[pos++];',
            '    }',
            '    ch = def(ch);',
            '  ',
            '  #end',
            /* =================== INITIALIZER ================== */
            '  /* INITIALIZER */',
            '  ',
            '  #if initializerDef',
            '    function initialize() {',
            '      #block initializer',           
            '    }',
            '  ',
            '  #end',
            /* =================== RULES DEFINITIONS ============ */
            '  /* RULES DEFINITIONS */',
            '  ',
            '  (function() {',
            '  #for definition in rulesDefs',
                 // FIXME: ensure somehow that inner code of 
                 // rules has no acces to outer things
            '    #block definition',
            '    ',
            '  #end',
            '  })();',
            /* =================== RULES WRAPPER ================ */
            '  /* RULES WRAPPER */',
            // TODO: add only those 'any/some/literal...'-function that factually used
            '  ',
            '  var ckey; // cache key',
            '  for (rule in rules) {',
            '    rules[rule] = (function(name, rule) {', 
            '      return function() {',
            '        current = name;',
            '        if (ckey = cached(name)) return _cache(ckey);',
            '        return cache_(ckey, rule());',
            '      };',
            '    })(rule, rules[rule]);',
            '  }',
            '  ',
            /* =================== RESULT OBJECT ================ */
            '  /* RESULT OBJECT + PARSE FUNCTION */',
            '  ',
            '  var g = this;', // FIXME: to set input, ensure that required
            '  ',
            '  var result = {',
            '    /*',
            '     * Parses the input with a generated parser. If the parsing is successfull,',
            '     * returns a value explicitly or implicitly specified by the grammar from',
            '     * which the parser was generated (see |PEG.buildParser|). If the parsing is',
            '     * unsuccessful, throws |PEG.parser.MatchFailed| describing the error.',
            '     */',
            /* =================== PARSE FUNCTION =============== */
            '    parse: function(input, startRule) {',
            // TODO: use 'with' to give rules the context?
            '      ',       
            '      // initialize variables',
            '      pos = 0, ilen = input.length, failures = [];',
            '      g.input = input;',
            '      ',
            '      cache = {};',
            '      ctx = { __p: null, __c: null, __w: [] }, cctx = ctx;',
            '      current = \'-\';',
            '      ',
            '      #if initializerDef',
            '        // load object returned from initializer into zero-level of context',
            '        initialize();',
            '      #end',
            '      ',
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
            '      var res;',            
            '      try {',
            '        res = rules[startRule]();',
            '        if ((pos < ilen) || ',
            '            (res === null)) failed(EOI, cc());',
            '      } catch(e) {',
            '        if (e instanceof MatchFailed) {',
            '          e.xpos = epos(e.pos);',
            '          e.message = emsg(e);',
            '        }',
            '        throw e;',
            '      }',
            '      ',
            '      return res;',
            '    },',
            '    ',
            '    /* Returns the parser source code. */',
            '    toSource: function() { return this._source; },',
            '    ',
            '    /* makes error type accessible outside */',
            '    MatchFailed: MatchFailed',
            '  };',
            '  ',
            '  return result;',
            '})()'
          ],
          rule: [
            'rules.#{node.name} = function() {',
            '  return (',
            '    #block code',
            '  ());',
            '}', // FIXME: displayName!
            '#if node.displayName',
            '  names.#{node.name}=#{string(node.displayName)};',
            '#end'
          ],
          choice: [
            'choice(',
            '  #for expression in beforeLast',
            '    #block expression',
            '  #end',
            '  #block last',
            ')'
          ],
          sequence: [
            'seqnc(',
            '  #for expression in beforeLast',
            '    #block expression',
            '  #end',
            '  #block last',
            ')'
          ],
          labeled: [
            'label(#{string(node.label)},',
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
            'pre(function() {',
            '  #block code',  
            '})'
          ],
          semantic_not: [
            'xpre(function() {',
            '  #block code',  
            '})'
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
            '  #block expression',
            '  function(ctx) {',            
            '    #block node.code', 
            '  }',
            ')'       
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
      
      var rulesDefs = [];
      for (var name in node.rules) {
        rulesDefs.push(emit(node.rules[name]));
      }

      return fill("grammar", {
        initializer:    initializer,
        initializerDef: (initializer !== ""),
        rulesDefs:      rulesDefs,
        startRule:      node.startRule,
        stats:          node.stats
      });
    },

    initializer: function(node) {
      return node.code;
    },

    rule: function(node) {
      return fill("rule", {
        node:       node,
        code:       emit(node.expression)
      });
    },

    // ======= COMBINATIONS =======

    choice: function(node) {
      var elms = node.alternatives;
      var beforeLast = [];
      for (var i = 0; i < (elms.length - 1); i++) {
        beforeLast.push(emit(elms[i]) + ','); // FIXME: may be appending
                                              // comma here is not ok
      };

      var last = emit(elms[elms.length - 1]);

      return fill("choice", { beforeLast: beforeLast, 
                              last: last });
    },

    sequence: function(node) {
      var elms = node.elements;
      var beforeLast = [];
      for (var i = 0; i < (elms.length - 1); i++) {
        beforeLast.push(emit(elms[i]) + ','); // FIXME: may be appending
                                              // comma here is not ok
      };

      var last = emit(elms[elms.length - 1]);

      return fill("sequence", { beforeLast: beforeLast, 
                                last: last });
    },

    labeled: function(node) {
      return fill("labeled", { node: node,
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
      return fill("semantic_and", { code: node.code });
    },

    semantic_not: function(node) {
      return fill("semantic_not", { code: node.code });
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
      return fill("action", {
        node: node,
        expression: emit(node.expression) + ',' // FIXME: may be appending
                                                // comma here is not ok
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

  return emit(ast);
};