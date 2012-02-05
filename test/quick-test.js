var qt = require('./quick-test.parser');

try {
	qt.parse('jqmeeyyeye');
} catch(e) {
	if (e instanceof qt.SyntaxError) {
		console.log(e.message, '(at '+e.line+':'+e.column+')');
	}
}