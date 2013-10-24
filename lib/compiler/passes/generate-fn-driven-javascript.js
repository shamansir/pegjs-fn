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
          if (exit) { return exit(state); };

          return ['}', []];
        },
        stackOp: "pop"
      },
      // TODO: inline-block
      // TODO: add postfix for block
      "block": {
        params: /^(?:\<([^ \t\>]+)\>[ \t]+)?([^ \t]+)(?:[ \t]+\<([^ \t\>]+)\>)?$/, // ^(?:\<([^ \t\>]+)\>[ \t]+)?([^ \t]+)(?:[ \t]+\<([^ \t\>]+)\>)?$
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
          name, match, result, i;

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
      'CTX': 'ċ',
      'INPUT': 'input',
      'OPTIONS': 'options',
      'POS': 'pos',
      'PPOS': 'p_pos',
      '_COORD': PRIVATE_VAR_PREFIX + 'coord',
      '_COORD_CACHE': PRIVATE_VAR_PREFIX + 'coord_cache',
      '_COORD_RESET': PRIVATE_VAR_PREFIX + 'reset_coord'
  };

  var templates = (function() {
    var name,
        templates = {},
        sources = {
          grammar: [
            '(function(){',
            '  /* Generated by PEG.js @VERSION (http://pegjs.majda.cz/). */',
            '  /* Compact-Result modification by shaman.sir@gmail.com. */',
            '  ',
            /* =============== USER BLOCK ================ */
            '  /* PARSER ENVIRONMENT */',
            '  ',
            '  var #{INPUT},',
            '      #{OPTIONS};',
            '  ',
            '  var #{POS}, // 0, parser position',
            '      #{PPOS}; // 0, previous parser position',
            '  ',
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
            '    var __blocks = (function() { return function() {',
            '      ',
            '      // backwards compatibility with original peg-js',
            '      function offset() { return #{PPOS}; };',
            '      function text() { return #{INPUT}.substring(#{PPOS}, #{POS}); };',
            '      function line() { return #{_COORD}(#{PPOS})[1]; };',
            '      function column() { return #{_COORD}(#{PPOS})[0]; };',
            '      function cell() { return #{_COORD}(#{PPOS}); };',
            '      ',
            '      #if initializerDef',
            '        ',
            '        /* INITIALIZER */',
            '        #block initializer',
            '      #end',
            '      ',
            '      #if blocksDef',
            '        /* BLOCKS */',
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
            '                      return (function() {',
            '                        #block userBlock.code',
            '                      })();',
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
            '  /* PARSER CODE */',
            '  ',
            '  var __parser = function() {',
            '    ',
            /* =============== UTILS ===================== */
            '    /* UTILS */',
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
            /* =================== VARIABLES ==================== */
            // TODO: more comments
            '    /* VARIABLES */',
            '    ',
            '    var rules = {};', // FIXME: give "_" prefix for all inner names, or, better, generate int IDs for them?
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
            /* =================== FAILURES ===================== */
            '    /* FAILURES */',
            '    ',
            '    function MatchFailed(what, found, expected) {',
            '      this.what = what;',
            '      this.expected = expected || [];',
            '      this.found = found;',
            '      this.pos = #{POS};',
            '      this.xpos = [-1, -1];',
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
            '    function emsg(e,forced_found,forced_exp) {',
            '      var exp_str = forced_exp;',
            '      if (!exp_str) {',
            '        var xs = e.expected;',
            '        exp_str = ((xs.length > 1)',
            '                  ? (xs.slice(0,-1).join(\', \')+\' \'+',
            '                    \'or \'+xs.slice(-1))',
            '                  : xs[0]);',
            '      }',
            '      return /*\'Stopped at \'+quote(e.what)+\': */\'Expected \'+exp_str+',
            '             \' but \'+(forced_found||e.found)+\' found.\';', // \'+
            //'           \'at \'+e.xpos.join(\':\');',
            '    }',
            '    function adapt(e) {',
            '      var forced_found, forced_exp;',
            '      if (e.found instanceof Marker) {',
            '        forced_found = e.found.str;',
            '        e.found = (e.found !== EOI) ? e.found.str : null;',
            '      }',
            '      if ((e.expected.length === 1) &&',
            '          (e.expected[0] === EOI)) {',
            '        forced_exp = EOI.str;',
            '        e.expected = [];',
            '      } else {',
            '        var xs = e.expected;',
            '        for (var i = xs.length; i--;)',
            '            { if (xs[i] instanceof Marker) xs[i] = xs[i].str; };',
            '      }',
            '      e.xpos = #{_COORD}(e.pos);',
            '      e.message = emsg(e,forced_found,forced_exp);',
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
            /* =================== CACHE ======================== */
            '    #if options.cache',
            '      /* CACHE */',
            '      ',
            '      // it is important to get cache key before executing',
            '      // the rule body, because pos is required to be in the',
            '      // state it was left before applying the rule, untouchable,',
            '      // to make cache work properly',
            '      function _ckey(name) { return name+"@"+#{POS}; } // get cache key',
            '      ',
            '      function cached(key) { // is there\s something in cache',
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
            '    /* CONTEXT */',
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
            '    /* DEFERRED */',
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
            /* =================== OPERATORS ==================== */
            '    /* OPERATORS */',
            '    ',
            '    // get current char',
            '    function cc() { return (#{POS} < ilen) ? quote(#{INPUT}.charAt(#{POS})) : EOI; }',
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
            '        #{PPOS} = #{POS}; // save previous position',
            '        var fs = arguments,',
            '            s = [],',
            '            on_miss = function(e) {',
            '                          #{POS} = #{PPOS}; throw e; };',
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
            '        return code(cctx) ? \'\'',
            '                          : failed(cc(), EOI);',
            '      }',
            '      pre = def(pre);',
            '      ',
            '    #end',
            // semantic_not =======
            '    #if stats.semantic_not',
            '      function xpre(code) {',
            '        return code(cctx) ? failed(cc(), EOI)',
            '                            : \'\';',
            '      }',
            '      xpre = def(xpre);',
            '      ',
            '    #end',
            // simple_and ==========
            '    #if stats.simple_and',
            '      function and(f) {',
            '        #{PPOS} = #{POS}; var missed = 0;',
            '        nr = 1; safe(f, function(e) {',
            '          missed = e;',
            '        }); nr = 0;',
            '        #{POS} = #{PPOS};',
            '        if (missed) failed(EOI, cc());',
            '        return \'\';',
            '      }',
            '      and = def(and);',
            '      ',
            '    #end',
            // simple_not ==========
            '    #if stats.simple_not',
            '      function not(f) {',
            '        #{PPOS} = #{POS}; var missed = 0;',
            '        nr = 1; safe(f, function() {',
            '          missed = 1;',
            '        }); nr = 0;',
            '        #{POS} = #{PPOS};',
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
            /* =================== RULES DEFINITIONS ============ */
            '    /* RULES DEFINITIONS */',
            '    ',
            '    (function() {',
            '    ',
            '    #for definition in rulesDefs',
            '      #block definition',
            '      ',
            '    #end',
            '    })();',
            '    ',
            /* =================== RULES WRAPPER ================ */
            '    /* RULES WRAPPER */',
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
            '    /* RESULT OBJECT + PARSE FUNCTION */',
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
            '        ilen = _input.length, failures = {}, rmfpos = 0, nr = 0;',
            '        #{_COORD_RESET}();',
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
            '          #{CODE} = __blocks();',
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
            '      /* Returns the parser source code. */',
            '      toSource: function() { return this._source; },',
            '      ',
            '      /* makes error type accessible outside */',
            '      MatchFailed: MatchFailed,',
            '      SyntaxError: SyntaxError',
            '    };',
            '    ',
            '    return result;',
            '    ',
            '  };',
            '  ',
            '  // a function to find line-column position from a char-based position',
            '  var #{_COORD_CACHE}; // cache of 2d position: [ last_pos, column, line, seen_cr ]',
            '  function #{_COORD_RESET}() { #{_COORD_CACHE} = [ 0, 1, 1, 0 ]; };',
            '           #{_COORD_RESET}();',
            '  function #{_COORD}(pos) {',
            '    /*',
            '     * The first idea was to use |String.split| to break the input up to the',
            '     * error position along newlines and derive the line and column from',
            '     * there. However IE\'s |split| implementation is so broken that it was',
            '     * enough to prevent it.',
            '     */',
            '    var cl = 1, ln = 1,',
            '        cr = 0, // bool, was CR found or not?',
            '        c = #{_COORD_CACHE};',
            '    ',
            '    if (pos !== c[0]) {',
            '      if (pos < c[0]) {',
            '        #{_COORD_RESET}();',
            '      } else {',
            '        cl = c[1], ln = c[2], cr = c[3];',
            '      }',
            '      var from = c[0], to = pos;',
            '      for (var i = from, ch; i < to; i++) {',
            '        ch = #{INPUT}.charAt(i);',
            '        if (ch === "\\n") {',
            '          if (!cr) { ln++; }',
            '          cl = 1; cr = 0;',
            '        } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
            '          ln++; cl = 1; cr = 1;',
            '        } else /*if (ch.length)*/ {',
            '          cl++; cr = 0;',
            '        }',
            '      }',
            '      #{_COORD_CACHE} = [ pos, cl, ln, cr ];',
            '      return [ cl, ln ];',
            '    } else return [ c[1], c[2] ];',
            '    ',
            '  }',
            '  ',
            '  return __parser();',
            '  ',
            '})()'
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
            '    #block </*{> node.code <}*/>'
          ],
          semantic_not: [
            //'xpre(#{CODE}.#{blockAddr.rule}[#{blockAddr.id}](cctx))',
            'xpre(_code[#{blockAddr.id}])',
            '     #block </*{> node.code <}*/>'
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
            '  #block </*{> node.code <}*/>'
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
        if (subnode.name === 'start') hasRuleNamedStart = true;
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
      };

      var last = emit(elms[elms.length - 1]);

      return fill("choice", { beforeLast: beforeLast,
                              last: last });
    },

    sequence: function(node) {
      var elms = node.elements;
      var beforeLast = [];
      for (var i = 0, il = elms.length; i < (il - 1); i++) {
        beforeLast.push(emit(elms[i]))
      };

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
                                    blockAddr: node.blockAddr });
    },

    semantic_not: function(node) {
      ensureHasAddr(node);
      return fill("semantic_not", { node: node,
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
