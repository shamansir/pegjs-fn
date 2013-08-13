PEG.compiler.passes.prettyPrintNodes = function(ast) {

  var apply = buildNodeVisitor({

    grammar: function(node) {
      each(node.rules, function(rule) {
        apply(rule);
      });

      reportAs(node, 'Grammar');
    },

    // TODO:

    rule:         function(node) { reportAs(node, 'Rule', node.name);
                                   apply(node.expression); },
    named:        function(node) { reportAs(node, 'Named', node.name);
                                   apply(node.expression); },
    choice:       function(node) { reportAs(node, 'Choice',
                                            collectTypes(node.alternatives));
                                   each(node.alternatives, apply); },
    sequence:     function(node) { reportAs(node, 'Sequence',
                                            collectTypes(node.elements));
                                   each(node.elements, apply); },
    labeled:      function(node) { reportAs(node, 'Labeled', node.label);
                                   apply(node.expression); },
    simple_and:   function(node) { reportAs(node, 'And');
                                   apply(node.expression); },
    simple_not:   function(node) { reportAs(node, 'Not');
                                   apply(node.expression); },
    semantic_and: function(node) { reportAs(node, 'SemanticAnd', node.code); },
    semantic_not: function(node) { reportAs(node, 'SemanticNot', node.code); },
    optional:     function(node) { reportAs(node, 'Maybe');
                                   apply(node.expression); },
    zero_or_more: function(node) { reportAs(node, 'ZeroOrMore');
                                   apply(node.expression); },
    one_or_more:  function(node) { reportAs(node, 'OneOrMore');
                                   apply(node.expression); },
    action:       function(node) { reportAs(node, 'Action', node.code);
                                   apply(node.expression); },
    rule_ref:     function(node) { reportAs(node, 'RuleRef', node.name); },
    literal:      function(node) { reportAs(node, 'Literal', node.value); },
    any:          function(node) { reportAs(node, 'Any'); },
    "class":      function(node) { reportAs(node, 'Class'); }

  });

  apply(ast);

  function reportAs(node, type, info) {
    if (!info) {
      node.inspect = function() {
        return '[' + type + ']';
      };
    } else {
      node.inspect = function() {
        return '[' + type + ' /' + (Array.isArray(info)
                                    ? info.join(' ')
                                    : info) + '/]';
      };
    }
  }

  function getType(node) {
    return node.type;
  }

  function collectTypes(nodes) {
    var result = [];
    each(nodes, function(node) { result.push(node.type); });
    return result;
  }

};