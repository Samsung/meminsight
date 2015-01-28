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
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Created by s.jensen on 6/23/14.
 */
public interface UnreachabilityAwareAnalysis <T> {

    public void init(Timer timer, final SourceMap iidMap);

    public void declare(SourceLocId slId, String name, int objectId);

    public void create(SourceLocId slId, int objectId, long time, boolean isDom);

    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID ,Set<String> namesReferencedByClosures, Context context, long time);

    public void putField(SourceLocId slId, int baseId, String offset, int objectId);

    public void write(SourceLocId slId, String name, int objectId);

    public void lastUse(int objectId, SourceLocId slId, long time);

    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext, long time);

    public void functionExit(SourceLocId slId, Context functionContext, Set<String> unReferenced, long time);

    public void topLevelFlush(SourceLocId slId);

    public void updateIID(int objId, SourceLocId newIID);

    public void debug(SourceLocId slId, int oid);

    public void returnStmt(int objId);

    public void addDOMChild(int parentId, int childId, long time);

    public void removeDOMChild(int parentId, int childId, long time);

    public void addToChildSet(SourceLocId slId, int parentId, String name, int childId);

    public void removeFromChildSet(SourceLocId slId, int parentId, String name, int childId);

    public void domRoot(int nodeId);

    public void scriptEnter(SourceLocId slId, String filename);

    public void scriptExit(SourceLocId slId);

    public void unreachableObject(SourceLocId slId, int objectId, long time, int shallowSize);

    public void unreachableContext(SourceLocId slId, Context ctx, long  time);

    public T endExecution(long time);

}
