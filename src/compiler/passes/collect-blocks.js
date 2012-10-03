/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var blocks = {},
        curRule = '';

    var diver = (function() {
      var at_level = -1,
          at_pos = -1;

      var prev_pos = at_pos;

      var labels = {};

      return {
        skipDive: false,
        reset: function() {
          at_level = -1;
          at_pos = -1;
          prev_pos = at_pos;
          labels = {};
        },
        next_pos: function() { at_pos++;
                               return this.get_pos(); }
        step_back: function() { at_pos--; }
        level_in: function() {
          if (this.skipDive) {
            this.skipDive = false;
            return;
          }
          at_level++;
          prev_pos = at_pos;
          at_pos = 0;
        },
        level_out: function() {
          at_level--;
          at_pos = prev_pos;
        },
        get_pos: function() {
          return [ at_level, at_pos ];
        },
        save_block: function(node) {
          var bl = blocks[curRule]
                   ? blocks[curRule].length : 0;

          node.blockAddr = { rule: curRule,
                             id: bl };
          var block = { params: labels.join(','),
                        code: node.code }

          if (bl === 0) blocks[curRule] = [];
          blocks[curRule].push(block);
        },
        save_label: function(label) {
          if (!labels[at_level]) labels[at_level] = {};
          labels[at_level][at_pos] = label;
        },
        finish: function() {

        }
      }
    }();

    var compute = buildNodeVisitor({
      grammar: function(node) {
        each(node.rules, function(rule) {
          curRule = rule.name;
          diver.reset();
          collect(rule);
          diver.finish();
        });

        node.blocks = blocks;
      },

      rule:         function(node) { diver.level_in();
                                     compute(node.expression);
                                     diver.level_out(); },
      named:        function(node) { node._pos = diver.next_pos();
                                     compute(node.expression); },
      choice:       function(node) { node._pos = diver.next_pos();
                                     each(node.alternatives,
                                        function(node) { compute(node);
                                                         diver.step_back(); } ),
      sequence:     function(node) { node._pos = diver.next_pos();
                                     each(node.elements, compute); },
      labeled:      function(node) { node._pos = diver.next_pos();
                                     diver.save_label(node.label); },
      simple_and:   function(node) { compute(node.expression); },
      simple_not:   function(node) { compute(node.expression); },
      semantic_and: function(node) {},
      semantic_not: function(node) {},
      optional:     function(node) { compute(node.expression); },
      zero_or_more: function(node) { compute(node.expression); },
      one_or_more:  function(node) { compute(node.expression); },,
      action:       function(node) { if (node.expression.type == 'sequence')
                                       { diver.skipDive = true; }
                                     compute(node.expression); },,
      rule_ref:     function(node) {},
      literal:      function(node) {},
      any:          function(node) {},
      "class":      function(node) {}

    });

};
// PEG.compiler.passes.collectBlocks = function(ast) {

//     var curRule = '';
//     var blocks = {};

//     function nop() {};

//     var at_level = -1,
//         positions = [],
//         labels = [];
//     var skipDive = false;

//     function resetAnd(f) {
//       return function(node) {
//         console.log(':: reset');
//         labels = [];
//         positions = [];
//         at_level = 0;
//         f(node);
//       }
//     }

//     function dive_in() {
//       console.log('diving in, before: ', at_level, labels, positions);
//       at_level++;
//       positions.push(labels.length);
//       console.log('diving in, after: ', at_level, labels, positions);
//     };

//     function dive_out() {
//       console.log('diving out, before: ', at_level, labels, positions);
//       /*var cur_rqs = requesters[at_level];
//       if (cur_rqs.length) console.log('passing labels to requesters -> ', cur_rqs.length);
//       for (var ri = 0, rl = cur_rqs.length; ri < rl; ri++) {
//         cur_rqs[ri](labels);
//       }*/
//       labels = labels.splice(0, positions.pop());
//       //delete requesters[at_level];
//       at_level--;
//       console.log('diving out, after: ', at_level, labels, positions);
//     }

//     function in_scope(/*f...*/) {
//       var fs = arguments;
//       return function(node) {
//         if (skipDive) { skipDive = false;
//                         each(fs, function(f) { f(node); });
//                         return; }

//         console.log('>', node.type/*, node*/);
//         dive_in();
//         each(fs, function(f) { f(node); });
//         dive_out();
//         console.log('<', node.type/*, node*/);
//       }
//     }

//     var collect = buildNodeVisitor({

//       grammar: function(node) {
//         each(node.rules, function(rule) {
//           curRule = rule.name;
//           collect(rule);
//         });

//         node.blocks = blocks;
//       },

//       rule:         resetAnd(collectInExpression),
//       choice:       function(node) {
//                       each(node['alternatives'], in_scope(collect));
//                     },
//       sequence:     in_scope(collectInEach('elements')),
//       labeled:      function(node) {
//                       console.log('saving label', at_level, node.label);
//                       labels.push(node.label);
//                       collectInExpression(node);
//                     },
//       simple_and:   collectInExpression,
//       simple_not:   collectInExpression,
//       semantic_and: saveBlock,
//       semantic_not: saveBlock,
//       optional:     collectInExpression,
//       zero_or_more: collectInExpression,
//       one_or_more:  collectInExpression,
//       action:       in_scope(saveBlock, collectInExpression),
//       rule_ref:     nop,
//       literal:      nop,
//       any:          nop,
//       "class":      nop

//     });

//     collect(ast);

//     // UTILS

//     function saveBlock(node) {
//         var bl = blocks[curRule]
//                ? blocks[curRule].length : 0;

//         node.blockAddr = { rule: curRule,
//                            id: bl };
//         var block = { params: '',
//                       code: node.code };

//         if (node.expression && (node.expression.type === 'sequence')) {
//           skipDive = true;
//         }

//         console.log('saving block: ', {
//             params: labels.join(','),
//             code: node.code });
//         /*requesters[at_level].push(function(labels) {
//           console.log('saving block: ', {
//             params: labels.join(','),
//             code: node.code });
//           block.params = 'labels';
//         });*/

//         if (bl === 0) blocks[curRule] = [];
//         blocks[curRule].push(block);
//     }

//     function collectInExpression(node) {
//         collect(node.expression);
//     }

//     function collectInEach(prop) {
//         return function(node) {
//             each(node[prop], collect);
//         }
//     }

// };