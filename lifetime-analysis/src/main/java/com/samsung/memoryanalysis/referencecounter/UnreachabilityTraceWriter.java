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

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.AsynchronousFileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.ibm.wala.util.collections.HashSetFactory;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityTraceWriter.TraceFormatter;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.Timer;
import com.samsung.memoryanalysis.traceparser.TraceAnalysisRunner;

/**
 * Creates a trace of the events similar to the input trace, but enriched with
 * unreachable trace events.
 */
public class UnreachabilityTraceWriter implements UnreachabilityAwareAnalysis<TraceFormatter> {

    private final TraceFormatter out;
    private Timer timer;
    private long counter = 0;

    public class TraceFormatter {

        private final AsynchronousFileChannel out;

        private StringBuilder builder = new StringBuilder();

        private static final int CHAR_LIMIT =  64000;

        private long byteOffset = 0;

        private final ExecutorService ioExecutor;

        public TraceFormatter(Path path) throws IOException {
            super();
            ioExecutor = Executors.newSingleThreadExecutor();
            StandardOpenOption[] options = new StandardOpenOption[] { StandardOpenOption.WRITE, StandardOpenOption.CREATE };
            this.out = AsynchronousFileChannel.open(path, HashSetFactory.make(Arrays.asList(options)), ioExecutor);
        }


        private void flushIfNeeded() {
            if (builder.length() >= CHAR_LIMIT) {
                byte[] bytes = builder.toString().getBytes();
                int curLen = bytes.length;
                out.write(ByteBuffer.wrap(bytes), byteOffset);
                byteOffset += curLen;
                builder.setLength(0);
            }
        }

        public TraceFormatter start(int entryType, int iid) {
            updateCounter(entryType);
            builder.append("[");
            builder.append(entryType);
            builder.append(",");
            builder.append(iid);
            builder.append(",");
            return this;
        }

        public TraceFormatter start(int entryType) {
            updateCounter(entryType);
            builder.append("[");
            builder.append(entryType);
            builder.append(",");
            return this;
        }

        public TraceFormatter write(int i) {
            builder.append(i);
            builder.append(",");
            return this;
        }

        public void writeEnd(int i) {
            builder.append(i);
            builder.append("]\n");
            flushIfNeeded();
        }

        public void writeEnd(long time) {
            builder.append(time);
            builder.append("]\n");
            flushIfNeeded();
        }

        public TraceFormatter write(long time) {
            builder.append(time);
            builder.append(",");
            return this;
        }

        public TraceFormatter write(String str) {
            builder.append("\"");
            builder.append(str);
            builder.append("\",");
            return this;
        }

        public void close() throws IOException {
            out.force(true);
            out.close();
            ioExecutor.shutdown();
        }

        public void writeEnd(String str) {
            builder.append("\"");
            builder.append(str);
            builder.append("\"]\n");
            flushIfNeeded();
        }
    }

    public UnreachabilityTraceWriter(Path path) throws IOException {
        Files.deleteIfExists(path);
        this.out = new TraceFormatter(path);
    }

    @Override
    public void init(Timer t, IIDMap iidMap) {
        this.timer = t;
    }

    private void updateCounter(int entryType) {
        if (entryType != TraceAnalysisRunner.TraceEntry.UNREACHABLE.ordinal()) {
            assert timer.currentTime() == counter;
            counter++;
        }
    }

    public void functionEnter(int iid, int funId, int callSiteIID, Context newContext, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.FUNCTION_ENTER.ordinal(), iid).write(funId).writeEnd(callSiteIID);
    }


    @Override
    public void functionExit(int iid, Context functionContext, Set<String> unReferenced, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.FUNCTION_EXIT.ordinal()).writeEnd(iid);
    }


    @Override
    public void create(int iid, int objectId, long time, boolean isDom) {
        out.start(TraceAnalysisRunner.TraceEntry.CREATE_OBJ.ordinal(), iid).writeEnd(objectId);
    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.CREATE_FUN.ordinal(), iid).write(functionEnterIID).writeEnd(objectId);
    }

    @Override
    public void unreachableObject(int iid, int objectId, long time, int shallowSize) {
        // we've written out counter elements so far, so the current time should be counter
        // unreachable time shouldn't be after current time
        assert time <= counter;
        out.start(TraceAnalysisRunner.TraceEntry.UNREACHABLE.ordinal(), iid).write(objectId).writeEnd(time);
    }

    @Override
    public void unreachableContext(int iid, Context ctx, long time) {

    }

    @Override
    public void lastUse(int objectId, int iid, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.LAST_USE.ordinal(), objectId).write(time).writeEnd(iid);
    }

    @Override
    public TraceFormatter endExecution(long time) {
        return out;
    }

    @Override
    public void domRoot(int nodeId) {
        out.start(TraceAnalysisRunner.TraceEntry.DOM_ROOT.ordinal()).writeEnd(nodeId);
    }

    @Override
    public void addDOMChild(int parentId, int childId, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.ADD_DOM_CHILD.ordinal(), parentId).writeEnd(childId);
    }

    @Override
    public void removeDOMChild(int parentId, int childId, long time) {
        out.start(TraceAnalysisRunner.TraceEntry.REMOVE_DOM_CHILD.ordinal(), parentId).writeEnd(childId);
    }

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {
        out.start(TraceAnalysisRunner.TraceEntry.PUTFIELD.ordinal(), iid).write(baseId).write(offset).writeEnd(objectId);
    }

    @Override
    public void write(int iid, String name, int objectId) {
        out.start(TraceAnalysisRunner.TraceEntry.WRITE.ordinal(), iid).write(name).writeEnd(objectId);
    }

    @Override
    public void declare(int iid, String name, int objectId) {
        out.start(TraceAnalysisRunner.TraceEntry.DECLARE.ordinal(), iid).write(name).writeEnd(objectId);
    }

    @Override
    public void updateIID(int objId, int newIID) {
        out.start(TraceAnalysisRunner.TraceEntry.UPDATE_IID.ordinal(),objId).writeEnd(newIID);
    }

    @Override
    public void returnStmt(int objId) {
        out.start(TraceAnalysisRunner.TraceEntry.RETURN.ordinal()).writeEnd(objId);
    }

    @Override
    public void debug(int iid, int oid) {
        out.start(TraceAnalysisRunner.TraceEntry.DEBUG.ordinal(), iid).writeEnd(oid);
    }

	@Override
	public void scriptEnter(int iid, String filename) {
		out.start(TraceAnalysisRunner.TraceEntry.SCRIPT_ENTER.ordinal(), iid).writeEnd(filename);
	}

	@Override
	public void scriptExit(int iid) {
		out.start(TraceAnalysisRunner.TraceEntry.SCRIPT_EXIT.ordinal()).writeEnd(iid);
	}

    @Override
    public void topLevelFlush(int iid) {
        out.start(TraceAnalysisRunner.TraceEntry.TOP_LEVEL_FLUSH.ordinal()).writeEnd(iid);
    }

    @Override
    public void addToChildSet(int iid, int parentId, String name, int childId) {
        out.start(TraceAnalysisRunner.TraceEntry.ADD_TO_CHILD_SET.ordinal(), iid).write(parentId).write(name).writeEnd(childId);
    }

    @Override
    public void removeFromChildSet(int iid, int parentId, String name, int childId) {
        out.start(TraceAnalysisRunner.TraceEntry.REMOVE_FROM_CHILD_SET.ordinal(), iid).write(parentId).write(name).writeEnd(childId);
    }





}
