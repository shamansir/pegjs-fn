/* Collect all the functional blocks. */
PEG.compiler.passes.collectContextData = function(ast) {

    function nop() {};

    var level_pos = [];
    var labels = [];

    var collect = buildNodeVisitor({

      grammar: function(node) {
        each(node.rules, function(rule) {

          collect(rule);
        });
      },

      rule:         collectInExpression,
      choice:       collectInEach('alternatives'),
      sequence:     collectInEach('elements'),
      labeled:      function(node) {

                        collectInExpression(node);
                    },
      simple_and:   collectInExpression,
      simple_not:   collectInExpression,
      semantic_and: function(node) {

                    },
      semantic_not: function(node) {

                    },
      optional:     collectInExpression,
      zero_or_more: collectInExpression,
      one_or_more:  collectInExpression,
      action:       function(node) {
                      node.labels
                    },
      rule_ref:     function(node) {

                    },
      literal:      nop,
      any:          nop,
      "class":      nop

    });

    collect(ast);

    // UTILS

    function saveCtxData(node) {

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