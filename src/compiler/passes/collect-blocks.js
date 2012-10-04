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

        get_pos: function() {
          return [ at_level, at_pos ];
        },

        reset: function() {
          console.log('x resetting');
          at_level = -1;
          at_pos = -1;
          prev_pos = at_pos;
          labels = {};
        },

        next_pos: function() { prev_pos = at_pos;
                               at_pos++;
                               return this.get_pos(); },

        step_back: function() { prev_pos = at_pos;
                                at_pos--;
                                console.log('* stepping back at ',
                                            [ at_level, at_pos ]);
                                return this.get_pos(); },

        level_in: function(node) {
          if (this.skipDive) {
            console.log('* skipping diving in at ', node);
            node.__skipFlag = true;
            this.skipDive = false;
            return;
          }
          at_level++;
          prev_pos = at_pos;
          at_pos = 0;
          node._pos = this.get_pos();
          console.log('> diving in at ', node, '; pos is ', node._pos);
        },

        level_out: function(node) {
          if (node.__skipFlag) {
            console.log('* skipping diving out at ', node);
            delete node.__skipFlag;
            return;
          }
          at_level--;
          at_pos = prev_pos;
          console.log('< diving out at ', node,
                      '; pos is ', [ at_level, at_pos ]);
        },

        save_block: function(node, rule) {
          var rule = rule || curRule;
          var bl = blocks[rule]
                   ? blocks[rule].length : 0;

          node.blockAddr = { rule: rule,
                             id: bl };
          var block = { params: '',
                        code: node.code };

          if (bl === 0) blocks[rule] = [];
          blocks[rule].push(block);

          //console.log(node, '-->', block);
        },

        save_label: function(label) {
          if (!labels[at_level]) labels[at_level] = {};
          labels[at_level][at_pos] = label;
        },

        finish: function(rule) {

        }

      }
    })();

    function skipDiveIfSequence(expression) {
      if (expression.type == 'sequence') diver.skipDive = true;
    }

    function step(node) {
      node._pos = diver.next_pos();
      console.log('+ step at ', node, '; pos is ', node._pos);
    }

    var collect = buildNodeVisitor({

      grammar: function(node) {
        each(node.rules, function(rule) {
          curRule = rule.name;
          diver.reset();
          collect(rule);
          diver.finish(curRule);
        });

        node.blocks = blocks;
      },

      rule:         function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      named:        function(node) { step(node);
                                     collect(node.expression); },
      choice:       function(node) { step(node);
                                     each(node.alternatives,
                                        function(node) { collect(node);
                                                         diver.step_back(); }); },
      sequence:     function(node) { diver.level_in(node);
                                     each(node.elements, collect);
                                     diver.level_out(node); },
      labeled:      function(node) { step(node);
                                     diver.save_label(node.label);
                                     collect(node.expression); },
      simple_and:   function(node) { step(node);
                                     collect(node.expression); },
      simple_not:   function(node) { step(node);
                                     collect(node.expression); },
      semantic_and: function(node) { step(node);
                                     diver.save_block(node); },
      semantic_not: function(node) { step(node);
                                     diver.save_block(node); },
      optional:     function(node) { step(node);
                                     collect(node.expression); },
      zero_or_more: function(node) { step(node);
                                     collect(node.expression); },
      one_or_more:  function(node) { step(node);
                                     collect(node.expression); },
      action:       function(node) { step(node);
                                     skipDiveIfSequence(node.expression);
                                     collect(node.expression);
                                     diver.save_block(node); },
      rule_ref:     function(node) { step(node); },
      literal:      function(node) { step(node); },
      any:          function(node) { step(node); },
      "class":      function(node) { step(node); }

    });

    collect(ast);

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