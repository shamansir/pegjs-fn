/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var blocks = {},
        curRule = '';

    var diver = (function() {

      // TODO: use bitshifting to save current position?
      var at_level,
          at_unit,
          at_pos;

      var labels;

      var sorted;

      function logSorted(sorted) {

      };

      return {

        skipDive: false,

        get_pos: function() {
          return [ at_level, at_unit[at_level], at_pos[at_level][at_unit[at_level]] ];
        },

        reset: function() {
          console.log('x resetting');
          at_level = -1;
          at_pos = [];
          at_unit = [];
          labels = {};
          sorted = [];
        },

        next_pos: function() { at_pos[at_level][at_unit[at_level]]++;
                               return this.get_pos(); },

        step: function(node) {
          node._pos = diver.next_pos();
          console.log('+ step at ', node, '; pos is ', node._pos);
        },

        step_back: function() { at_pos[at_level][at_unit[at_level]]--;
                                console.log('* stepping back to ', this.get_pos());
                                return this.get_pos(); },

        level_in: function(node) {
          if (this.skipDive) {
            console.log('* skipping diving in at ', node);
            node.__skipFlag = true;
            this.skipDive = false;
            return;
          }
          at_level++;
          if (typeof at_unit[at_level] == 'undefined') { at_unit[at_level] = -1; }
          at_unit[at_level]++;
          if (typeof at_pos[at_level] == 'undefined') { at_pos[at_level] = []; }
          at_pos[at_level][at_unit[at_level]] = -1;
          console.log('> diving in at ', node, '; pos is ', this.get_pos());
        },

        level_out: function(node) {
          if (node.__skipFlag) {
            console.log('* skipping diving out at ', node);
            delete node.__skipFlag;
            this.step(node);
            return;
          }
          at_level--;
          this.step(node);
          console.log('< diving out at ', node,
                      '; pos is ', node._pos);
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
          var cur_unit = at_unit[at_level],
              cur_pos = at_pos[at_level][cur_unit];
          if (!labels[at_level]) labels[at_level] = {};
          if (!labels[at_level][cur_unit]) labels[at_level][cur_unit] = {};
          labels[at_level][cur_unit][cur_pos] = label;
          console.log('% saved label \'', label, '\' to level:unit:pos ',
                      at_level + ':' + cur_unit + ':' + cur_pos);
        },

        finish: function(rule) {

        }

      }
    })();

    function skipDiveIfSequence(expression) {
      if (expression.type == 'sequence') diver.skipDive = true;
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
      named:        function(node) { collect(node.expression);
                                     diver.step(node); },
      choice:       function(node) { each(node.alternatives,
                                        function(node) { collect(node);
                                                         diver.step_back(); });
                                     diver.step(node); },
      sequence:     function(node) { diver.level_in(node);
                                     each(node.elements, collect);
                                     diver.level_out(node); },
      labeled:      function(node) { diver.step(node);
                                     diver.save_label(node.label);
                                     collect(node.expression); },
      simple_and:   function(node) { collect(node.expression);
                                     diver.step(node); },
      simple_not:   function(node) { collect(node.expression);
                                     diver.step(node); },
      semantic_and: function(node) { diver.save_block(node);
                                     diver.step(node); },
      semantic_not: function(node) { diver.save_block(node);
                                     diver.step(node); },
      optional:     function(node) { collect(node.expression);
                                     diver.step(node); },
      zero_or_more: function(node) { collect(node.expression);
                                     diver.step(node); },
      one_or_more:  function(node) { collect(node.expression);
                                     diver.step(node); },
      action:       function(node) { console.log('\\ enter action', node);
                                     diver.level_in(node);
                                     skipDiveIfSequence(node.expression);
                                     collect(node.expression);
                                     diver.save_block(node);
                                     diver.level_out(node);
                                     diver.step(node); },
      rule_ref:     function(node) { diver.step(node); },
      literal:      function(node) { diver.step(node); },
      any:          function(node) { diver.step(node); },
      "class":      function(node) { diver.step(node); }

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