/*
 * Compiler passes.
 *
 * Each pass is a function that is passed the AST. It can perform checks on it
 * or modify it as needed. If the pass encounters a semantic error, it throws
 * |PEG.GrammarError|.
 */
PEG.compiler.passes = {
  /* Checks that all referenced rules exist. */
  reportMissingRules: function(ast) {
    function nop() {}

    function checkExpression(node) { check(node.expression); }

    function checkSubnodes(propertyName) {
      return function(node) { each(node[propertyName], check); };
    }

    var check = buildNodeVisitor({
      grammar:
        function(node) {
          for (var name in node.rules) {
            check(node.rules[name]);
          }
        },

      rule:         checkExpression,
      choice:       checkSubnodes("alternatives"),
      sequence:     checkSubnodes("elements"),
      labeled:      checkExpression,
      simple_and:   checkExpression,
      simple_not:   checkExpression,
      semantic_and: nop,
      semantic_not: nop,
      optional:     checkExpression,
      zero_or_more: checkExpression,
      one_or_more:  checkExpression,
      action:       checkExpression,

      rule_ref:
        function(node) {
          if (ast.rules[node.name] === undefined) {
            throw new PEG.GrammarError(
              "Referenced rule \"" + node.name + "\" does not exist."
            );
          }
        },

      literal:      nop,
      any:          nop,
      "class":      nop
    });

    check(ast);
  },

  /* Checks that no left recursion is present. */
  reportLeftRecursion: function(ast) {
    function nop() {}

    function checkExpression(node, appliedRules) {
      check(node.expression, appliedRules);
    }

    var check = buildNodeVisitor({
      grammar:
        function(node, appliedRules) {
          for (var name in node.rules) {
            check(node.rules[name], appliedRules);
          }
        },

      rule:
        function(node, appliedRules) {
          check(node.expression, appliedRules.concat(node.name));
        },

      choice:
        function(node, appliedRules) {
          each(node.alternatives, function(alternative) {
            check(alternative, appliedRules);
          });
        },

      sequence:
        function(node, appliedRules) {
          if (node.elements.length > 0) {
            check(node.elements[0], appliedRules);
          }
        },

      labeled:      checkExpression,
      simple_and:   checkExpression,
      simple_not:   checkExpression,
      semantic_and: nop,
      semantic_not: nop,
      optional:     checkExpression,
      zero_or_more: checkExpression,
      one_or_more:  checkExpression,
      action:       checkExpression,

      rule_ref:
        function(node, appliedRules) {
          if (contains(appliedRules, node.name)) {
            throw new PEG.GrammarError(
              "Left recursion detected for rule \"" + node.name + "\"."
            );
          }
          check(ast.rules[node.name], appliedRules);
        },

      literal:      nop,
      any:          nop,
      "class":      nop
    });

    check(ast, []);
  },

  /*
   * Removes proxy rules -- that is, rules that only delegate to other rule.
   */
  removeProxyRules: function(ast) {
    function isProxyRule(node) {
      return node.type === "rule" && node.expression.type === "rule_ref";
    }

    function replaceRuleRefs(ast, from, to) {
      function nop() {}

      function replaceInExpression(node, from, to) {
        replace(node.expression, from, to);
      }

      function replaceInSubnodes(propertyName) {
        return function(node, from, to) {
          each(node[propertyName], function(subnode) {
            replace(subnode, from, to);
          });
        };
      }

      var replace = buildNodeVisitor({
        grammar:
          function(node, from, to) {
            for (var name in node.rules) {
              replace(node.rules[name], from, to);
            }
          },

        rule:         replaceInExpression,
        choice:       replaceInSubnodes("alternatives"),
        sequence:     replaceInSubnodes("elements"),
        labeled:      replaceInExpression,
        simple_and:   replaceInExpression,
        simple_not:   replaceInExpression,
        semantic_and: nop,
        semantic_not: nop,
        optional:     replaceInExpression,
        zero_or_more: replaceInExpression,
        one_or_more:  replaceInExpression,
        action:       replaceInExpression,

        rule_ref:
          function(node, from, to) {
            if (node.name === from) {
              node.name = to;
            }
          },

        literal:      nop,
        any:          nop,
        "class":      nop
      });

      replace(ast, from, to);
    }

    for (var name in ast.rules) {
      if (isProxyRule(ast.rules[name])) {
        replaceRuleRefs(ast, ast.rules[name].name, ast.rules[name].expression.name);
        if (name === ast.startRule) {
          ast.startRule = ast.rules[name].expression.name;
        }
        delete ast.rules[name];
      }
    }
  },

  computeOccurences: function(ast) {

    var stats = {};

    var compute = buildNodeVisitor({
      grammar: function(node) {
        for (var name in node.rules) {
          compute(node.rules[name]);
        }

        node.stats = stats;
      },

      rule: function(node) { compute(node.expression); },

      choice: function(node) {
        stats.choice = (stats.choice || 0)+1;
        each(node.alternatives, compute);
      },

      sequence: function(node) {
        stats.sequence = (stats.sequence || 0)+1;
        each(node.elements, compute);
      },

      labeled:      function(node) { stats.labeled = (stats.labeled || 0)+1;
                                     compute(node.expression); },
      simple_and:   function(node) { stats.simple_and = (stats.simple_and || 0)+1;
                                     compute(node.expression); },
      simple_not:   function(node) { stats.simple_not = (stats.simple_not || 0)+1;
                                     compute(node.expression); },
      semantic_and: function(node) { stats.semantic_and = (stats.semantic_and || 0)+1; },
      semantic_not: function(node) { stats.semantic_not = (stats.semantic_not || 0)+1; },
      optional:     function(node) { stats.optional = (stats.optional || 0)+1;
                                     compute(node.expression); },
      zero_or_more: function(node) { stats.zero_or_more = (stats.zero_or_more || 0)+1;
                                     compute(node.expression); },
      one_or_more:  function(node) { stats.one_or_more = (stats.one_or_more || 0)+1;
                                     compute(node.expression); },
      action:       function(node) { stats.action = (stats.action || 0)+1;
                                     compute(node.expression); },
      rule_ref:     function(node) { stats.rule_ref = (stats.rule_ref || 0)+1; },
      literal:      function(node) { if (!node.ignoreCase) {
                                       stats.literal = (stats.literal || 0)+1;
                                     } else {
                                       stats.literal_re = (stats.literal_re || 0)+1;
                                     } },
      any:          function(node) { stats.any = (stats.any || 0)+1; },
      "class":      function(node) { stats.klass = (stats.klass || 0)+1; }

    });

    compute(ast);

  }  

  // TODO: calculate every node type occurences count

  /*
   * Adds |resultStackDepth| and |posStackDepth| properties to each AST node.
   * These properties specify how many positions on the result or position stack
   * code generated by the emitter for the node will use. This information is
   * used to declare varibles holding the stack data in the generated code.
   */ /*
  computeStackDepths: function(ast) {
    function computeZeroes(node) {
      node.resultStackDepth = 0;
      node.posStackDepth = 0;
    }

    function computeFromExpression(resultStackDelta, posStackDelta) {
      return function(node) {
        compute(node.expression);
        node.resultStackDepth = node.expression.resultStackDepth + resultStackDelta;
        node.posStackDepth    = node.expression.posStackDepth    + posStackDelta;
      };
    }

    var compute = buildNodeVisitor({
      grammar:
        function(node) {
          for (var name in node.rules) {
            compute(node.rules[name]);
          }
        },

      rule:         computeFromExpression(1, 0),

      choice:
        function(node) {
          each(node.alternatives, compute);
          node.resultStackDepth = Math.max.apply(
            null,
            map(node.alternatives, function(e) { return e.resultStackDepth; })
          );
          node.posStackDepth = Math.max.apply(
            null,
            map(node.alternatives, function(e) { return e.posStackDepth; })
          );
        },

      sequence:
        function(node) {
          each(node.elements, compute);
          node.resultStackDepth = node.elements.length > 0
            ? Math.max.apply(
                null,
                map(node.elements, function(e, i) { return i + e.resultStackDepth; })
              )
            : 0;
          node.posStackDepth = node.elements.length > 0
            ? 1 + Math.max.apply(
                null,
                map(node.elements, function(e) { return e.posStackDepth; })
              )
            : 1;
        },

      labeled:      computeFromExpression(0, 0),
      simple_and:   computeFromExpression(0, 1),
      simple_not:   computeFromExpression(0, 1),
      semantic_and: computeZeroes,
      semantic_not: computeZeroes,
      optional:     computeFromExpression(0, 0),
      zero_or_more: computeFromExpression(1, 0),
      one_or_more:  computeFromExpression(1, 0),
      action:       computeFromExpression(0, 1),
      rule_ref:     computeZeroes,
      literal:      computeZeroes,
      any:          computeZeroes,
      "class":      computeZeroes
    });

    compute(ast);
  } */
};
