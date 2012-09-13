/* Computes how much each rule occurs in parser. */
PEG.compiler.passes.computeOccurences = function(ast) {

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

};