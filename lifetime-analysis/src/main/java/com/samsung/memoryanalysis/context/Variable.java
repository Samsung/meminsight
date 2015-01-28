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


/**
 *
 * @author s.jensen
 */
public class Variable {
    private int value;
    private boolean referencedByClosure = false;

    public Variable(int valueId) {
        this.value = valueId;
    }

    @Override
    public String toString() {
        return "Variable{" + value +'}';
    }

    public int getValue() {
        return value;
    }

    public void setValue(int value) {
        this.value = value;
    }

    public void makeReferenced() {
        this.referencedByClosure = true;
    }

    public boolean isReferenced() {
        return this.referencedByClosure;
    }
}
