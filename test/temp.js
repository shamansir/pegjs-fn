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
    ctx = { __p: null }, // {}
    cctx = ctx,
    _g = this,
    current = null, // ''
    input = 'abb',
    ilen = input.length;

function each(x, f) {
  for (p in x) {
    if (x.hasOwnProperty(p)) {
      f(p, x[p]);
    }
  }
}

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
    } else {
      throw e;
    }
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

function exec(f) {
  return f(); // just call f in code?
}

function ctx_in() {
  var inner = {};
  inner.__p = cctx;
  cctx = inner; 
}
function ctx_out() {
  each(cctx, function(prop) {
    delete _g[prop];  // make undefined?
  });
  cctx = cctx.__p;
  var p = cctx;
  var apply = function(prop, val) {
    _g[prop] = val;
  };
  while (p) {
    each(p, apply);
    p = p.__p;
  }
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
  f(); return code();
}
action = wrap(action);

function seqnc(/*f...*/) { // done
  var fs = arguments,
      s = [];
  for (var fi = 0; fi < fs.length; fi++) {
    s.push(fs[fi]());  
  }
  return s;
}
seqnc = wrap(seqnc);

function choise(/*f...*/) { // done
  var fs = arguments,
      missed = 0,
      my_e = null;
  for (var fi = 0; fi < fs.length; fi++) {
    var res = safe(fs[fi], function(e) {
      my_e = e;
      missed = 1;
    });
    if (!missed) return res; // [res] ?
    missed = 0;
  }
  throw my_e; // FIXME: failures are wrong
}
choise = wrap(choise);

function match(str) { // done
  var slen = str.length;
  if ((pos + slen) > ilen) {
    failed(str, EOI);
  }
  var found = '';
  if ((found = input.substr(pos, slen)) === str) {
    pos += slen;
    return str;
  }
  failed(str, found);
}
match = wrap(match);

function label(lbl, f) {
  console.log('label', lbl);
}
label = wrap(label);

function some(f) { // done
  // FIXME: requires to enable `any` when `some` used
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

/*safe(function() {
  throw new MatchFailed('haha','woo');
}, function(e) { console.log(e) });*/

__test = function() {
  current = '__test';
  return exec(action(choise(match('ab'),
                            some(match('bc')),
                            some(match('a'))
                           ), function() { return 42; }));
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

