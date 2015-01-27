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
/*
 * Copyright 2014 Samsung Information Systems America, Inc.
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

/**
 * An interface for analyses that are run directly on traces.
 *
 * @author s.jensen
 * @param <T> The return type of the analysis
 */
public interface TraceAnalysis<T> {

    public void init(Timer timer, IIDMap iidMap);

    public void declare(int iid, String name, int objectId);

    public void create(int iid, int objectId);

    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures);

    public void putField(int iid,int baseId, String offset, int objectId);

    public void write(int iid, String name, int objectId);

    public void lastUse(int objectId, int iid, int time);

    public void functionEnter(int iid, int funId, int callSiteIID);

    /**
     * Treat this is as toplevel flush.
     * @param iid
     */
    public void functionExit(int iid);

    public void topLevelFlush(int iid);

    public T endExecution();

    public void updateIID(int objId, int newIID);

    public void debug(int iid, int oid);

    public void returnStmt(int retVal);

    public void createDomNode(int iid, int o);

    public void addDOMChild(int parent, int child);

    public void removeDOMChild(int parent, int child);

    public void addToChildSet(int iid, int parent, String name, int child);

    public void removeFromChildSet(int iid, int parent, String name, int child);

    public void domRoot(int nodeId);

	public void scriptEnter(int iid, int sid, String filename);

	public void scriptExit(int iid);

}
