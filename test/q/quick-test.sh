jake build
pegjs ./test/q/quick-test.pegjs ./test/q/quick-test.parser.js
cd ./test/q
node ./quick-test.js
cd ../..
jasmine-node .
