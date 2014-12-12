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

import java.util.*;

import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;

/**
 * Created by s.jensen on 7/5/14.
 */
public class FreeVariables {
    private final Map<Integer, Set<String>> fvMap;

    public static final Set<String> ANY = HashSetFactory.make();

    protected FreeVariables() {
        fvMap = HashMapFactory.make();
    }

    /**
     * Returns the set of identifiers referenced lexically in the function.
     * If dynamic code evaluation takes place, the special value FreeVariables.ANY
     * is returned.
     */
    public Set<String> getFreeVariables(int iid) {
        return fvMap.get(iid);
    }

    public void put(int iid, Set<String> freeVars) {
        fvMap.put(iid, freeVars);
    }
}
