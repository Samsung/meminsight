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

/**
 * Created by m.sridharan on 6/6/14.
 */

import jalangi = require('jalangi2');
import fs = require('fs');
import path = require('path');
import assert = require('assert');
import memTracer = require('../lib/analysis/memTraceAPI');
import parser = require('../lib/analysis/binaryTraceParser');
var mkdirp = require('mkdirp');

var outputDir = "lifetime-analysis/test/traces";

var tests: Array<string> = [];
var numTests = 3;
for (var i = 1; i <= numTests; i++) {
    tests.push("testMemTrace" + i + ".js");
}

var refCountTests = 52;
for (var i = 1; i <= refCountTests; i++) {
    tests.push("testRefCount" + i + ".js");
}

var stalenessTests = 1;
for (var i = 1; i <= stalenessTests; i++) {
    tests.push("testStaleness" + i + ".js");
}

function runTest(test: string, expected: string) {
    // instrument the code
    var trueOutputDir = path.join(outputDir,path.basename(test, '.js')+"_inst");
    mkdirp.sync(trueOutputDir);
    var instScript = path.join(trueOutputDir, path.basename(test, '.js') + "_jalangi_.js");
    var instOptions = {
        iidMap : true,
        relative: true,
        outputFile: instScript,
        dirIIDFile: trueOutputDir,
        initIID: true
    };

    var promise = memTracer.getTraceForJS(test, instOptions, "jalangiRC");
    return promise.then(function (result) {
        if (result.stderr !== "") {
            console.log(result.stderr);
        }
        //console.log(result.stdout);
        var actualOutput = parser.parseTrace(result.memTraceLoc);
        // get rid of the current absolute directory prefix
        actualOutput = actualOutput.replace(process.cwd() + path.sep, "");
        if (fs.existsSync(expected)) {
            var expectedOutput = String(fs.readFileSync(expected));
            assert.equal(actualOutput, expectedOutput);
        } else {
            fs.writeFileSync(expected, actualOutput);
        }
    }, function (err) {
        console.log(err.stderr);
    });
}

describe('unit tests', function() {
    this.timeout(10000);
    tests.forEach(function (test) {
        it('should handle unit test ' + test, function (done) {
            var testFile = "test/testdata/" + test;
            var expected = "test/testdata/expected/" + test + ".expected";
            runTest(testFile, expected).then(function () { done(); }).done();
        });
    });

});


