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
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Dummy {@link ContextAwareAnalysis} that does nothing.
 * Created by s.jensen on 6/10/14.
 */
public class DummyContextAwareAnalysis<T> implements ContextAwareAnalysis<T> {


    @Override
    public void init(Timer timer, ContextListener list, SourceMap iidMap) {

    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId, Context context) {

    }

    @Override
    public void create(SourceLocId slId, int objectId) {

    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures, Context context) {

    }

    @Override
    public void putField(SourceLocId slId, int baseId, String offset, int objectId) {

    }

    @Override
    public void write(SourceLocId slId, String name, int objectId, Context context) {

    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, int time) {

    }

    @Override
    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext) {

    }

    @Override
    public void functionExit(SourceLocId slId, Context calleeContext, Context callerContext, Set<String> unReferenced) {

    }

    @Override
    public void topLevelFlush(SourceLocId slId, Context currentContext) {

    }


    @Override
    public T endExecution(Context global, Set<String> unreachableGlobals) {
        return null;
    }



    @Override
    public void updateIID(int objId, SourceLocId newIID) {

    }

    @Override
    public void debug(SourceLocId slId, int oid, Context currentContext) {

    }


    @Override
    public void returnStmt(int objId) {

    }

    @Override
    public void createDomNode(SourceLocId slId, int objectId) {

    }

    @Override
    public void addDOMChild(int parentId, int childId) {

    }

    @Override
    public void removeDOMChild(int parentId, int childId) {

    }

	@Override
	public void addToChildSet(SourceLocId slId, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
	}

	@Override
	public void removeFromChildSet(SourceLocId slId, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
	}

	@Override
	public void domRoot(int nodeId) {
	}

	@Override
	public void scriptEnter(SourceLocId slId, String filename) {
	}

	@Override
	public void scriptExit(SourceLocId slId) {
	}

    @Override
    public void endLastUse() {
    }

}
