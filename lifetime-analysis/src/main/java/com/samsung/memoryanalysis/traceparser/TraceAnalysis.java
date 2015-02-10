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

import java.util.Set;

import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;

/**
 * An interface for analyses that are run directly on traces.
 *
 * @author s.jensen
 * @param <T> The return type of the analysis
 */
public interface TraceAnalysis<T> {

    public void init(Timer timer, SourceMap iidMap);

    public void declare(SourceLocId slId, String name, int objectId);

    public void create(SourceLocId slId, int objectId);

    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures);

    public void putField(SourceLocId slId,int baseId, String offset, int objectId);

    public void write(SourceLocId slId, String name, int objectId);

    public void lastUse(int objectId, SourceLocId slId, int time);

    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteId);

    /**
     * Treat this is as toplevel flush.
     * @param iid
     */
    public void functionExit(SourceLocId slId);

    public void topLevelFlush(SourceLocId slId);

    public T endExecution();

    public void updateIID(int objId, SourceLocId newSlID);

    public void debug(SourceLocId slId, int oid);

    public void returnStmt(int retVal);

    public void createDomNode(SourceLocId slId, int o);

    public void addDOMChild(int parent, int child);

    public void removeDOMChild(int parent, int child);

    public void addToChildSet(SourceLocId slId, int parent, String name, int child);

    public void removeFromChildSet(SourceLocId slId, int parent, String name, int child);

    public void domRoot(int nodeId);

	public void scriptEnter(SourceLocId slId, String filename);

	public void scriptExit(SourceLocId slId);

    public void endLastUse();

}
