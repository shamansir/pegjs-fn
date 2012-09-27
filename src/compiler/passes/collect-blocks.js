/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var curRule = '';
    var blocks = {};

    function nop() {};

    var at_level = -1,
        positions = [],
        labels = [];

    function resetAnd(f) {
      return function(node) {
        labels = [];
        positions = [];
        at_level = 0;
        f(node);
      }
    }

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

      grammar: function(node) {
        each(node.rules, function(rule) {
          curRule = rule.name;
          collect(rule);
        });

        node.blocks = blocks;
      },

      rule:         resetAnd(collectInExpression),
      choice:       in_scope(collectInEach('alternatives')),
      sequence:     in_scope(collectInEach('elements')),
      labeled:      function(node) {
                      labels.push(node.label);
                      collectInExpression(node);
                    },
      simple_and:   collectInExpression,
      simple_not:   collectInExpression,
      semantic_and: saveBlock,
      semantic_not: saveBlock,
      optional:     collectInExpression,
      zero_or_more: collectInExpression,
      one_or_more:  collectInExpression,
      action:       in_scope(saveBlock),
      rule_ref:     nop,
      literal:      nop,
      any:          nop,
      "class":      nop

    });

    collect(ast);

    // UTILS

    function saveBlock(node) {
        var bl = blocks[curRule]
               ? blocks[curRule].length : 0;
        node.blockAddr = {
                rule: curRule,
                id: bl };
        if (bl === 0) blocks[curRule] = [];
        blocks[curRule].push({
          params: labels.join(','),
          code: node.code });
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