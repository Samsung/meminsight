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
package com.samsung.memoryanalysis.referencecounter;

import java.io.OutputStream;
import java.io.PrintStream;
import java.util.Set;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;
import com.samsung.memoryanalysis.traceparser.TraceAnalysisRunner;

/**
 * Creates a trace of the events similar to the input trace, but enriched with
 * unreachable trace events.
 */
public class UnreachabilityTraceWriter implements UnreachabilityAwareAnalysis<Void> {

    private final PrintStream out;
    private final Gson json;


    private Timer timer;
    private long counter = 0;

    public UnreachabilityTraceWriter(OutputStream out) {
        this.out = new PrintStream(out);
        this.json = new GsonBuilder().create();
        throw new Error("this class needs to be rewritten");
    }

    @Override
    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext, long time) {
        trace(TraceAnalysisRunner.TraceEntry.FUNCTION_ENTER.ordinal(), slId, funId, callSiteIID);
    }

    private void trace(Object... args) {
        if (!args[0].equals(TraceAnalysisRunner.TraceEntry.UNREACHABLE.ordinal())) {
            assert timer.currentTime() == counter;
            counter++;
        }
        out.println(json.toJson(args));
    }

    @Override
    public void functionExit(SourceLocId slId, Context functionContext, Set<String> unReferenced, long time) {
        trace(TraceAnalysisRunner.TraceEntry.FUNCTION_EXIT.ordinal(), slId);
    }

    @Override
    public void init(Timer t, SourceMap iidMap) {
        this.timer = t;
    }

    @Override
    public void create(SourceLocId slId, int objectId, long time, boolean isDom) {
        trace(TraceAnalysisRunner.TraceEntry.CREATE_OBJ.ordinal(), slId, objectId);
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {
        trace(TraceAnalysisRunner.TraceEntry.CREATE_FUN.ordinal(), slId, functionEnterIID, objectId);
    }

    @Override
    public void unreachableObject(SourceLocId slId, int objectId, long time, int shallowSize) {
        // we've written out counter elements so far, so the current time should be counter
        // unreachable time shouldn't be after current time
        assert time <= counter;
        trace(TraceAnalysisRunner.TraceEntry.UNREACHABLE.ordinal(), slId, objectId, time);
    }

    @Override
    public void unreachableContext(SourceLocId slId, Context ctx, long time) {

    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, long time) {
        trace(TraceAnalysisRunner.TraceEntry.LAST_USE.ordinal(), objectId, time, slId);
    }

    @Override
    public Void endExecution(long time) {
        out.close();
        return null;
    }

    @Override
    public void domRoot(int nodeId) {
        trace(TraceAnalysisRunner.TraceEntry.DOM_ROOT.ordinal(), nodeId);
    }

    @Override
    public void addDOMChild(int parentId, int childId, long time) {
        trace(TraceAnalysisRunner.TraceEntry.ADD_DOM_CHILD.ordinal(), parentId, childId);
    }

    @Override
    public void removeDOMChild(int parentId, int childId, long time) {
        trace(TraceAnalysisRunner.TraceEntry.REMOVE_DOM_CHILD.ordinal(), parentId, childId);
    }

    @Override
    public void putField(SourceLocId slId, int baseId, String offset, int objectId) {
        trace(TraceAnalysisRunner.TraceEntry.PUTFIELD.ordinal(), slId, baseId, offset, objectId);
    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {
        trace(TraceAnalysisRunner.TraceEntry.WRITE.ordinal(), slId, name, objectId);
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        trace(TraceAnalysisRunner.TraceEntry.DECLARE.ordinal(), slId, name, objectId);
    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
        trace(TraceAnalysisRunner.TraceEntry.UPDATE_IID.ordinal(), objId, newIID);
    }

    @Override
    public void returnStmt(int objId) {
        trace(TraceAnalysisRunner.TraceEntry.RETURN.ordinal(), objId);
    }

    @Override
    public void debug(SourceLocId slId, int oid) {
        trace(TraceAnalysisRunner.TraceEntry.DEBUG.ordinal(), slId, oid);
    }

	@Override
	public void scriptEnter(SourceLocId slId, String filename) {
		trace(TraceAnalysisRunner.TraceEntry.SCRIPT_ENTER.ordinal(), slId, filename);
	}

	@Override
	public void scriptExit(SourceLocId slId) {
		trace(TraceAnalysisRunner.TraceEntry.SCRIPT_EXIT.ordinal(), slId);
	}

    @Override
    public void topLevelFlush(SourceLocId slId) {
        trace(TraceAnalysisRunner.TraceEntry.TOP_LEVEL_FLUSH.ordinal(), slId);
    }

    @Override
    public void addToChildSet(SourceLocId slId, int parentId, String name, int childId) {
        trace(TraceAnalysisRunner.TraceEntry.ADD_TO_CHILD_SET.ordinal(), slId, parentId, name, childId);
    }

    @Override
    public void removeFromChildSet(SourceLocId slId, int parentId, String name, int childId) {
        trace(TraceAnalysisRunner.TraceEntry.REMOVE_FROM_CHILD_SET.ordinal(), slId, parentId, name, childId);
    }

}
