import Testrunner from "./ATestRunner.js";
const file = "../src/a-code.js";
const lineNumbers = true;
const onlyFailed = true;
const pauseOnFail = true;
const tester = await new Testrunner(file, lineNumbers, onlyFailed, pauseOnFail)
tester.run();
