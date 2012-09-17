/* Computes how much each rule occurs in parser. */
PEG.compiler.passes.computeOccurences = function(ast) {

    var stats = {};

    // TODO: change nodeVisitor to use switch?
    // also, may be write a walker that smartly walks deep in standard AST tree
    var compute = buildNodeVisitor({
      grammar: function(node) {
        for (var name in node.rules) {
          compute(node.rules[name]);
        }

        node.stats = stats;
      },

      rule:         goDeep,
      named:        addAndGoDeep('named'),
      choice:       addAndGoThrough('choice', 'alternatives'),
      sequence:     addAndGoThrough('sequence', 'elements'),
      labeled:      addAndGoDeep('labeled'),
      simple_and:   addAndGoDeep('simple_and'),
      simple_not:   addAndGoDeep('simple_not'),
      semantic_and: justAdd('semantic_and'),
      semantic_not: justAdd('semantic_not'),
      optional:     addAndGoDeep('optional'),
      zero_or_more: addAndGoDeep('zero_or_more'),
      one_or_more:  addAndGoDeep('one_or_more'),
      action:       addAndGoDeep('action'),
      rule_ref:     justAdd('rule_ref'),
      literal:      function(node) { if (!node.ignoreCase) {
                                       stats.literal = (stats.literal || 0)+1;
                                     } else {
                                       stats.literal_re = (stats.literal_re || 0)+1;
                                     } },
      any:          justAdd('any'),
      "class":      justAdd('klass')

    });

    compute(ast);

    // UTILS

    function goDeep(node) {
        compute(node.expession);
    }

    function justAdd(name) {
        return function(node) {
            stats[name] = (stats[name] || 0)+1;
        }
    }

    function addAndGoDeep(name) {
        return function(node) {
            stats[name] = (stats[name] || 0)+1;
            compute(node.expession);
        }
    }

    function addAndGoThrough(name, prop) {
        return function(node) {
            stats[name] = (stats[name] || 0)+1;
            each(node[prop], compute);
        }
    }

};