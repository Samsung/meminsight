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
public interface UnreachabilityAwareAnalysis <T> {

    public void init(Timer timer, final IIDMap iidMap);

    public void declare(int iid, String name, int objectId);

    public void create(int iid, int objectId, long time, boolean isDom);

    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID ,Set<String> namesReferencedByClosures, Context context, long time);

    public void putField(int iid, int baseId, String offset, int objectId);

    public void write(int iid, String name, int objectId);

    public void lastUse(int objectId, int iid, long time);

    public void functionEnter(int iid, int funId, int callSiteIID, Context newContext, long time);

    public void functionExit(int iid, Context functionContext, Set<String> unReferenced, long time);

    public void topLevelFlush(int iid);

    public void updateIID(int objId, int newIID);

    public void debug(int iid, int oid);

    public void returnStmt(int objId);

    public void addDOMChild(int parentId, int childId, long time);

    public void removeDOMChild(int parentId, int childId, long time);

    public void addToChildSet(int iid, int parentId, String name, int childId);

    public void removeFromChildSet(int iid, int parentId, String name, int childId);

    public void domRoot(int nodeId);

    public void scriptEnter(int iid, String filename);

    public void scriptExit(int iid);

    public void unreachableObject(int iid, int objectId, long time, int shallowSize);

    public void unreachableContext(int iid, Context ctx, long  time);

    public T endExecution(long time);

}
