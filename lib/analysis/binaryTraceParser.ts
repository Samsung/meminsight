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
///<reference path='../ts-declarations/node.d.ts' />


import fs = require('fs');

/**
 * this only works for small traces; reads the whole thing into memory
 * @param filename
 * @returns {string}
 */
export function parseTrace(filename: string): string {
    var result = "";
    var binTrace = fs.readFileSync(filename);
    var offset = 0;
    var readInt = (noComma?: boolean) => {
        result += binTrace.readInt32BE(offset);
        if (!noComma) result += ',';
        offset += 4;
    };
    var readString = (noComma?: boolean) => {
        var strLen = binTrace.readInt32BE(offset);
        offset += 4;
        result += JSON.stringify(binTrace.toString('utf16le', offset, offset+strLen));
        if (!noComma) result += ',';
        offset += strLen;
    };
    while (offset < binTrace.length) {
        result += '[';
        var entryType = binTrace[offset++];
        result += entryType + ',';
        switch (entryType) {
            case LogEntryType.DECLARE:
                readInt(); readString(); readInt(true); break;
            case LogEntryType.CREATE_OBJ:
                readInt(); readInt(true); break;
            case LogEntryType.CREATE_FUN:
                readInt(); readInt(); readInt(true); break;
            case LogEntryType.PUTFIELD:
                readInt(); readInt(); readString(); readInt(true); break;
            case LogEntryType.WRITE:
                readInt(); readString(); readInt(true); break;
            case LogEntryType.LAST_USE:
                readInt(); readInt(); readInt(true); break;
            case LogEntryType.FUNCTION_ENTER:
                readInt(); readInt(true); break;
            case LogEntryType.FUNCTION_EXIT:
                readInt(true); break;
            case LogEntryType.TOP_LEVEL_FLUSH:
                readInt(true); break;
            case LogEntryType.UPDATE_IID:
                readInt(); readInt(true); break;
            case LogEntryType.DEBUG:
                readInt(); readInt(true); break;
            case LogEntryType.RETURN:
                readInt(true); break;
            case LogEntryType.CREATE_DOM_NODE:
                readInt(); readInt(true); break;
            case LogEntryType.ADD_DOM_CHILD:
                readInt(); readInt(true); break;
            case LogEntryType.REMOVE_DOM_CHILD:
                readInt(); readInt(true); break;
            case LogEntryType.ADD_TO_CHILD_SET:
                readInt(); readInt(); readString(); readInt(true); break;
            case LogEntryType.REMOVE_FROM_CHILD_SET:
                readInt(); readInt(); readString(); readInt(true); break;
            case LogEntryType.DOM_ROOT:
                readInt(true); break;
            case LogEntryType.CALL:
                readInt(); readInt(); readInt(true); break;
            case LogEntryType.SCRIPT_ENTER:
                readInt(); readInt(); readString(true); break;
            case LogEntryType.SCRIPT_EXIT:
                readInt(true); break;
            case LogEntryType.FREE_VARS:
                readInt();
                var arrLength = binTrace.readInt32BE(offset);
                offset += 4;
                if (arrLength === -1) {
                    // string
                    readString(true);
                } else {
                    var arr: Array<string> = [];
                    for (var ind = 0; ind < arrLength; ind++) {
                        var strLen = binTrace.readInt32BE(offset);
                        offset += 4;
                        arr.push(binTrace.toString('utf16le', offset, offset+strLen));
                        offset += strLen;
                    }
                    result += JSON.stringify(arr);
                }
                break;
            case LogEntryType.SOURCE_MAPPING:
                readInt(); readInt(); readInt(); readInt(); readInt(true); break;
            case LogEntryType.UPDATE_CURRENT_SCRIPT:
                readInt(true); break;
        }
        result += ']\n';
    }
    return result;
}

// IID special values: -1 is unknown, -2 corresponds to the initial
// DOM traversal to attach mutation observers
enum LogEntryType {
    DECLARE, // fields: iid, name, obj-id
    CREATE_OBJ, // fields: iid, obj-id
    CREATE_FUN, // fields: iid, function-enter-iid, obj-id.  NOTE: proto-obj-id is always obj-id + 1
    PUTFIELD, // fields: iid, base-obj-id, prop-name, val-obj-id
    WRITE, // fields: iid, name, obj-id
    LAST_USE, // fields: obj-id, timestamp, iid
    FUNCTION_ENTER, // fields: iid, function-object-id.  NOTE: only emitted when CALL is not emitted
    FUNCTION_EXIT, // fields: iid
    TOP_LEVEL_FLUSH, // fields: iid
    UPDATE_IID, // fields: obj-id, new-iid
    DEBUG, // fields: call-iid, obj-id
    RETURN, // fields: obj-id
    CREATE_DOM_NODE, // fields: iid, obj-id
    ADD_DOM_CHILD, // fields: parent-obj-id, child-obj-id
    REMOVE_DOM_CHILD, // fields: parent-obj-id, child-obj-id
    ADD_TO_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
    REMOVE_FROM_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
    DOM_ROOT, // fields: obj-id
    CALL, // fields: iid, function-obj-id, function-enter-iid.  NOTE: only emitted for calls to *instrumented* functions
    SCRIPT_ENTER, // fields: iid, scriptId, filename
    SCRIPT_EXIT, // fields: iid
    FREE_VARS, // fields: iid, array-of-names or ANY
    SOURCE_MAPPING, // fields: iid, startLine, startColumn, endLine, endColumn
    UPDATE_CURRENT_SCRIPT // fields: scriptID
}


if (require.main === module) {
    parseTrace(process.argv[2]);
}