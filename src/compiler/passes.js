/*
 * Compiler passes.
 *
 * Each pass is a function that is passed the AST. It can perform checks on it
 * or modify it as needed. If the pass encounters a semantic error, it throws
 * |PEG.GrammarError|.
 */
PEG.compiler.passes = {};

// @include "passes/report-missing-rules.js"
// @include "passes/report-left-recursion.js"
// @include "passes/remove-proxy-rules.js"
// @include "passes/compute-occurences.js"
// @include "passes/collect-blocks.js"
// @include "passes/allocate-registers.js"
// @include "passes/generate-code.js"
