/* Collect all the code blocks and parameters they require.

   Since passing named parameters is nearly impossible in JS (the are several solutions,
   but they hardly affect the speed, which will not work in our case) — we need
   to collect names of the parameters (labels) to integrate in the code blocks.
   They depend on the order of nodes and nesting, so we create a tree structure
   of every rule among with collecting code blocks and when we get the complete
   structure, we pass them in. In fact, this tree is somewhat very similar in inner structure
   to contexts maps we get in generate-code pass (except actual values, of course, and
   the fact that while generating code we go inside context following the
   rule-reference), but since I want generated code to stay relatively easy-readible
   (and easy-changeble), I descided to keep contexts in generated parsers instead of
   thinking on how to give this pre-built tree to the parser. May be this solution
   will be required to change, anyway, I take the risk again. */
PEG.compiler.passes.collectBlocks = function(ast) {

    var blocks = {},
        curRule = '';

    var diver = (function() {

      function DNode(level, node, parent) {
        this.level = level;
        this.node = node;
        this.parent = parent;
        this.inspect = function() {
          var pad = '    ';
          return '\n' + pad + '{ ' + this.level + '\n' + pad +
               '>--(' + this.node.inspect() + ')--<\n' + pad +
               '   ^' + (this.parent ? this.parent.node.inspect() : '[none]') + '^\n' + pad +
               '  <<' + (this.prev ? this.prev.node.inspect() : '[none]') + '\n' + pad +

               '    ' + (this.next ? this.next.node.inspect() : '[none]') + '>> }';
        }
      }

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
          console.log('--------------------------/', rule, '\\--------------------------');
          this._reset();
          level = 0;
          root = new DNode(level, node); // { node: node, level: level };
          cur = root;
          console.log('* root is', node);
        },

        step: function(node) {
          cur.next = new DNode(level, node, parent);
            // { node: node, level: level,
            //           parent: parent };
          cur.next.prev = cur;
          cur = cur.next;
          console.log('* step forward with', node, 'cur is', cur.inspect());
        },

        /* step_back: function() { cur = cur.prev;
                                console.log('* stepping back to ', cur.node); }, */

        level_in: function(node) {
          level++;
          parent = new DNode(level, node, parent);
          console.log('> diving in at', node, 'new level is', level, 'cur is', cur.inspect());
        },

        level_out: function(node) {
          level--;
          cur.next = parent;
          cur.next.prev = cur;
          cur = cur.next;
          parent = cur ? cur.parent : null;
          console.log('< diving out at', node, 'cur is ', cur.inspect());
        },

        save_block: function(rule) {
          var node = cur.node;
          var rule = rule || curRule;
          var bl = blocks[rule]
                   ? blocks[rule].length : 0;

          node.blockAddr = { rule: rule,
                             id: bl };
          var block = { params: [],
                        code: node.code };

          if (bl === 0) blocks[rule] = [];
          blocks[rule].push(block);
          _blocks.push(cur);
          //console.log(node, '-->', block);
        },

        save_label: function(label) {
          if (!_labels[label]) _labels[label] = [];
          _labels[label].push(/*{ node: node } || */cur);
          console.log('% saved label', '\'' + label + '\'', 'as', cur.node);
        },

        finish: function(rule) {
          console.log(':::::::::::::::::::::::::::::::::::::::::::::::::::::>>');
          var path = [ 0 ],
              level = 0;
          var p = root;
          while (p) {
            level = p.level;
            if (!path[level]) path[level] = 0;
            //console.log(p);
            console.log(level, path.slice(0,level+1).join(':'), p.node, p.parent ? p.parent.node : '-',
                                                                p.next, p.next   ? p.next.node   : '-');
            path[level]++;
            p = p.next;
          }
          //console.log('labels', labels);
          //console.log('blocks', blocks);
          console.log('=====================================================>>');
          for (var label in _labels) {
            var l_nodes = _labels[label],
                count = l_nodes.length;
            while(count--) {
              this._matchLabelToBlocks(rule, label, l_nodes[count], _blocks);
            }
          }
          console.log('--------------------------\\', rule, '/--------------------------');
        },

        _matchLabelToBlocks: function(rule, label, l_node, blocks) {
          console.log('analysing', l_node.node);
          var l_level = l_node.level;
          var wrap_block;
          // if label node is wrapped in some block-having node,
          // than this block has access to this label, save it as its parameter
          if (wrap_block = this._hasWrappingBlock(l_node)) {
            console.log(':: has a wrapper', wrap_block.node);
            this._addCodeBlockParam(rule, wrap_block, label);
          }
          // if there are next blocks on the same level or below, they
          // also have access to this label
          var n = l_node.next;
          while (n) {
            console.log(':: checking', n.node, l_level, n.level, n.level >= l_level);
            if ((n.level >= l_level) && this._hasCodeBlock(n)) {
              this._addCodeBlockParam(rule, n, label);
            }
            n = n.next;
          }
        },

        _hasCodeBlock: function(dnode) {
          return dnode.node.blockAddr;
        },

        _addCodeBlockParam: function(rule, dnode, param) {
          blocks[rule][dnode.node.blockAddr.id].params.push(param);
          console.log('::', rule, '} adding param <', param, '> to a block: <',
                      blocks[rule][dnode.node.blockAddr.id], '>');
        },

        _hasWrappingBlock: function(dnode) {
          if (dnode.parent && this._hasCodeBlock(dnode.parent)) return dnode.parent;
          if (dnode.parent && dnode.parent.parent &&
              (dnode.parent.node.type === 'sequence') &&
              this._hasCodeBlock(dnode.parent.parent)) return dnode.parent.parent;
          return null;
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
      named:        function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      choice:       function(node) { diver.level_in(node);
                                     each(node.alternatives,
                                        function(node) { collect(node);
                                                         /*diver.step_back();*/ });
                                     diver.level_out(node); },
      sequence:     function(node) { diver.level_in(node);
                                     each(node.elements, collect);
                                     diver.level_out(node); },
      labeled:      function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node);
                                     diver.save_label(node.label); },
      simple_and:   function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      simple_not:   function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      semantic_and: function(node) { diver.step(node);
                                     diver.save_block(); },
      semantic_not: function(node) { diver.step(node);
                                     diver.save_block(); },
      optional:     function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      zero_or_more: function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      one_or_more:  function(node) { diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node); },
      action:       function(node) { console.log('\\ enter action', node);
                                     diver.level_in(node);
                                     collect(node.expression);
                                     diver.level_out(node);
                                     diver.save_block(); },
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