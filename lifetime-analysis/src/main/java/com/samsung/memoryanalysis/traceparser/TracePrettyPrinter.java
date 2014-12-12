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

/**
 *
 * @author s.jensen
 */
public class TracePrettyPrinter implements TraceAnalysis<Void> {

    private Timer timer;

    @Override
    public void init(Timer timer, IIDMap iidMap) {
        this.timer = timer;
    }

    @Override
    public void declare(int iid, String name, int objectId) {
        System.out.println(format("declare(iid=%d, name=%s, objectId=%s, time=%d)", iid, name, objectId, timer.currentTime()));
    }

    @Override
    public void create(int iid, int objectId) {
        System.out.println(format("create(iid=%d, objectId=%s, time=%d)", iid, objectId, timer.currentTime()));
    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID,Set<String> namesReferencedInClosure) {
        System.out.println(format("create(iid=%d, objectId=%s, prototypeId = %d, functionEnterIID=%d,namesReferencedInClosure = %s, time=%d)",
                iid, objectId, prototypeId, functionEnterIID, namesReferencedInClosure.toString(), timer.currentTime()));
    }

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {
        System.out.println(format("putField(iid=%d, baseId=%d, offset=%s, objectId=%s, time=%d)", iid, baseId, offset, objectId, timer.currentTime()));
    }

    @Override
    public void write(int iid, String name, int objectId) {
        System.out.println(format("write(iid=%d, name=%s, objectId=%s, time=%d)", iid, name, objectId, timer.currentTime()));
    }

    @Override
    public void lastUse(int objectId, int iid, int time) {
        System.out.println(format("lastUse(objectId=%d, iid=%d, time=%d)", objectId, iid, time));
    }

    @Override
    public void functionEnter(int iid, int functionId, int callSiteIID) {
        System.out.println(format("functionEnter(iid = %d, functionId = %d, callSiteIID = %d, time = %d)", iid, functionId, callSiteIID, timer.currentTime()));
    }

    @Override
    public void functionExit(int iid) {
        System.out.println(format("functionExit(iid = %d, time = %d)", iid, timer.currentTime()));
    }

    @Override
    public void topLevelFlush(int iid) {
        System.out.printf("topLevelFlush(iid = %d)\n", iid);
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
    public void updateIID(int objId, int newIID) {
         System.out.println(format("updateIID(objId = %d, newIID = %d, time = %d)", objId, newIID, timer.currentTime()));
    }

    @Override
    public void debug(int iid, int oid) {
        System.out.printf("debug(%d,%d)\n", iid, oid);
    }

    @Override
    public void returnStmt(int retVal) {
        System.out.printf("return(%d)\n", retVal);
    }

    @Override
    public void createDomNode(int iid, int o) {
        System.out.printf("createDomNode(iid = %d, objectId = %d\n", iid, o);
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
	public void addToChildSet(int iid, int parent, String name, int child) {
        System.out.println(format("addToChildSet(iid=%d, parent=%d, name=%s, child=%s, time=%d)", iid, parent, name, child, timer.currentTime()));
	}

	@Override
	public void removeFromChildSet(int iid, int parent, String name, int child) {
        System.out.println(format("removeFromChildSet(iid=%d, parent=%d, name=%s, child=%s, time=%d)", iid, parent, name, child, timer.currentTime()));
	}

	@Override
	public void domRoot(int nodeId) {
        System.out.println(format("domRoot(nodeId=%d, time=%d)", nodeId, timer.currentTime()));
	}

	@Override
	public void scriptEnter(int iid, String filename) {
        System.out.println(format("scriptEnter(iid=%d, filename=%s, time=%d)", iid, filename, timer.currentTime()));
	}

	@Override
	public void scriptExit(int iid) {
        System.out.println(format("scriptExit(iid=%d, time=%d)", iid, timer.currentTime()));
	}

}
