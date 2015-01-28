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

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.Map;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import com.ibm.wala.util.collections.HashMapFactory;

public class IIDMap {

	public static final int END_OF_PROGRAM_IID = 0;
	public static final int UNKNOWN_IID = -1;
	public static final int INITIAL_DOM_IID = -2;


	/**
	 * Initializes an IIDMap based on the sourcemap file in a given trace directory.
	 * If sourcemap file does not exist, an empty IIDMap is returned.
	 */
	public static IIDMap parseIIDFile(File traceDirectory) {
        File jsonObject = new File(traceDirectory, "jalangi_sourcemap.json");
        BufferedReader in;
        JsonObject json;
		Map<Integer, SourceLocation> result = HashMapFactory.make();
		// set up special entries
		result.put(0, SourceLocation.END_OF_PROGRAM);
		result.put(-1, SourceLocation.UNKNOWN);
		result.put(-2, SourceLocation.INITIAL_DOM);
		if (jsonObject.exists()) {
	        try {
	            in = new BufferedReader(new FileReader(jsonObject));
	            json = new JsonParser().parse(in).getAsJsonArray().get(0).getAsJsonObject();
	        } catch (IOException e) {
	            throw new IllegalArgumentException("Error reading jalangi_sourcemap.json", e);
	        } catch (JsonParseException e) {
	            throw new IllegalArgumentException("Parser error in jalangi_sourcemap.json", e);
	        }
	        for (Map.Entry<String,JsonElement> keyO : json.entrySet()) {
	            String key = keyO.getKey();
	            JsonArray entry = keyO.getValue().getAsJsonArray();
	            String file = entry.get(0).getAsString();
	            Long startLine = entry.get(1).getAsLong();
	            Long startColumn = entry.get(2).getAsLong();
                Long endLine = entry.get(3).getAsLong();
                Long endColumn = entry.get(4).getAsLong();
	            result.put(Integer.parseInt(key), new SourceLocation(file,startLine,startColumn,endLine,endColumn));
	        }
		}
        return new IIDMap(result);
	}

	public static IIDMap empty() {
	    return new IIDMap(HashMapFactory.<Integer,SourceLocation>make());
	}

	private final Map<Integer, SourceLocation> iid2SourceLoc;

	private final Map<Integer, String> sid2FileName = HashMapFactory.make();


	private IIDMap(Map<Integer, SourceLocation> map) {
		this.iid2SourceLoc = map;
	}

	public void addScriptMapping(int sid, String filename) {
	    sid2FileName.put(sid, filename);
	}

	public SourceLocation get(final int iid) {
		SourceLocation result = iid2SourceLoc.get(iid);
		assert result != null;
		return result;
	}

	public void addMapping(int iid, int sid, int startLine, int startColumn, int endLine, int endColumn) {
	    if (iid2SourceLoc.containsKey(iid)) {
	        throw new IllegalArgumentException("already have a mapping for IID " + iid);
	    }
	    if (!sid2FileName.containsKey(sid)) {
	        throw new IllegalArgumentException("unknown script id " + sid);
	    }
	    SourceLocation loc = new SourceLocation(sid2FileName.get(sid), startLine, startColumn, endLine, endColumn);
	    iid2SourceLoc.put(iid, loc);
	}
}
