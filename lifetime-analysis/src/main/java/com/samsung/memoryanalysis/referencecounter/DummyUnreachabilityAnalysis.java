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

import java.util.Set;

import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Created by s.jensen on 6/23/14.
 */
public class DummyUnreachabilityAnalysis<T> implements UnreachabilityAwareAnalysis<T> {

	@Override
	public void init(Timer t, IIDMap iidMap) {

	}

	@Override
    public void functionEnter(int iid, int funId, int callSiteIID, Context newContext, long time) {

    }

    @Override
    public void functionExit(int iid, Context functionContext, Set<String> unReferenced, long time) {

    }

    @Override
    public void create(int iid, int objectId, long time, boolean isDom) {

    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {

    }

    @Override
    public void unreachableObject(int iid, int objectId, long time, int shallowSize) {

    }

    @Override
    public void unreachableContext(int iid, Context ctx, long time) {

    }

    @Override
    public void lastUse(int objectId, int iid, long time) {

    }

    @Override
    public T endExecution(long time) {
        return null;
    }

	@Override
	public void domRoot(int nodeId) {
	}

	@Override
	public void addDOMChild(int parentId, int childId, long time) {
	}

	@Override
	public void removeDOMChild(int parentId, int childId, long time) {
	}

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {

    }

    @Override
    public void write(int iid, String name, int objectId) {

    }

    @Override
    public void declare(int iid, String name, int objectId) {

    }

    @Override
    public void updateIID(int objId, int newIID) {

    }

    @Override
    public void returnStmt(int objId) {

    }

    @Override
    public void debug(int iid, int oid) {

    }

	@Override
	public void scriptEnter(int iid, String filename) {
	}

	@Override
	public void scriptExit(int iid) {
	}

    @Override
    public void topLevelFlush(int iid) {
    }

    @Override
    public void addToChildSet(int iid, int parentId, String name, int childId) {
    }

    @Override
    public void removeFromChildSet(int iid, int parentId, String name, int childId) {
    }

}
