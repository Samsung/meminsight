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
/*
 * Copyright 2014 Samsung Information Systems America, Inc.
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
package com.samsung.memoryanalysis.traceparser;

import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import com.ibm.wala.util.collections.HashSetFactory;
import com.ibm.wala.util.functions.VoidFunction;

/**
 *
 * @author s.jensen
 */
public class TraceAnalysisRunner {

    private final DataInputStream trace;

    private final JsonParser parser = new JsonParser();

    private final FreeVariables fvMap;

    private final IIDMap iidMap;

    private final ProgressMonitor progress;

    private int traceSize = 0;

    private int currentScriptId = -1;

    public TraceAnalysisRunner(InputStream trace, ProgressMonitor progress, File dir) throws FileNotFoundException, IOException {
        this.trace = new DataInputStream(trace);
        fvMap = buildFVMap(dir);
        iidMap = IIDMap.parseIIDFile(dir);
        this.progress = progress;

    }

    /**
     *
     * @param arr
     * @return arr[idx] as int
     */
    private int getInt(JsonArray arr, int idx) {
        return arr.get(idx).getAsInt();
    }

    /**
     *
     * @param arr
     * @param idx
     * @return arr[idx] as String
     */
    private String getString(JsonArray arr, int idx) {
        return arr.get(idx).getAsString();
    }

    private FreeVariables buildFVMap(File dir) throws IOException {
        File fvFile = new File(dir, "freevars.json");
        FreeVariables res = new FreeVariables();
        if (fvFile.exists()) {
            JsonObject json = null;
            try {
                json = parser.parse(new BufferedReader(new FileReader(fvFile))).getAsJsonObject();// parser.parse(js.get());
            } catch (JsonParseException ex) {
                throw new IOException("Invalid free-variables map file: "
                        + ex.getMessage());
            }

            for (Map.Entry<String, JsonElement> entry : json.entrySet()) {
                JsonElement o = entry.getValue();
                if (o.isJsonPrimitive() && o.getAsJsonPrimitive().isString())
                    res.put(Integer.parseInt(entry.getKey()), FreeVariables.ANY);
                else {
                    JsonArray a = o.getAsJsonArray();
                    final Set<String> freeVars = HashSetFactory.make();
                    for (int i = 0; i < a.size(); i++) {
                        final JsonElement jsonElement = a.get(i);
                        freeVars.add(jsonElement.getAsString());
                    }
                    res.put(Integer.parseInt(entry.getKey()),freeVars);
                }
            }
        }
        return res;
    }

    private byte[] buf = new byte[4];
    private ByteBuffer byteBuf = ByteBuffer.wrap(buf);
    private int readInt() throws IOException {
        byteBuf.rewind();
        trace.readFully(buf);

        return byteBuf.getInt();
    }

    private String readString() throws IOException {
        int length = readInt();
        byte[] strData = new byte[length];
        trace.readFully(strData);

        return new String(strData,"UnicodeLittleUnmarked");
    }

