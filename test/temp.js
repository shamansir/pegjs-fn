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
      input = 'aaaaa',
      ilen = input.length;
      result = null;

function MatchFailed(what, expected) {
  this.what = what;
  this.expected = expected;
}
MatchFailed.prototype = new Error();

function failed(expected) {
  failures.push(expected);
  throw new MatchFailed(current, expected);
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
  result = f();
}

// =======

var rules = {};
rules.b = function() { current = 'b'; console.log('rules.b') }
rules.e = function() { current = 'e'; console.log('rules.e') }
rules.f = function() { current = 'f'; console.log('rules.f') }

// ========

function ref(rule) { return rule(); }
ref = wrap(ref);

function action(f, code) {
  console.log('action');
}
action = wrap(action);

function sequence(/*function...*/) {
  console.log('sequence');
}
sequence = wrap(sequence);

function choise(/*function...*/) {
  console.log('choise');
}
choise = wrap(choise);

function match(str) {
  var slen = str.length;
  if ((pos + slen) > ilen) {
    failed(str);
  }
  if (input.substr(pos, slen) === str) {
    pos += slen;
    return str;
  }
  failed(str);
}
match = wrap(match);

function label(lbl, f) {
  console.log('label', lbl);
}
label = wrap(label);

function some(f) {
  var s = [];
  s.push(f());
  var failed = 0;
  while (!failed) {
    s.push(safe(f, function() {
      failed = 1;
    }));
  }
  if (failed) s.splice(-1);
  return s;
}
some = wrap(some);

/*safe(function() {
  throw new MatchFailed('haha','woo');
}, function(e) { console.log(e) });*/

  __test = function() {
    exec(some(match('a')));
    console.log(result);
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

__test();

