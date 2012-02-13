// the same as at http://jsfiddle.net/shaman_sir/FQVeb/...

var ctx = {};

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
      ctx = [], // []
      _g = this,
      current = null, // ''
      input = 'abbcbc',
      ilen = input.length;
      result = null;

function MatchFailed(what, expected, found) {
  this.what = what;
  this.expected = expected;
  this.found = found;
}
MatchFailed.prototype = new Error();

function failed(expected, found) {
  failures.push(expected); // TODO: ensure if actual failures pushed
  throw new MatchFailed(current, expected, found);
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
  return f();
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

function action(f, code) {
  console.log('action');
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

function choise(/*f...*/) {
  console.log('choise');
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
      failed = 0;
  while (!failed) {
    s.push(safe(f, function() {
      failed = 1;
    }));
  }
  if (failed) s.splice(-1);
  return s;
}
any = wrap(any);

/*safe(function() {
  throw new MatchFailed('haha','woo');
}, function(e) { console.log(e) });*/

  __test = function() {
    current = '__test';
    return exec(seqnc(match('ab'),
                      some(match('bc'))));
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
  console.log(__test());
  console.log(ctx);
} catch(e) {
  if (e instanceof MatchFailed) {
    console.log('Error:',e,
                'Failures:',failures);
  }
}

