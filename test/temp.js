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
      failures = {}, // {}
      deep = 0, // 1
      ctx = [], // []
      _g = this,
      current = null, // ''
      input = 'aaaaa';

function MatchFailed(what, expected) {
  this.what = what;
  this.expected = expected;
}
MatchFailed.prototype = new Error();

function failed(expected) {
  failures.push(what);
  throw new MatchFailed(current, expected);
}
function safe(f, callback) {
  try {
    f();
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
  f();
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
  pos++;
  console.log('match', str);  
}
match = wrap(match);

function label(lbl, f) {
  console.log('label', lbl); 
}
label = wrap(label);

function some(f) {
  console.log('some');
  f();
  var failed = 0;
  while (!failed
         && (pos < input.length)) {
    safe(f, function() {
      console.log('failed');
      failed = 1;
    });
  }
}
some = wrap(some);

/*safe(function() {
  throw new MatchFailed('haha','woo'); 
}, function(e) { console.log(e) });*/

  __test = function() {
    exec(some(match('a')));
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
