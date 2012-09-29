/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var curRule = '';
    var blocks = {};

    function nop() {};

    var at_level = -1,
        positions = [],
        labels = [];
        requesters = {};

    function resetAnd(f) {
      return function(node) {
        console.log(':: reset');
        labels = [];
        positions = [];
        requesters = {};
        at_level = 0;
        f(node);
      }
    }

    function dive_in() {
      console.log('diving in, before: ', at_level, labels, positions);
      at_level++;
      positions.push(labels.length);
      requesters[at_level] = [];
      console.log('diving in, after: ', at_level, labels, positions);
    };

    function dive_out() {
      console.log('diving out, before: ', at_level, labels, positions);
      var cur_rqs = requesters[at_level];
      console.log('passing labels to requesters', cur_rqs.length);
      for (var ri = 0, rl = cur_rqs.length; ri < rl; ri++) {
        cur_rqs[ri](labels);
      }
      labels = labels.splice(0, positions.pop());
      delete requesters[at_level];
      at_level--;
      console.log('diving out, after: ', at_level, labels, positions);
    }

    function in_scope(/*f...*/) {
      var fs = arguments;
      return function(node) {
        console.log('>', node.type/*, node*/);
        dive_in();
        for (var fi = 0, fl = fs.length;
             fi < fl; fi++) { fs[fi](node); }
        dive_out();
        console.log('<', node.type/*, node*/);
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
      choice:       function(node) {
                      each(node['alternatives'], in_scope(collect));
                    },
      sequence:     in_scope(collectInEach('elements')),
      labeled:      function(node) {
                      console.log('saving label', at_level, node.label);
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
      action:       in_scope(saveBlock, collectInExpression),
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
        var block = {
          params: '',
          code: node.code };
        requesters[at_level].push(function(labels) {
          console.log('saving block: ', {
            params: labels.join(','),
            code: node.code });
          block.params = 'labels';
        });
        blocks[curRule].push(block);
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