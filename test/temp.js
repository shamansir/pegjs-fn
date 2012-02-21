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
    failures = [], // [],
    ctx = { __p: null,
            __c: null,
            __w: [] }, // {}
    cctx = ctx,
    current = null, // ''
    input = 'bbef',
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
      // (to not override property that was already taken from child)
      // FIXME: make shorter 
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

// =======

var rules = {};
rules.b = function() { current = 'b'; return match('b')(); }
rules.e = function() { current = 'e'; return match('e')(); }
rules.f = function() { current = 'f'; return match('f')(); }

// ========

var EOI = 'end of input';

ref = wrap(inctx); // will call rule inside context

function action(f, code) { // done
  /*din(); f();
  var s = code(lctx());
  dout(); return s;*/
  return inctx(function() {
    f(); return code(lctx());
  });
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
  return save(lbl, f());
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
  return code(lctx())
             ? '' : failed(input[pos], EOI);
}
pre = wrap(pre);

function xpre(code) {
  return code(lctx())
             ? failed(input[pos], EOI) : '';
}
xpre = wrap(xpre);

function and(f) {
  var prev = pos;
  f(); 
  pos = prev;
  return '';
}
and = wrap(and);

function not(f) {
  var prev = pos, missed = 0;
  safe(f, function() {
    missed = 1;
  });
  pos = prev;
  if (missed) return '';
  failed(EOI, input[pos]);
}
not = wrap(not);

function re(rx, desc) {
  var res, desc = desc || rx.source;
  if (res = rx.exec(input.substr(pos))) {
     if (res.index !== 0) failed(desc, input[pos]);
     pos += res[0].length;
     return res[0];
  } else failed(desc, input[pos]);
}
re = wrap(re);

/*function imatch(rx) { === re
  
}
imatch = wrap(imatch);*/

function ch() { // char
  if (pos >= ilen) failed('some char', EOI); 
  return input[pos++];
}
ch = wrap(ch);

function initializer() {
  return {
    'a': 12,
    'b': 14
  };
}

/*safe(function() {
  throw new MatchFailed('haha','woo');
}, function(e) { console.log(e) });*/

__test = function() {
  current = '__test';
  //return seqnc(re(/ab/i),re(/[A-Z]/),ch())();
  return label("d",
      action(
        seqnc(
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
    )();
};

try {
  var inj = initializer();
  for (p in inj) save(p, inj[p]);
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

