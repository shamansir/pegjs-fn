{ console.log("initializer");
  return { foo: 11 }; }

start = a* { console.log(ctx.foo); }

a = w m+ (("b" / d:"c") { return ctx.d; })*

w = (c { console.log('test'); })+

c = "a" / "e" / g

g = "oooo"i

m = 'a' n?

n = d:(b+ e f { return "aa"; })

b = "wee"

e = "meeh" one_char f:!one_char

f "foo" = "foo" / &two_strange_chars

one_char = !{ console.log("not predicate"); console.log(ctx.foo); return false; } .

two_strange_chars "tsc" =  &{ console.log("predicate"); return true; } [a-n]i [^A-Z]