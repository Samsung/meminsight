/*
 * Copyright (c) 2014 Samsung Electronics Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/// <reference path="../lib/ts-declarations/node.d.ts" />
/// <reference path="../lib/ts-declarations/mocha.d.ts" />
/// <reference path="../lib/ts-declarations/jalangi.d.ts" />
/// <reference path="../lib/ts-declarations/Q.d.ts" />

/**
 * Created by m.sridharan on 6/18/14.
 */

import jalangi = require('jalangi/src/js/jalangi');
import fs = require('fs');
import path = require('path');
import assert = require('assert');
import memTracer = require('../lib/analysis/memTraceAPI');
import parser = require('../lib/analysis/binaryTraceParser');

var mkdirp = require('mkdirp');
var outputDir = "lifetime-analysis/test/traces";
mkdirp.sync(outputDir);

var tests: Array<string> = [];
var numTests = 18;
for (var i = 1; i <= numTests; i++) {
    tests.push("htmlTest" + i);
}

function runTest(testDir: string, expected: string) {
    // instrument the code

    var tracePromise = memTracer.getTraceForHTMLDir(testDir, { outputDir: outputDir, debugFun: "jalangiRC"  });
    return tracePromise.then(function (result) {
        var actualOutput = parser.parseTrace(result.memTraceLoc);
        // get rid of the current absolute directory prefix
        actualOutput = actualOutput.replace(process.cwd() + path.sep, "");
        if (fs.existsSync(expected)) {
            var expectedOutput = String(fs.readFileSync(expected));
            assert.equal(actualOutput, expectedOutput);
        } else {
            fs.writeFileSync(expected, actualOutput);
        }

    });
}

describe('html unit tests', function() {
    this.timeout(10000);
    tests.forEach(function (test) {
        it('should handle html test ' + test, function (done) {
            var testDir = "test/testdata/html/" + test;
            var expected = "test/testdata/html/" + test + "/mem-trace.expected";
            runTest(testDir, expected).then(function () { done(); }).done();
        });
    });

});
