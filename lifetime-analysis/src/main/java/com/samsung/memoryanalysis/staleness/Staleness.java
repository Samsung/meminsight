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
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.ibm.wala.util.collections.HashMapFactory;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceLocation;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.util.Util;

/**
 * Created by s.jensen on 6/24/14.
 */
public class Staleness {
    public final Map<SourceLocId, List<ObjectStaleness>> staleness;
    private final SourceMap iidMap;
    private final List<long[]> functionTrace;
    private final boolean callStackSourceLoc;

    public Staleness(final Map<SourceLocId, List<ObjectStaleness>> staleness, final List<long[]> functionTrace,final SourceMap iidMap, final boolean callStackSourceLoc) {
        this.staleness = staleness;
        this.iidMap = iidMap;
        this.functionTrace = functionTrace;
        this.callStackSourceLoc = callStackSourceLoc;
    }

    @Override
    public String toString() {
        return staleness.toString();
    }

    @SuppressWarnings("rawtypes")
    public void toJSON(OutputStream out, boolean relative) throws IOException {
        final Map<String, Object> res = HashMapFactory.make();
        final Map<String, Map[]> resStale = new TreeMap<String, Map[]>();
        for (Map.Entry<SourceLocId, List<ObjectStaleness>> entry : staleness.entrySet()) {
            Map[] arr = new Map[entry.getValue().size()];
            for (int i = 0; i < arr.length; i++) {
                ObjectStaleness stale = entry.getValue().get(i);
                arr[i] = stale.toMap(iidMap, relative, callStackSourceLoc);
            }
            SourceLocation entr = iidMap.get(entry.getKey());
            String srcLoc = relative ? Util.makeRelative(entr) : entr == null ? null : entr.toString();
            String key = entry.getKey() == SourceMap.UNKNOWN_ID ? "unknown" : entry.getKey() == SourceMap.END_OF_PROGRAM_ID ? "end of program" : srcLoc;
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
        Gson gson = new GsonBuilder().setPrettyPrinting().create();
        OutputStreamWriter writer = new OutputStreamWriter(out);
        res.put("functionTrace", this.functionTrace);
        res.put("objectInfo", resStale);
        gson.toJson(res, writer);
        writer.close();
    }
}
