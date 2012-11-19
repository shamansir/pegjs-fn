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

      var root = null,
          cur = null,
          parent = null,
          level = -1;

      var parent;

      var _labels,
          _blocks;

      return {

        _reset: function() {
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
          root = { level: level, node: node };
          cur = root;
        },

        step: function(node) {
          cur.next = { level: level, node: node,
                       parent: parent };
          cur.next.prev = cur;
          cur = cur.next;
        },

        /* step_back: function() { cur = cur.prev; }, */

        level_in: function(node) {
          level++;
          parent = { level: level, node: node,
                     parent: parent };
        },

        level_out: function(node) {
          level--;
          cur.next = parent;
          cur.next.prev = cur;
          cur = cur.next;
          parent = cur ? cur.parent : null;
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

          root.node.hasBlocks = true;
        },

        save_label: function(label) {
          if (!_labels[label]) _labels[label] = [];
          _labels[label].push(/*{ node: node } || */cur);
        },

        finish: function(rule) {
          var path = [ 0 ],
              level = 0;
          var p = root;
          while (p) {
            level = p.level;
            if (!path[level]) path[level] = 0;
            path[level]++;
            p = p.next;
          }
          for (var label in _labels) {
            var l_nodes = _labels[label],
                count = l_nodes.length;
            while(count--) {
              this._matchLabelToBlocks(rule, label, l_nodes[count], _blocks);
            }
          }
        },

        _matchLabelToBlocks: function(rule, label, l_node, blocks) {
          var l_level = l_node.level;
          var wrap_block;
          // if label node is wrapped in some block-having node,
          // than this block has access to this label, save it as its parameter
          if (wrap_block = this._hasWrappingBlock(l_node)) {
            this._addCodeBlockParam(rule, wrap_block, label);
          }
          // if there are next blocks on the same level or below, they
          // also have access to this label
          var n = l_node.next;
          while (n) {
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
      action:       function(node) { diver.level_in(node);
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