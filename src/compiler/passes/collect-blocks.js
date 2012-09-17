/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var curRule = '';
    var blocks = {};

    function nop() {};

    var collect = buildNodeVisitor({

      grammar: function(node) {
        for (var name in node.rules) {
          curRule = name;
          collect(node.rules[name]);
        }

        node.blocks = blocks;
      },

      rule:         collectInExpression,
      choice:       collectInEach('alternatives'),
      sequence:     collectInEach('elements'),
      labeled:      collectInExpression,
      simple_and:   collectInExpression,
      simple_not:   collectInExpression,
      semantic_and: saveBlock,
      semantic_not: saveBlock,
      optional:     collectInExpression,
      zero_or_more: collectInExpression,
      one_or_more:  collectInExpression,
      action:       saveBlock,
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
        node.blockId = '['+curRule+']['+bl+']';
        if (bl == 0) blocks[curRule] = [];
        blocks[curRule].push(node.code);
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