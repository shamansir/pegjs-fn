/* Collect all the functional blocks. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var blocks = {},
        curRule = '';

    var diver = (function() {

      var root = null,
          cur = null,
          parent = null,
          level = -1;

      var parent;

      var _labels,
          _blocks;

      return {

        _reset: function() {
          console.log('x resetting');
          root = null;
          cur = null;
          parent = null;
          level = -1;
          _labels = {};
          _blocks = [];
        },

        start: function(rule, node) {
          this._reset();
          level = 0;
          root = { node: node, level: level };
          cur = root;
          console.log('* root is ', node);
        },

        step: function(node) {
          cur.next = { node: node, level: level };
          cur.next.prev = cur;
          if (parent) cur.parent = parent;
          cur = cur.next;
          console.log('* step forward with ', node);
        },

        /* step_back: function() { cur = cur.prev;
                                console.log('* stepping back to ', cur.node); }, */

        level_in: function(node) {
          this.step(node);
          parent = cur;
          level++;
          console.log('> diving in at ', node, 'level is', level, 'parent is', parent);
        },

        level_out: function(node) {
          parent = parent.parent;
          level--;
          console.log('< diving out at ', node);
        },

        save_block: function() {
          var node = cur.node;
          var rule = rule || curRule;
          var bl = blocks[rule]
                   ? blocks[rule].length : 0;

          node.blockAddr = { rule: rule,
                             id: bl };
          var block = { params: '',
                        code: node.code };

          if (bl === 0) blocks[rule] = [];
          blocks[rule].push(block);
          _blocks.push(cur);
          //console.log(node, '-->', block);
        },

        save_label: function(label) {
          if (!_labels[label]) _labels[label] = [];
          _labels[label].push(/*{ node: node } || */cur);
          console.log('% saved label \'', label, '\' as ', cur.node);
        },

        finish: function(rule) {
          console.log('----------', rule, '----------');
          var path = [ 0 ],
              level = 0;
          var p = root;
          while (p) {
            level = p.level;
            if (!path[level]) path[level] = 0;
            console.log(level, path.slice(0,level+1).join(':'), p.node, p.parent ? p.parent.node : '-');
            path[level]++;
            p = p.next;
          }
          //console.log('labels', labels);
          //console.log('blocks', blocks);
          console.log('===================================');
        }

      }
    })();

    var collect = buildNodeVisitor({

      grammar: function(node) {
        each(node.rules, function(rule) {
          curRule = rule.name;
          collect(rule);
        });

        node.blocks = blocks;
      },

      rule:         function(node) { diver.start(curRule, node);
                                     collect(node.expression);
                                     diver.finish(curRule); },
      named:        function(node) { collect(node.expression);
                                     diver.step(node); },
      choice:       function(node) { each(node.alternatives,
                                        function(node) { collect(node);
                                                         /*diver.step_back();*/ });
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
      semantic_and: function(node) { diver.step(node);
                                     diver.save_block(); },
      semantic_not: function(node) { diver.step(node);
                                     diver.save_block(); },
      optional:     function(node) { collect(node.expression);
                                     diver.step(node); },
      zero_or_more: function(node) { collect(node.expression);
                                     diver.step(node); },
      one_or_more:  function(node) { collect(node.expression);
                                     diver.step(node); },
      action:       function(node) { console.log('\\ enter action', node);
                                     diver.level_in(node);
                                     diver.save_block();
                                     collect(node.expression);
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