var qt = require('./quick-test.parser');

try {
	qt.parse('jqmeeyyeye');
} catch(e) {
	if (e instanceof qt.MatchFailed) {
		console.log(e.message, '[got '+e.xpos[0]+':'+e.xpos[1]+']');
	}
}