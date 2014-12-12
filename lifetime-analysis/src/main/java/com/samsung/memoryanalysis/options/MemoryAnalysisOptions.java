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
package com.samsung.memoryanalysis.options;

import java.util.Map;

/**
 * Created by s.jensen on 6/17/14.
 */
public class MemoryAnalysisOptions {

    private boolean moduleScope = false;

    public boolean isIgnoreArguments() {
        return ignoreArguments;
    }

    public void setIgnoreArguments(boolean ignoreArguments) {
        this.ignoreArguments = ignoreArguments;
    }

    /**
     * cycle queue limit, or -1 for no set limit
     * @return
     */
    public int getCycleQueuelimit() {
        return cycleQueueLimit;
    }

    private boolean ignoreArguments = true;

    public void setCycleQueueLimit(int cycleQueueLimit) {
        this.cycleQueueLimit = cycleQueueLimit;
    }

    private int cycleQueueLimit = -1;

    public void setAccessPathObjects(Map<Integer, Integer> accessPathObjects) {
        this.accessPathObjects = accessPathObjects;
    }

    private Map<Integer,Integer> accessPathObjects = null;

    public Map<Integer,Integer> getAccessPathObjects() {
        return accessPathObjects;
    }

    public void setModuleScope() {
        this.moduleScope = true;
    }

    public boolean isModuleScope() {
        return moduleScope;
    }
}
