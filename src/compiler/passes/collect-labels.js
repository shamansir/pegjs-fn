/*
 * This pass is similar to the original allocate-registers pass that, among
 * with params data, was intended to save registers data, but improved version
 * version of the parser does not require registers (at leas, now)
 */
PEG.compiler.passes.collectLabels = function(ast) {

    function nop() {};

    var at_level = -1,
        positions = [],
        labels = [];

    function dive_in() {
      at_level++;
      positions.push(labels.length - 1);
    };

    function dive_out() {
      labels = labels.splice(positions.pop());
      at_level--;
    }

    function in_scope(f) {
      return function(node) {
        dive_in();
        f(node);
        dive_out();
      }
    }

    var collect = buildNodeVisitor({

      grammar:      collectInEach('rules'),
      rule:         in_scope(collectInExpression),
      choice:       collectInEach('alternatives'),
      sequence:     in_scope(collectInEach('elements')),
      labeled:      function(node) {
                      labels.push(node.label);
                      in_scope(collectInExpression);
                    },
      simple_and:   collectInExpression,
      simple_not:   collectInExpression,
      semantic_and: saveLabels,
      semantic_not: saveLabels,
      optional:     collectInExpression,
      zero_or_more: collectInExpression,
      one_or_more:  collectInExpression,
      action:       saveLabels,
      rule_ref:     nop,
      literal:      nop,
      any:          nop,
      "class":      nop

    });

    collect(ast);

    // UTILS

    function saveLabels(node) {
      node.labels = labels;
    }

    function collectInExpression(node) {
      collect(node.expression);
    }

    function collectInEach(prop) {
      return function(node) {
        each(node[prop], collect);
      }
    }

};