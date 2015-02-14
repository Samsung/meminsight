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

function doAlloc() {
    // non-escaping
    var x = { f: 3 };
    return x.f+4;
}

function read(p) { return p.f; }

function doAlloc2() {
    // also not escaping
    var x = { f: 3 };
    return read(x)+4;
}


var global = null;

function doAlloc3() {
    // inner object not escaping
    var x = { f: { g: 7 } };
    var result = x.f.g;
    x.f = null;
    global = x;
    return result;
}

function escapeAlloc() {
    // escaping
    var x = { f : 3 };
    return x;
}

var total = 0;

for (var i = 0; i < 100; i++) {
    total = total + doAlloc() + doAlloc2() + doAlloc3() + escapeAlloc().f;
}

console.log(total);

