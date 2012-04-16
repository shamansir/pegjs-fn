var qt = require('./quick-test.parser');

try {
	console.log('parsed:', qt.parse('oooojqmeeyyeye'));
} catch(e) {
	if (e instanceof qt.MatchFailed) {
		console.log(e.message, '[got '+e.xpos[0]+':'+e.xpos[1]+']');
	} else { throw e; }
}