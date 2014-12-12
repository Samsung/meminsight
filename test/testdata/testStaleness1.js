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
function runRichards() {
    var scheduler = new Scheduler();
    scheduler.addIdleTask();
}
function Scheduler() {
}
Scheduler.prototype.addIdleTask = function () {
    this.addRunningTask(id, new IdleTask(this));
};
Scheduler.prototype.addRunningTask = function (id, priority) {
    this.addTask(id, priority);
};
Scheduler.prototype.addTask = function (id, priority) {
    this.currentTcb = new TaskControlBlock(priority);
};
function TaskControlBlock(link) {
    this.link = link;
}
function IdleTask(scheduler) {
    this.scheduler = scheduler;
}
IdleTask.prototype.run;
function Packet() {
}
Packet.prototype.addTo;
runRichards();