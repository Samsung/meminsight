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
package com.samsung.memoryanalysis.staleness;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.TreeMap;

import com.samsung.memoryanalysis.io.AbstractAsyncTraceWriter;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.SourceLocation;
import com.samsung.memoryanalysis.util.Util;

/**
 * Created by s.jensen on 6/24/14.
 */
public class Staleness {
    public final Map<Integer, List<ObjectStaleness>> staleness;
    private final IIDMap iidMap;
    private final List<long[]> functionTrace;
    private final boolean callStackSourceLoc;

    public Staleness(final Map<Integer, List<ObjectStaleness>> staleness, final List<long[]> functionTrace,final IIDMap iidMap, final boolean callStackSourceLoc) {
        this.staleness = staleness;
        this.iidMap = iidMap;
        this.functionTrace = functionTrace;
        this.callStackSourceLoc = callStackSourceLoc;
    }

    @Override
    public String toString() {
        return staleness.toString();
    }

    public static class StalenessAsyncWriter extends AbstractAsyncTraceWriter {

        public StalenessAsyncWriter(Path path) throws IOException {
            super(path);
        }

        public StalenessAsyncWriter writeRaw(String str) {
            builder.append(str);
            return this;
        }
        public StalenessAsyncWriter writeQuoted(String str) {
            builder.append("\"");
            builder.append(str);
            builder.append("\"");
            return this;
        }
    }

    @SuppressWarnings("rawtypes")
    private void writeList(ArrayList l, StalenessAsyncWriter out) {
        out.writeRaw("[");
        for (int i = 0; i < l.size(); i++) {
            Object val = l.get(i);
            if (val instanceof Integer) {
                out.writeRaw(val.toString());
            } else if (val instanceof String) {
                out.writeQuoted((String)val);
            } else {
                throw new RuntimeException("need to handle " + val.getClass());
            }
            if (i < l.size() - 1) {
                out.writeRaw(",");
            }
        }
        out.writeRaw("]");
    }
    @SuppressWarnings("rawtypes")
    private void writeObjMap(Map map, StalenessAsyncWriter out) {
        out.writeRaw("{");
        Set keySet = map.keySet();
        int i = 0;
        for (Object key: keySet) {
            out.writeQuoted((String)key);
            out.writeRaw(":");
            Object val = map.get(key);
            if (val instanceof ArrayList) {
                ArrayList l = (ArrayList)val;
                writeList(l, out);
            } else if (val instanceof String) {
                out.writeQuoted((String)val);
            } else if (val instanceof Integer || val instanceof Long) {
                out.writeRaw(val.toString());
            } else {
                throw new RuntimeException("need to handle " + val.getClass());
            }
            if (i < keySet.size() - 1) {
                out.writeRaw(",");
            }
            i++;
        }
        out.writeRaw("}");
        out.flushIfNeeded();
    }
    @SuppressWarnings("rawtypes")
    public StalenessAsyncWriter toJSON(Path path, boolean relative) throws IOException {
        StalenessAsyncWriter out = new StalenessAsyncWriter(path);
        // write the function trace
        out.writeRaw("{\"functionTrace\":[");
        for (int i = 0; i < functionTrace.size(); i++) {
            out.writeRaw(Arrays.toString(functionTrace.get(i)));
            if (i < functionTrace.size() - 1) {
                out.writeRaw(",");
            }
            out.flushIfNeeded();
        }
        out.writeRaw("],\"objectInfo\": {");
        final Map<String, Map[]> resStale = new TreeMap<String, Map[]>();
        for (Map.Entry<Integer, List<ObjectStaleness>> entry : staleness.entrySet()) {
            Map[] arr = new Map[entry.getValue().size()];
            for (int i = 0; i < arr.length; i++) {
                ObjectStaleness stale = entry.getValue().get(i);
                arr[i] = stale.toMap(iidMap, relative, callStackSourceLoc);
            }
            SourceLocation entr = iidMap.get(entry.getKey());
            String srcLoc = relative ? Util.makeRelative(entr) : entr == null ? null : entr.toString();
            String key = entry.getKey() == -1 ? "unknown" : entry.getKey() == 0 ? "end of program" : srcLoc;
            if (resStale.containsKey(key)) {
                Map[] old = resStale.get(key);
                Map[] newArr = Arrays.copyOf(old, old.length + arr.length);
                System.arraycopy(arr, 0, newArr, old.length, arr.length);
//                Map[] newArr = Stream.concat(Arrays.stream(old), Arrays.stream(arr)).toArray(Map[]::new);
                resStale.put(key, newArr);
            } else {
                resStale.put(key, arr);
            }
        }
        Set<Entry<String, Map[]>> staleEntries = resStale.entrySet();
        int i = 0;
        for (Entry<String, Map[]> entry: staleEntries) {
            out.writeQuoted(entry.getKey());
            out.writeRaw(": [");
            Map[] objs = entry.getValue();
            for (int j = 0; j < objs.length; j++) {
                Map curMap = objs[j];
                writeObjMap(curMap,out);
                if (j < objs.length-1) {
                    out.writeRaw(",");
                }
            }
            out.writeRaw("]");
            if (i < staleEntries.size() - 1) {
                out.writeRaw(",");
            }
            i++;
        }
        out.writeRaw("}}");
        return out;
    }
}
