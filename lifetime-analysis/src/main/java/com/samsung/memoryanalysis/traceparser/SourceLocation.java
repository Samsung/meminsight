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


/**
 * Created by s.jensen on 6/13/14.
 */
public class SourceLocation {

	/**
	 * If this is a special type of location,
	 * a string description of the location.  Otherwise,
	 * null.
	 */
	private final String specialDesc;

	public static final SourceLocation END_OF_PROGRAM = new SourceLocation("end of program");
	public static final SourceLocation INITIAL_DOM = new SourceLocation("initial DOM");
	public static final SourceLocation UNKNOWN = new SourceLocation("unknown");

    public final String file;
    public final long startLine;
    public final long startColumn;
    public final long endLine;
    public final long endColumn;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        SourceLocation that = (SourceLocation) o;

        if (this.specialDesc != null) {
        	return this.specialDesc.equals(that.specialDesc);
        }

        if (startColumn != that.startColumn) return false;
        if (startLine != that.startLine) return false;
        if (endColumn != that.endColumn) return false;
        if (endLine != that.endLine) return false;
        if (!file.equals(that.file)) return false;

        return true;
    }

    @Override
    public int hashCode() {
    	if (this.specialDesc != null) {
    		return this.specialDesc.hashCode();
    	} else {
            int result = file.hashCode();
            result = 31 * result + (int) (startLine ^ (startLine >>> 32));
            result = 31 * result + (int) (startColumn ^ (startColumn >>> 32));
            result = 31 * result + (int) (endLine ^ (endLine >>> 32));
            result = 31 * result + (int) (endColumn ^ (endColumn >>> 32));
            return result;
    	}
    }

    public SourceLocation(String file, long startLine, long startColumn, long endLine, long endColumn) {
        assert file != null;
        this.file = file;
        this.startLine = startLine;
        this.startColumn = startColumn;
        this.endLine = endLine;
        this.endColumn = endColumn;
        this.specialDesc = null;
    }

    private SourceLocation(String specialDesc) {
    	this.specialDesc = specialDesc;
    	this.file = null;
    	this.startLine = -1;
    	this.startColumn = -1;
    	this.endLine = -1;
    	this.endColumn = -1;
    }

    public boolean isSpecial() {
    	return this.specialDesc != null;
    }

    @Override
    public String toString() {
    	if (this.specialDesc != null) {
    		return this.specialDesc;
    	} else {
    	    StringBuilder result = new StringBuilder();
    	    result.append(file);
    	    result.append(":");
    	    result.append(startLine);
    	    result.append(":");
    	    result.append(startColumn);
    	    result.append(":");
    	    result.append(endLine);
    	    result.append(":");
    	    result.append(endColumn);
    	    return result.toString();
    	}
    }

}
