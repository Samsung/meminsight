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
package com.samsung.memoryanalysis.context;

import java.util.Set;

import com.samsung.memoryanalysis.referencecounter.heap.ContextOrObjectId;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Dummy {@link ContextAwareAnalysis} that does nothing.
 * Created by s.jensen on 6/10/14.
 */
public class DummyContextAwareAnalysis<T> implements ContextAwareAnalysis<T> {


    @Override
    public void init(Timer timer, ContextListener list, IIDMap iidMap) {

    }

    @Override
    public void declare(int iid, String name, int objectId, Context context) {

    }

    @Override
    public void create(int iid, int objectId) {

    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures, Context context) {

    }

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {

    }

    @Override
    public void write(int iid, String name, int objectId, Context context) {

    }

    @Override
    public void lastUse(int objectId, int iid, int time) {

    }

    @Override
    public void functionEnter(int iid, int funId, int callSiteIID, Context newContext) {

    }

    @Override
    public void functionExit(int iid, Context calleeContext, Context callerContext, Set<String> unReferenced) {

    }

    @Override
    public void topLevelFlush(int iid, Context currentContext) {

    }


    @Override
    public T endExecution(Context global, Set<String> unreachableGlobals) {
        return null;
    }



    @Override
    public void updateIID(int objId, int newIID) {

    }

    @Override
    public void debug(int iid, int oid, Context currentContext) {

    }


    @Override
    public void returnStmt(int objId) {

    }

    @Override
    public void createDomNode(int iid, int objectId) {

    }

    @Override
    public void addDOMChild(int parentId, int childId) {

    }

    @Override
    public void removeDOMChild(int parentId, int childId) {

    }

	@Override
	public void addToChildSet(int iid, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
	}

	@Override
	public void removeFromChildSet(int iid, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
	}

	@Override
	public void domRoot(int nodeId) {
	}

	@Override
	public void scriptEnter(int iid, int sid, String filename) {
	}

	@Override
	public void scriptExit(int iid) {
	}

}
