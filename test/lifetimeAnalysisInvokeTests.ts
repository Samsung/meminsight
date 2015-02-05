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


/**
 * Created by m.sridharan on 10/29/14.
 */

import accessPathApi = require("../lib/gui/lifetimeAnalysisAPI");
import assert = require('assert');
import cp = require('child_process');
import fs = require('fs');
import path = require('path');
var temp = require('temp');
temp.track();

describe('access path unit tests', function() {
    this.timeout(10000);
    it('should handle access path test 1', function (done) {
        // for now, just check that the thing actually runs
        var pathsPromise = accessPathApi.getAccessPaths([7], 23, "lifetime-analysis/test/traces/testRefCount28_inst/mem-trace");
        pathsPromise.then((paths) => {
            assert.equal(
                JSON.stringify(paths),
                '{"7":{"accessPaths":[{"path":[{"object":"C(GLOBAL)","property":"jQuery"},{"object":"test/testdata/testRefCount28.js:17:14:18:2","property":"prototype"}],"target":"test/testdata/testRefCount28.js:17:14:18:2"},{"path":[{"object":"C(test/testdata/testRefCount28.js:24:20:37:2)","property":"this"},{"object":"test/testdata/testRefCount28.js:17:14:18:2","property":"prototype"}],"target":"test/testdata/testRefCount28.js:17:14:18:2"}]}}'
            );
            done();
        }).done();
    });

});

describe('lifetime analysis invoke unit tests', function() {
    this.timeout(10000);
    it('should handle lifetime invoke test 1', function (done) {
        // for now, just check that the thing actually runs
        var outputDir = temp.mkdirSync();
        var test = "test/testdata/testRefCount13.js";
        var instProc = cp.spawn("./bin/meminsight", [
            "instrument",
            "--outputDir",
            outputDir,
            test
        ]);
        instProc.on('close', () => {
            var runProc = cp.spawn("./bin/meminsight", [
                "noderun",
                path.join(outputDir, "testRefCount13_inst", "testRefCount13_jalangi_.js")
            ]);
            runProc.on('close', () => {
                var stalenessTrace = String(fs.readFileSync(path.join(outputDir,"testRefCount13_inst", 'staleness-trace')));
                var expectedLine = '[9,"OBJECT","/Users/m.sridharan/git-repos/memory-profiler/meminsight/test/testdata/testRefCount13.js:20:19:20:38",15,["/Users/m.sridharan/git-repos/memory-profiler/meminsight/test/testdata/testRefCount13.js:25:8:25:11"],0,"unknown",37,"end of program"]';
                assert.ok(stalenessTrace.indexOf(expectedLine) !== -1);
                temp.cleanupSync();
                done();
            })
        });
    });

});
