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

/**
 * Created by m.sridharan on 9/16/14.
 */

export class BufferManager {

    buffer: Buffer;
    offset = 0;

    constructor(bufSize: number) {
        this.buffer = new Buffer(bufSize);
    }

    writeByte(val: number): BufferManager {
        var offset = this.offset;
        this.buffer[offset] = val;
        this.offset = offset+1;
        return this;
    }

    writeInt(val: number): BufferManager {
        var offset = this.offset;
        var buf = this.buffer;
        buf[offset] = (val >>> 24);
        buf[offset + 1] = (val >>> 16);
        buf[offset + 2] = (val >>> 8);
        buf[offset + 3] = val;
        this.offset = offset+4;
        return this;
    }

    strLength(val: string): number {
        return val.length*2;
    }
    writeString(val: string): BufferManager {
        var offset = this.offset;
        var buf = this.buffer;
        var strLen = this.strLength(val);
        buf[offset] = (strLen >>> 24);
        buf[offset + 1] = (strLen >>> 16);
        buf[offset + 2] = (strLen >>> 8);
        buf[offset + 3] = strLen;
        offset += 4;
//            buf.write(val, offset, strLen, 'utf8');
        for (var i=0; i<val.length; i++) {
            // NOTE: this doesn't handle crazy 4-byte characters
            var charCode = val.charCodeAt(i);
            buf[offset++] = charCode;
            buf[offset++] = charCode >>> 8;
        }
//            offset += strLen;
        this.offset = offset;
        return this;
    }

}
