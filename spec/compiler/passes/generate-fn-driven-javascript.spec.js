/* describe("context levels", function() {

  it("wraps every action in context", function() {
    var parser = PEG.buildParser([
          //          b    (              (                     d   c   )          a  dc   a   b   )    c     f    (                   z   )          z   f   c   b adcab
          'start = a:"b" b:(a:"a" b:"b" c:(a:"c" c:"d" { return c + a; }) { return a + c + a + b; }) c:"c" d:"f" e:(d:"ez" { return d[1]; }) { return e + d + c + a + b; }'
        ].join("\n"), options);

    expect(parser).toParse("babcdcfez", "zfcbadcab");
  });

  it("wraps every rule reference in context", function() {
    this.fail("NI");
  });

  it("wraps every choise in context", function() {
    this.fail("NI");
  });

  // TODO: use collect-blocks as a reference for tests where nesting required

}); */