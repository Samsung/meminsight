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
 * Interface for analyses that needs context information.
 *
 * Created by s.jensen on 6/10/14.
 */
public interface ContextAwareAnalysis<T> {

    public void init(Timer timer, ContextListener list, SourceMap iidMap);

    public void declare(SourceLocId slId, String name, int objectId, Context context);

    public void create(SourceLocId slId, int objectId);

    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures, Context context);

    public void putField(SourceLocId slId,int baseId, String offset, int objectId);

    public void write(SourceLocId slId, String name, int objectId, Context context);

    public void lastUse(int objectId, SourceLocId slId, int time);

    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext);

    /**
     * Treat this is as toplevel flush.
     * @param iid
     * @param unReferenced The set of name no longer referenced by this context.
     */
    public void functionExit(final SourceLocId slId, final Context calleeContext, final Context callerContext, final Set<String> unReferenced);

    public void topLevelFlush(SourceLocId slId, Context currentContext);

    public T endExecution(Context global, Set<String> unreachableGlobals);

    public void updateIID(int objId, SourceLocId newIID);

    public void debug(SourceLocId slId, int oid, Context currentContext);

    public void returnStmt(int objId);

    public void createDomNode(SourceLocId slId, int objectId);

    public void addDOMChild(int parentId, int childId);

    public void removeDOMChild(int parentId, int childId);

	public void addToChildSet(SourceLocId slId, ContextOrObjectId parentNode, String name, ContextOrObjectId childNode);

	public void removeFromChildSet(SourceLocId slId, ContextOrObjectId parentNode, String name, ContextOrObjectId childNode);

	public void domRoot(int nodeId);

	public void scriptEnter(SourceLocId slId, String filename);

	public void scriptExit(SourceLocId slId);

	public void endLastUse();
}
