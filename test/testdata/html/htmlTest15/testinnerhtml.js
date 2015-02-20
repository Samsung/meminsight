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

var __memTestDone = false;

(function () {
    function baz() {
        var div = document.getElementById('foo');
        div.innerHTML = "<div id='foo3'></div><div id='foo4'></div>";
        var div2 = document.getElementById('foo2');
        var div3 = document.getElementById('foo3');
        div3.appendChild(div2);
        __memTestDone = true;
    }
    setTimeout(baz, 0);
})();