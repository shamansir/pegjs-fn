module.exports = (function(){
  /* Generated by PEG.js 0.6.2 (http://pegjs.majda.cz/). */
  /* Compact-Result modification by shaman.sir@gmail.com. */
  
  /* UTILS */
  
  var EOI = 'end of input';
  
  function hexOf(ch) {
    var x = ch.charCodeAt(0),
        v = x.toString(16).toUpperCase()
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
  
  /* VARIABLES */
  
  var rules = {},
      names = {};
  
  var pos, // 0
      failures, // []
      cache, // {}
      ctx, // { ... }
      cctx, // { ... }
      current; // ''
  
  var /*input, */ilen;
  
  /* FAILURES */
  
  function MatchFailed(what, found) {
    this.what = what;
    this.found = found;
    this.pos = pos;
    this.xpos = [-1, -1];
  }
  MatchFailed.prototype = new Error();
  
  function failed(expected, found) {
    var f; for (var i = failures.length; i--;) {
      if (failures[i] === expected) {
        f = 1; break;
      }
    }; if (!f) failures.push(expected);
    throw new MatchFailed(current, found)
  }
  
  function safe(f, callback) {
    try { return f();
    } catch(e) {
      if (e instanceof MatchFailed) {
        if (callback) callback(e);
      } else { throw e; }
    }
  }
  
  function epos(pos) { // error 2-dimtnl position
    /*
     * The first idea was to use |String.split| to break the input up to the
     * error position along newlines and derive the line and column from
     * there. However IE's |split| implementation is so broken that it was
     * enough to prevent it.
     */
    
    var ln = 1, col = 1,
        cr = 0; // bool, was CR found or not?
    
    for (var i = 0; i < pos; i++) {
      var ch = input.charAt(i);
      if (ch === "\n") {
        if (!cr) { ln++; }
        col = 1; cr = 0;
      } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
        ln++; col = 1; cr = 1;
      } else {
        col++; cr = 0;
      }
    }
    
    return [ ln, col ];
  }
  function emsg(e) { // error message TODO: make look like "a", "b" or "c"
    // TODO: e.what stores failed rule name
    return "Expected "+failures+" but "+e.found+" found at "+e.xpos;
  }
  
  /* CACHE */
  
  function cached(name) {
    return cache.hasOwnProperty(name+"@"+pos);
  }
  
  /* must be used only next to `cached` check in a way like:
   * if (cached(name)) return _cache(name); */
  function _cache(name) { // load out of cache
    var cached = cache[name+"@"+pos];
    pos = cached.next
    return cached.result;
  }
  
  /* must be used only next to `cached` check in a way like:
   * if (!cached(name)) return cache_(name, rule()); */
  function cache_(name, result) { // store in cache
    var res = {
      "next": pos,
      "result": result
    };
    cache[name+"@"+pos] = res;
    return res;
  }
  
  /* CONTEXT */
  
  function din() { // dive in
    if (cctx.__c) { cctx = cctx.__c; return; }
    var inner = { __p: cctx,
                  __c: null, __w: [] };
    cctx.__c = inner;
    cctx = inner;
  }
  function dout() { // dive out
    cctx = cctx.__p;
  }
  function inctx(f) { // execute in own context and return
    din(); var r = f();
    dout(); return r;
  }
  function lctx() { // load context
    var t = cctx;
    if (!t.__p) return t;
    var res = {}, w, p;
    while (t) { w = t.__w;
      for (var i = w.length; i--;) {
        p = w[i]; if (!res.hasOwnProperty(p)) { res[p] = t[p]; }
      }
      t = t.__p;
    }
    return res;
  }
  function save(key, val) {
    cctx[key] = val;
    cctx.__w.push(key);
    return val;
  }
  
  /* DEFERRED */
  
  function def(f) {
    return function() {
      return (function(f, args) {
        return function() { return f.apply(null, args); };
      })(f, arguments);
    }
  }
  
  /* OPERATORS */
  
  // get current char
  function cc() { return quote(input.charAt(pos)); }
  
  var ref = def(inctx); // will call rule inside context
  
  function action(f, code) {
    return inctx(function() {
      f(); return code(lctx());
    });
  }
  action = def(action);
  
  function seqnc(/*f...*/) {
    var fs = arguments,
        s = [];
    for (var fi = 0, fl = fs.length;
         fi < fl; fi++) {
      s.push(fs[fi]());
    }
    return s;
  }
  seqnc = def(seqnc);
  
  function choise(/*f...*/) {
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
  choise = def(choise);
  
  function match(str) {
    var slen = str.length;
    if ((pos + slen) > ilen) {
      failed(str, EOI); // exits
    }
    if (input.substr(pos, slen) === str) {
      pos += slen;
      return str;
    }
    failed(str, cc());
  }
  match = def(match);
  
  function label(lbl, f) {
    return save(lbl, f());
  }
  label = def(label);
  
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
  
  function pre(code) {
    return code(lctx()) ? ''
                        : failed(cc(), EOI);
  }
  pre = def(pre);
  
  function xpre(code) {
    return code(lctx()) ? failed(cc(), EOI)
                        : '';
  }
  xpre = def(xpre);
  
  function and(f) {
    var prev = pos;
    f(); pos = prev;
    return '';
  }
  and = def(and);
  
  function not(f) {
    var prev = pos, missed = 0;
    safe(f, function() {
      missed = 1;
    });
    pos = prev;
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
    if (pos >= ilen) failed('some char', EOI);
    return input[pos++];
  }
  ch = def(ch);
  
  /* INITIALIZER */
  
  function initialize() {
     console.log("initializer");
      return { foo: 11 }; 
  }
  
  /* RULES DEFINITIONS */
  
  rules.start = function() {
    return 
      action(
        any(
          ref(rules.a)
        ),
        function(x) {
           console.log(foo); 
        }
      )
    ();
  }
  
  rules.a = function() {
    return 
      seqnc(
        ref(rules.w),
        some(
          ref(rules.m)
        ),
        any(
          action(
            choice(
              match("b"),
              label("d",
                match("c")
              )
            ),
            function(x) {
               return d; 
            }
          )
        )
      )
    ();
  }
  
  rules.w = function() {
    return 
      some(
        action(
          ref(rules.c),
          function(x) {
             console.log('test'); 
          }
        )
      )
    ();
  }
  
  rules.c = function() {
    return 
      choice(
        match("a"),
        match("e"),
        ref(rules.g)
      )
    ();
  }
  
  rules.g = function() {
    return 
      re(/oooo/i, "oooo")
    ();
  }
  
  rules.m = function() {
    return 
      seqnc(
        match("a"),
        maybe(
          ref(rules.n)
        )
      )
    ();
  }
  
  rules.n = function() {
    return 
      label("d",
        action(
          seqnc(
            some(
              ref(rules.b)
            ),
            ref(rules.e),
            ref(rules.f)
          ),
          function(x) {
             return "aa"; 
          }
        )
      )
    ();
  }
  
  rules.b = function() {
    return 
      match("wee")
    ();
  }
  
  rules.e = function() {
    return 
      seqnc(
        match("meeh"),
        ref(rules.one_char),
        label("f",
          not(
            ref(rules.one_char)
          )
        )
      )
    ();
  }
  
  rules.f = function() {
    return 
      choice(
        match("foo"),
        and(
          ref(rules.two_strange_chars)
        )
      )
    ();
  }
  names.f="foo";
  
  rules.one_char = function() {
    return 
      seqnc(
        xpre(function() {
           console.log("not predicate"); console.log(foo); return false; 
        }),
        char()
      )
    ();
  }
  
  rules.two_strange_chars = function() {
    return 
      seqnc(
        pre(function() {
           console.log("predicate"); return true; 
        }),
        re(/^[a-n]/i, "[a-n]i"),
        re(/^[^A-Z]/, "[^A-Z]")
      )
    ();
  }
  names.two_strange_chars="tsc";
  
  /* RULES WRAPPER */
  
  for (rule in rules) {
    rules[rule] = (function(name, rule) {
      return function() {
        current = name;
        if (cached(name)) return _cache(name);
        return cache_(name, rule());
      };
    })(rule, rules[rule]);
  }
  
  /* RESULT OBJECT + PARSE FUNCTION */
  
  var g = this;
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      
      // initialize variables
      pos = 0, ilen = input.length, failures = [];
      g.input = input;
      
      cache = {};
      ctx = { __p: null, __c: null, __w: [] }, cctx = ctx;
      current = '-';
      
      // load object returned from initializer into zero-level of context
      var inj = initialize();
      for (var p in inj) save (p, inj[p]);
      
      // find start rule
      if (startRule !== undefined) {
        if (rules[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
      }
      
      // and execute it
      var res;
      try {
        res = rules[startRule]();
        if ((pos < ilen) || 
            (res === null)) failed(EOI, cc());
      } catch(e) {
        if (e instanceof MatchFailed) {
          e.xpos = epos(e.pos);
          e.message = emsg(e);
        }
        throw e;
      }
      
      return res;
    },
    
    /* Returns the parser source code. */
    toSource: function() { return this._source; },
    
    /* makes error type accessible outside */
    MatchFailed: MatchFailed
  };
  
  return result;
})();
