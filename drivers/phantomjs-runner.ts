/*
 * Copyright (c) 2015 Samsung Electronics Co., Ltd.
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

///<reference path='../lib/ts-declarations/phantomjs.d.ts' />
///<reference path='../lib/ts-declarations/jalangi.d.ts' />

interface Window {
    J$: any;
    __memTestDone: boolean
}
/**
 * adapted from https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 */
function waitFor(testFx: () => boolean, onReady: () => void, timeOutMillis?: number) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = testFx(); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    try {
                        onReady(); //< Do what it's supposed to do once the condition is fulfilled
                        clearInterval(interval); //< Stop this interval
                    } catch (e) {
                        phantom.exit(1);
                    }
                }
            }
        }, 100);
};

var page = require('webpage').create();
page.onConsoleMessage = function(msg) {
    console.log("console " + msg);
};
page.open('http://localhost:8888', (status) => {
    console.log("Status: " + status);
    if (status !== 'success') phantom.exit(1);
    waitFor(() => {
        return page.evaluate(() => { return window.__memTestDone; })
    }, () => {
        page.evaluate(() => {
            window.J$.analysis.endExecution();
        });
        waitFor(() => {
                return page.evaluate(() => {
                    return window.J$.analysis['doneLogging'];
                });
            },
            () => { phantom.exit(); }
        );
    })
});
