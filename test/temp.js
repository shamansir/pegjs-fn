// the same as at http://jsfiddle.net/shaman_sir/FQVeb/...

/* function(f) {
  return function() {
    var d = arguments;
    return function() {
      return f.apply(null, d);
    }
  }
} */

var pos = 0, // 0
    failures = [], // {}
    deep = 0, // 1
    ctx = { __p: null,
            __c: null,
            __w: [] }, // {}
    cctx = ctx,
    _g = this,
    current = null, // ''
    input = 'abbcbca',
    ilen = input.length;

function MatchFailed(what, found) {
  this.what = what;
  this.found = found;
}
MatchFailed.prototype = new Error();

function failed(expected, found) {
  failures.push(expected); // TODO: ensure if actual failures pushed
  throw new MatchFailed(current, found);
}
function safe(f, callback) {
  try {
    return f();
  } catch(e) {
    if (e instanceof MatchFailed) {
      if (callback) callback(e);
    } else { throw e; }
  }
}

function bind(f, args) {
  return function() {
      return f.apply(null, args);
  };
}
function wrap(f) {
  return function() {
    return bind(f, arguments);
  }
}

/* function exec(f) {
  return f(); // just call f in code?
} */

// TODO: check context <-> initializer and rules <-> labels context

function din() { // dive in
  /*if (!cctx) { cctx = ctx; return; }*/ // first level is for initializer
  if (cctx.__c) { cctx = cctx.__c; return; }
  var inner = { __p: cctx, 
                __c: null, __w: [] };
  cctx.__c = inner;
  cctx = inner; 
}
function dout() { // dive out
  cctx = cctx.__p;
}
function lctx() { // load context
  var t = cctx;
  if (!t.__p) return t;
  var res = {}, w, p;
  while (t) {
    w = t.__w;
    for (var i = w.length; i--;) {
      p = w[i]; res[p] = t[p];
    }
    t = t.__p;
  }
  return res;
}

// =======

var rules = {};
rules.b = function() { current = 'b'; console.log('rules.b') }
rules.e = function() { current = 'e'; console.log('rules.e') }
rules.f = function() { current = 'f'; console.log('rules.f') }

// ========

var EOI = 'end of input';

function ref(rule) { return rule(); }
ref = wrap(ref);

function action(f, code) { // done
  din(); f();
  var s = code(lctx());
  dout(); return s;
}
action = wrap(action);

function seqnc(/*f...*/) { // done
  var fs = arguments,
      s = [];
  for (var fi = 0, fl = fs.length; 
       fi < fl; fi++) {
    s.push(fs[fi]());  
  }
  return s;
}
seqnc = wrap(seqnc);

function choise(/*f...*/) { // done
  var fs = arguments,
      missed = 0,
      my_e = null;
  for (var fi = 0, fl = fs.length; 
       fi < fl; fi++) {
    var res = safe(fs[fi], function(e) {
      my_e = e;
      missed = 1;
    });
    if (!missed) return res;
    missed = 0;
  }
  throw my_e;
}
choise = wrap(choise);

function match(str) { // done
  var slen = str.length;
  if ((pos + slen) > ilen) {
    failed(str, EOI); // exits
  }
  if (input.substr(pos, slen) === str) {
    pos += slen;
    return str;
  }
  failed(str, input[pos]);
}
match = wrap(match);

function label(lbl, f) {
  cctx[lbl] = f();
  cctx.__w.push(lbl);
}
label = wrap(label);

function some(f) { // done
  // NB: requires to enable `any` when `some` used
  return [f()].concat(any(f)());
}
some = wrap(some);

function any(f) { // done
  var s = [],
      missed = 0;
  while (!missed) {
    s.push(safe(f, function() {
      missed = 1;
    }));
  }
  if (missed) s.splice(-1);
  return s;
}
any = wrap(any);

function pre(code) {
  /*return code(lctx())
             ? '' : failed(input[pos], EOI);*/
}
pre = wrap(pre);

function xpre(code) {
  
}
xpre = wrap(xpre);

function and(f) {
  
}
and = wrap(and);

function not(f) {
  
}
not = wrap(not);

function re(rx, desc) {
  
}
re = wrap(re);

function imatch(rx) {
  
}
imatch = wrap(imatch);

function ch() { // char
  
}
ch = wrap(ch);

/*safe(function() {
  throw new MatchFailed('haha','woo');
}, function(e) { console.log(e) });*/

__test = function() {
  current = '__test';
  return action(seqnc(match('ab'),
                      label('b',
                          action(seqnc(some(match('bc')),
                                       some(match('a'))),
                                 function() { return 'foo'; }))
                     ), function(x) { console.log(x); return x.b; })();
  /*exec(
    label("d",
      action(
        sequence(
          some(
            ref(rules.b)
          ),
          ref(rules.e),
          ref(rules.f)
        ),
        function() {
           return "aa";
        }
      )
    )
  );*/
};

try {
  var res = __test();
  console.log('pos',pos,'len',ilen);
  if (pos < ilen) failed(EOI, input.charAt(pos));
  console.log(res);
  /*input = 'a';
  console.log(exec(some(match('b'))));*/
  console.log(ctx);
} catch(e) {
  if (e instanceof MatchFailed) {
    console.log('Error:',e,
                'Failures:',failures);
  }
}

