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
function jalangiRC() {}
var x = {};
var y = {};
var f1 = function() {}, f2 = function () {};
Object.defineProperty(x, "foo", { value: y });
jalangiRC(y);
Object.defineProperty(x, "foo2", { get: f1, set: f2 });
jalangiRC(f1);
jalangiRC(f2);