    public <T> T runAnalysis(TraceAnalysis<T> a) throws FileNotFoundException, IOException {
        TraceTimer timer = new TraceTimer();
        a.init(timer, iidMap);
        int counter = 0;
        if (progress != null)
            progress.start(this.traceSize);
        int evtTypeInt = 0;
        TraceEntry evtType;
        while((evtTypeInt = trace.read()) != -1) {
            evtType = TraceEntry.values()[evtTypeInt];
            switch (evtType) {
              case DECLARE: {
                  int iid = readInt();
                  String name = readString();
                  int objId = readInt();
                  a.declare(iid, name, objId);
                  break;
              }
              case CREATE_OBJ: {
                    int iid = readInt();
                    int objId = readInt();
                    a.create(iid, objId);
                    break;
              }
                case CREATE_FUN: {
                    int iid = readInt();
                    int funcEnterIID = readInt();
                    int objId = readInt();
                    int protoId = objId + 1;
                    a.createFun(iid, objId, protoId, funcEnterIID, fvMap.getFreeVariables(funcEnterIID));
                    break;
                }
                case PUTFIELD: {
                    int iid = readInt();
                    int baseid = readInt();
                    String propName = null;
                    propName = readString();
                    int objId = readInt();
                    a.putField(iid, baseid, propName, objId);
                    break;
                }
                case WRITE: {
                    int iid = readInt();
                    String name = readString();
                    int objId = readInt();
                    a.write(iid, name, objId);
                    break;
                }
                case LAST_USE: {
                    int objId = readInt();
                    int time = readInt();
//                        assert time == timer.currentTime();
                    int iid = readInt();
                    a.lastUse(objId, iid, time);
                    break;
                }
                case FUNCTION_ENTER: {
                    int iid = readInt();//getInt(arr, 1);
                    int funId = readInt();//getInt(arr, 2);
                    a.functionEnter(iid, funId, IIDMap.UNKNOWN_IID);
                    break;
                }
                case FUNCTION_EXIT: {
                    int iid = readInt();
                    a.functionExit(iid);
                    break;
                }
                case TOP_LEVEL_FLUSH: {
                    int iid = readInt();//getInt(arr, 1);
                    a.topLevelFlush(iid);
                    break;
                }
                case UPDATE_IID: {
                    int objId = readInt();//getInt(arr, 1);
                    int newIID = readInt();//getInt(arr, 2);
                    a.updateIID(objId, newIID);
                    break;
                }
                case DEBUG: {
                    int iid = readInt();//getInt(arr, 1);
                    int o = readInt();//getInt(arr, 2);
                    a.debug(iid, o);
                    break;
                }
                case RETURN: {
                    int retVal = readInt();//getInt(arr, 1);
                    a.returnStmt(retVal);
                    break;
                }
                case CREATE_DOM_NODE: {
                    int iid = readInt();//getInt(arr, 1);
                    int o = readInt();//getInt(arr, 2);
                    a.createDomNode(iid, o);
                    break;
                }
                case ADD_DOM_CHILD: {
                    int parent = readInt();//getInt(arr,1);
                    int child = readInt();//getInt(arr,2);
                    a.addDOMChild(parent, child);
                    break;
                }
                case REMOVE_DOM_CHILD: {
                    int parent = readInt();//getInt(arr,1);
                    int child = readInt();//getInt(arr,2);
                    a.removeDOMChild(parent, child);
                    break;
                }
                case ADD_TO_CHILD_SET: {
                    int iid = readInt();//getInt(arr,1);
                    int parent = readInt();//getInt(arr,2);
                    String name = readString();//getString(arr,3);
                    int child = readInt();//getInt(arr,4);
                    a.addToChildSet(iid, parent, name, child);
                    break;
                }
                case REMOVE_FROM_CHILD_SET: {
                    int iid = readInt();//getInt(arr,1);
                    int parent = readInt();//getInt(arr,2);
                    String name = readString();//getString(arr,3);
                    int child = readInt();//getInt(arr,4);
                    a.removeFromChildSet(iid, parent, name, child);
                    break;
                }
                case DOM_ROOT: {
                    int nodeId = readInt();//getInt(arr, 1);
                    a.domRoot(nodeId);
                    break;
                }
                case CALL: {
                    int iid = readInt();//getInt(arr,1);
                    int funObjId = readInt();//getInt(arr,2);
                    int funEnterIID = readInt();//getInt(arr,3);
                    a.functionEnter(funEnterIID, funObjId, iid);
                    break;
                }
                case SCRIPT_ENTER: {
                    int iid = readInt();
                    int sid = readInt();
                    String filename = readString();
                    iidMap.addScriptMapping(sid, filename);
                    a.scriptEnter(iid, sid, filename);
                    break;
                }
                case SCRIPT_EXIT: {
                    int iid = readInt();//getInt(arr, 1);
                    a.scriptExit(iid);
                    break;
                }
                case FREE_VARS: {
                    int iid = readInt();//getInt(arr, 1);
                    int len = readInt();
                    if (len == -1) {
                        //string
                        readString();
                        fvMap.put(iid, FreeVariables.ANY);
                    } else {
                        Set<String> names = HashSetFactory.make(len);
                        for (int i = 0; i < len; i++) {
                            names.add(readString());
                        }
                        fvMap.put(iid,names);
                    }
                    break;
                }
                case SOURCE_MAPPING:
                    int iid = readInt();
                    int startLine = readInt();
                    int startColumn = readInt();
                    int endLine = readInt();
                    int endColumn = readInt();
                    iidMap.addMapping(iid, currentScriptId, startLine, startColumn, endLine, endColumn);
                    break;
                case UPDATE_CURRENT_SCRIPT:
                    int scriptId = readInt();
                    this.currentScriptId = scriptId;
                    break;
                case UNREACHABLE:
                    break;
            }
            // don't tick timer for metadata entries (SOURCE_MAPPING or FREE_VARS or UPDATE_CURRENT_SCRIPT)
            if (evtType != TraceEntry.SOURCE_MAPPING && evtType != TraceEntry.FREE_VARS && evtType != TraceEntry.UPDATE_CURRENT_SCRIPT) {
                timer.tick();
            }
            if (this.progress != null)
                progress.tick(counter);
            counter++;
        }
        if (this.progress != null)
            progress.tick(this.traceSize);
        trace.close();
        // we need to undo the last tick, as execution is now over
        // and we want the current time to correspond to the final entry
        timer.rewindOneTick();
        return a.endExecution();
    }
    //TODO: Unify the binary and JSON parsers.

