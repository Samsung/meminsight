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
package com.samsung.memoryanalysis.traceparser;

import java.io.DataInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;

import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;

public class EnhancedTraceAnalysisRunner extends TraceAnalysisRunner {

    private final DataInputStream lastUseTrace;

    private final DataInputStream unreachableTrace;

    private final DataInputStream updIIDTrace;

    private static class LastUseUnreachableRecord {
        final long time;
        final int objectId;
        final SourceLocId slId;
        public LastUseUnreachableRecord(int objectId, long time, SourceLocId slId) {
            this.time = time;
            this.objectId = objectId;
            this.slId = slId;
        }
        @Override
        public String toString() {
            return "Record [time=" + time + ", objectId=" + objectId
                    + ", slId=" + slId + "]";
        }
    }

    private static class UpdIIDRecord {
        final int objectId;
        final SourceLocId slId;
        public UpdIIDRecord(int objectId, SourceLocId slId) {
            super();
            this.objectId = objectId;
            this.slId = slId;
        }


    }

    /**
     * the next last use record, or null if we've completed all last use records
     */
    private LastUseUnreachableRecord nextLastUse;

    /**
     * the next unreachable record, or null if we've completed all unreachable records
     */
    private LastUseUnreachableRecord nextUnreachable;

    private UpdIIDRecord nextUpdIIDRecord;

    public EnhancedTraceAnalysisRunner(InputStream trace,
            InputStream lastUseTrace, InputStream unreachableTrace, InputStream updIIDTrace,
            ProgressMonitor progress, File dir) throws FileNotFoundException,
            IOException {
        super(trace, progress, dir);
        // ignore last use entries and update IID from the original trace
        this.ignoreLastUse = true;
        this.ignoreUpdIID = true;
        this.lastUseTrace = new DataInputStream(lastUseTrace);
        nextLastUse = advance(this.lastUseTrace);
//        System.err.println("lu " + nextLastUse);
        this.unreachableTrace = new DataInputStream(unreachableTrace);
        nextUnreachable = advance(this.unreachableTrace);
//        System.err.println("ur " + nextUnreachable);
        this.updIIDTrace = new DataInputStream(updIIDTrace);
        advanceUpdIIDTrace();
    }

    @Override
    protected <T> void invokeCreateCallback(TraceAnalysis<T> a,
            int currentScriptId, int iid, int objId) {
        if (nextUpdIIDRecord != null && nextUpdIIDRecord.objectId == objId) {
            // use the updated source location
            a.create(nextUpdIIDRecord.slId, objId);
            advanceUpdIIDTrace();
        } else {
            super.invokeCreateCallback(a, currentScriptId, iid, objId);
        }
    }

    private LastUseUnreachableRecord advance(DataInputStream trace) {
        try {
            return new LastUseUnreachableRecord(trace.readInt(), trace.readLong(), new SourceLocId(trace.readInt(), trace.readInt()));
        } catch (EOFException e) {
            // we're done; set to null
            return null;
        } catch (IOException e) {
            throw new Error("I/O error", e);
        }
    }

    private void advanceUpdIIDTrace() {
        try {
            nextUpdIIDRecord = new UpdIIDRecord(updIIDTrace.readInt(), new SourceLocId(updIIDTrace.readInt(), updIIDTrace.readInt()));
        } catch (EOFException e) {
            // we're done; set to null
            nextUpdIIDRecord = null;
        } catch (IOException e) {
            throw new Error("I/O error", e);
        }
    }

    @Override
    public <T> T runAnalysis(TraceAnalysis<T> a) throws FileNotFoundException,
            IOException {
        if (!(a instanceof EnhancedTraceAnalysis)) {
            throw new IllegalArgumentException("must run with an EnhancedTraceAnalysis");
        }
        return super.runAnalysis(a);
    }


    @Override
    protected <T> void handleTime(long currentTime, TraceAnalysis<T> a) {
        super.handleTime(currentTime, a);
        // TODO clean up this type grossness
        EnhancedTraceAnalysis<T> eta = (EnhancedTraceAnalysis<T>) a;
        while (nextLastUse != null && currentTime == nextLastUse.time) {
            eta.lastUse(nextLastUse.objectId, nextLastUse.slId, nextLastUse.time);
            nextLastUse = advance(lastUseTrace);
//            System.err.println("lu " + nextLastUse);
        }
        while (nextUnreachable != null && currentTime == nextUnreachable.time) {
            eta.unreachableObject(nextUnreachable.slId, nextUnreachable.objectId);
            nextUnreachable = advance(unreachableTrace);
//            System.err.println("ur " + nextUnreachable);
        }
    }


}
