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
package com.samsung.memoryanalysis.traceparser;

import static java.lang.String.format;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Set;

import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;

/**
 *
 * @author s.jensen
 */
public class TracePrettyPrinter implements TraceAnalysis<Void> {

    private Timer timer;

    @Override
    public void init(Timer timer, SourceMap iidMap) {
        this.timer = timer;
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        System.out.println(format("declare(slId=%s, name=%s, objectId=%s, time=%d)", slId, name, objectId, timer.currentTime()));
    }

    @Override
    public void create(SourceLocId slId, int objectId) {
        System.out.println(format("create(slId=%s, objectId=%s, time=%d)", slId, objectId, timer.currentTime()));
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID,Set<String> namesReferencedInClosure) {
        System.out.println(format("create(slId=%s, objectId=%s, prototypeId = %d, functionEnterslId=%s,namesReferencedInClosure = %s, time=%d)",
                slId, objectId, prototypeId, functionEnterIID, namesReferencedInClosure.toString(), timer.currentTime()));
    }

    @Override
    public void putField(SourceLocId slId, int baseId, String offset, int objectId) {
        System.out.println(format("putField(slId=%s, baseId=%d, offset=%s, objectId=%s, time=%d)", slId, baseId, offset, objectId, timer.currentTime()));
    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {
        System.out.println(format("write(slId=%s, name=%s, objectId=%s, time=%d)", slId, name, objectId, timer.currentTime()));
    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, int time) {
        System.out.println(format("lastUse(objectId=%d, slId=%s, time=%d)", objectId, slId, time));
    }

    @Override
    public void functionEnter(SourceLocId slId, int functionId, SourceLocId callSiteIID) {
        System.out.println(format("functionEnter(iid = %d, functionId = %d, callSiteIID = %d, time = %d)", slId, functionId, callSiteIID, timer.currentTime()));
    }

    @Override
    public void functionExit(SourceLocId slId) {
        System.out.println(format("functionExit(iid = %d, time = %d)", slId, timer.currentTime()));
    }

    @Override
    public void topLevelFlush(SourceLocId slId) {
        System.out.printf("topLevelFlush(iid = %d)\n", slId);
    }

    @Override
    public Void endExecution() {
        return null;
    }

    public static void main(String[] args) throws IOException, InterruptedException {
        System.out.println(new File(args[0]).getAbsolutePath());
        if (args.length != 1) {
            System.out.println("Specify a trace " + args.length);
            System.exit(1);
        }
        TraceAnalysisRunner t = new TraceAnalysisRunner(new FileInputStream(args[0]),null, new File(args[0]).getParentFile());
        t.runAnalysis(new TracePrettyPrinter());
    }

    @Override
    public void updateIID(int objId, SourceLocId newSlID) {
         System.out.println(format("updateIID(objId = %d, newSlId = %s, time = %d)", objId, newSlID, timer.currentTime()));
    }

    @Override
    public void debug(SourceLocId slId, int oid) {
        System.out.printf("debug(%d,%d)\n", slId, oid);
    }

    @Override
    public void returnStmt(int retVal) {
        System.out.printf("return(%d)\n", retVal);
    }

    @Override
    public void createDomNode(SourceLocId slId, int o) {
        System.out.printf("createDomNode(iid = %d, objectId = %d\n", slId, o);
    }

    @Override
    public void addDOMChild(int parent, int child) {
        System.out.printf("addDOMChild(parent = %d, child = %d\n", parent, child);
    }

    @Override
    public void removeDOMChild(int parent, int child) {
        System.out.printf("removeDOMChild(parent = %d, child = %d\n", parent, child);
    }

	@Override
	public void addToChildSet(SourceLocId slId, int parent, String name, int child) {
        System.out.println(format("addToChildSet(slId=%s, parent=%d, name=%s, child=%s, time=%d)", slId, parent, name, child, timer.currentTime()));
	}

	@Override
	public void removeFromChildSet(SourceLocId slId, int parent, String name, int child) {
        System.out.println(format("removeFromChildSet(slId=%s, parent=%d, name=%s, child=%s, time=%d)", slId, parent, name, child, timer.currentTime()));
	}

	@Override
	public void domRoot(int nodeId) {
        System.out.println(format("domRoot(nodeId=%d, time=%d)", nodeId, timer.currentTime()));
	}

	@Override
	public void scriptEnter(SourceLocId slId, String filename) {
        System.out.println(format("scriptEnter(slId=%s, filename=%s, time=%d)", slId, filename, timer.currentTime()));
	}

	@Override
	public void scriptExit(SourceLocId slId) {
        System.out.println(format("scriptExit(slId=%s, time=%d)", slId, timer.currentTime()));
	}

    @Override
    public void endLastUse() {
        System.out.println("endLastUse()");
    }

}