    public <T> T runAnalysisJSON(TraceAnalysis<T> a) throws FileNotFoundException, IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(trace));
        String line;
        TraceTimer timer = new TraceTimer();
        a.init(timer, iidMap);
        int counter = 0;
        if (progress != null)
            progress.start(this.traceSize);
        while ((line = in.readLine()) != null) {
            try {
                JsonArray arr = parser.parse(line).getAsJsonArray();
                TraceEntry evt = TraceEntry.values()[arr.get(0).getAsInt()];
                switch (evt) {
                    case DECLARE: {
                        int iid = getInt(arr, 1);
                        String name = getString(arr, 2);
                        int objId = getInt(arr, 3);
                        a.declare(iid, name, objId);
                        break;
                    }
                    case CREATE_OBJ: {
                        int iid = getInt(arr, 1);
                        int objId = getInt(arr, 2);
                        a.create(iid, objId);
                        break;
                    }
                    case CREATE_FUN: {
                        int iid = getInt(arr, 1);
                        int funcEnterIID = getInt(arr, 2);
                        int objId = getInt(arr, 3);
                        int protoId = objId + 1;
                        a.createFun(iid, objId, protoId, funcEnterIID, fvMap.getFreeVariables(funcEnterIID));
                        break;
                    }
                    case PUTFIELD: {
                        int iid = getInt(arr, 1);
                        int baseid = getInt(arr, 2);
                        String propName = null;
                        try {
                            propName = getString(arr, 3);
                        } catch (Exception e) {
                            System.err.println("!!!" + line);
                            throw new RuntimeException(e);
                        }
                        int objId = getInt(arr, 4);
                        a.putField(iid, baseid, propName, objId);
                        break;
                    }
                    case WRITE: {
                        int iid = getInt(arr, 1);
                        String name = getString(arr, 2);
                        int objId = getInt(arr, 3);
                        a.write(iid, name, objId);
                        break;
                    }
                    case LAST_USE: {
                        int objId = getInt(arr, 1);
                        int time = getInt(arr, 2);
//                        assert time == timer.currentTime();
                        int iid = getInt(arr, 3);
                        a.lastUse(objId, iid, time);
                        break;
                    }
                    case FUNCTION_ENTER: {
                        int iid = getInt(arr, 1);
                        int funId = getInt(arr, 2);
                        a.functionEnter(iid, funId, IIDMap.UNKNOWN_IID);
                        break;
                    }
                    case FUNCTION_EXIT: {
                        int iid = getInt(arr, 1);
                        a.functionExit(iid);
                        break;
                    }
                    case TOP_LEVEL_FLUSH: {
                        int iid = getInt(arr, 1);
                        a.topLevelFlush(iid);
                        break;
                    }
                    case UPDATE_IID: {
                        int objId = getInt(arr, 1);
                        int newIID = getInt(arr, 2);
                        a.updateIID(objId, newIID);
                        break;
                    }
                    case DEBUG: {
                        int iid = getInt(arr, 1);
                        int o = getInt(arr, 2);
                        a.debug(iid, o);
                        break;
                    }
                    case RETURN: {
                        int retVal = getInt(arr, 1);
                        a.returnStmt(retVal);
                        break;
                    }
                    case CREATE_DOM_NODE: {
                        int iid = getInt(arr, 1);
                        int o = getInt(arr, 2);
                        a.createDomNode(iid, o);
                        break;
                    }
                    case ADD_DOM_CHILD: {
                        int parent = getInt(arr,1);
                        int child = getInt(arr,2);
                        a.addDOMChild(parent, child);
                        break;
                    }
                    case REMOVE_DOM_CHILD: {
                        int parent = getInt(arr,1);
                        int child = getInt(arr,2);
                        a.removeDOMChild(parent, child);
                        break;
                    }
                    case ADD_TO_CHILD_SET: {
                        int iid = getInt(arr,1);
                        int parent = getInt(arr,2);
                        String name = getString(arr, 3);
                        int child = getInt(arr,4);
                        a.addToChildSet(iid, parent, name, child);
                        break;
                    }
                    case REMOVE_FROM_CHILD_SET: {
                        int iid = getInt(arr,1);
                        int parent = getInt(arr,2);
                        String name = getString(arr,3);
                        int child = getInt(arr,4);
                        a.removeFromChildSet(iid, parent, name, child);
                        break;
                    }
                    case DOM_ROOT: {
                        int nodeId = getInt(arr, 1);
                        a.domRoot(nodeId);
                        break;
                    }
                    case CALL: {
                    	int iid = getInt(arr,1);
                    	int funObjId = getInt(arr,2);
                    	int funEnterIID = getInt(arr,3);
                    	a.functionEnter(funEnterIID, funObjId, iid);
                    	break;
                    }
                    case SCRIPT_ENTER: {
                        throw new Error("fix this code");
//                    	int iid = getInt(arr, 1);
//                    	String filename = getString(arr, 2);
//                    	//a.scriptEnter(iid, filename);
                    	//break;
                    }
                    case SCRIPT_EXIT: {
                    	int iid = getInt(arr, 1);
                    	a.scriptExit(iid);
                    	break;
                    }
                    case FREE_VARS: {
                    	int iid = getInt(arr, 1);
                    	JsonElement names = arr.get(2);
                        if (names.isJsonPrimitive())
                            fvMap.put(iid, FreeVariables.ANY);
                        else {
                            JsonArray namesArray = names.getAsJsonArray();
                            Set<String> fv = HashSetFactory.make();
                            for (int i = 0; i < namesArray.size(); i++) {
                                fv.add(namesArray.get(i).getAsString());
                            }
                            fvMap.put(iid, fv);
                        }

                    	break;
                    }
                    case SOURCE_MAPPING: { // fields: iid, filename, startLine, startColumn
                        int iid = getInt(arr, 1);
                        String filename = getString(arr, 2);
                        int startLine = getInt(arr, 3);
                        int startColumn = getInt(arr, 4);
                        throw new RuntimeException("fix this case");
//                        iidMap.addMapping(iid, new SourceLocation(filename, startLine, startColumn));
//                        break;
                    }
                    case UNREACHABLE:
                        break;
                    default:
                        throw new AssertionError("? : "  +evt);
                }
                // don't tick timer for metadata entries (SOURCE_MAPPING or FREE_VARS)
                if (evt != TraceEntry.SOURCE_MAPPING && evt != TraceEntry.FREE_VARS) {
                    timer.tick();
                }
                if (this.progress != null)
                    progress.tick(counter);
                counter++;
            } catch (JsonParseException ex) {
                in.close();
                throw new IOException("Invalid JSON line: " + line);
            }
        }
        if (this.progress != null)
            progress.tick(this.traceSize);
        in.close();
        // we need to undo the last tick, as execution is now over
        // and we want the current time to correspond to the final entry
        timer.rewindOneTick();
        return a.endExecution();
    }


    @SuppressWarnings("unused")
    private static class LastUseEntry implements Comparable<LastUseEntry> {

        public final int objectId;
        public final int time;
        public final int iid;

        public LastUseEntry(int objectId, int time, int iid) {
            this.objectId = objectId;
            this.time = time;
            this.iid = iid;
        }

        @Override
        public int compareTo(LastUseEntry o) {
            return this.time - o.time;
        }

        public String toJSONLine() {
            return String.format("[%d,%d,%d,%d]", 5, objectId, time, iid);
        }
    }

    private static class TraceTimer implements Timer {

        private long timeInternal = 0;

         //TODO: Use a PriorityQueue
        private SortedMap<Long, List<VoidFunction<Long>>> alarms = null;

        @Override
        public long currentTime() {
            return timeInternal;
        }

        public void rewindOneTick() {
            timeInternal--;
        }

        @Override
        public void registerAlarm(long atTime, VoidFunction<Long> callback) {
            if (alarms == null)
                alarms = new TreeMap<Long, List<VoidFunction<Long>>>();
            List<VoidFunction<Long>> cbs = alarms.get(atTime);
            if (cbs == null) {
                cbs = new ArrayList<VoidFunction<Long>>();
                alarms.put(atTime, cbs);
            }
            cbs.add(callback);
        }

        private void tick() {
            if (alarms != null && alarms.firstKey() == timeInternal) {
                List<VoidFunction<Long>> list = alarms.get(timeInternal);
                for (VoidFunction<Long> c: list) {
                    c.apply(timeInternal);
                }
                alarms.remove(timeInternal);
                if (alarms.isEmpty())
                    alarms = null;
            }
            timeInternal++;
        }
    }

    /**
     * This enum is lifted from the LoggingAnalysis.ts.
     */
    // IID special values: -1 is unknown, -2 corresponds to the initial
    // DOM traversal to attach mutation observers
    public static enum TraceEntry {
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
        UPDATE_CURRENT_SCRIPT, // fields: scriptID
        UNREACHABLE // fields: iid, object-id, time
    }

}
