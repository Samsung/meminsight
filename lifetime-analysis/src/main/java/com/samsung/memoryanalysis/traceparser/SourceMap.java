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

import java.util.Map;

import com.ibm.wala.util.collections.HashMapFactory;

public class SourceMap {

    /**
     * a unique identifier for a source location, consisting of a source file ID
     * and and IID within that source file
     *
     */
    public final static class SourceLocId {

        private final int sourceFileId;

        private final int iid;

        public SourceLocId(int sourceFileId, int iid) {
            this.sourceFileId = sourceFileId;
            this.iid = iid;
        }

        @Override
        public int hashCode() {
            final int prime = 31;
            int result = 1;
            result = prime * result + iid;
            result = prime * result + sourceFileId;
            return result;
        }

        @Override
        public boolean equals(Object obj) {
            if (this == obj)
                return true;
            if (obj == null)
                return false;
            if (getClass() != obj.getClass())
                return false;
            SourceLocId other = (SourceLocId) obj;
            if (iid != other.iid)
                return false;
            if (sourceFileId != other.sourceFileId)
                return false;
            return true;
        }

        public int getSourceFileId() {
            return sourceFileId;
        }

        public int getIid() {
            return iid;
        }

        public String toString() {
            return (new StringBuilder()).append(sourceFileId).append(':')
                    .append(iid).toString();
        }

    }

    public static final int DUMMY_SID = 0;

	public static final SourceLocId END_OF_PROGRAM_ID = new SourceLocId(DUMMY_SID, 0);
	public static final SourceLocId UNKNOWN_ID = new SourceLocId(DUMMY_SID, -1);
	public static final SourceLocId INITIAL_DOM_ID = new SourceLocId(DUMMY_SID, -2);


	/**
	 * Initializes an IIDMap based on the sourcemap file in a given trace directory.
	 * If sourcemap file does not exist, an empty IIDMap is returned.
	 */
//	public static SourceMap parseIIDFile(File traceDirectory) {
//        File jsonObject = new File(traceDirectory, "jalangi_sourcemap.json");
//        BufferedReader in;
//        JsonObject json;
//		Map<Integer, SourceLocation> result = HashMapFactory.make();
//		// set up special entries
//		result.put(0, SourceLocation.END_OF_PROGRAM);
//		result.put(-1, SourceLocation.UNKNOWN);
//		result.put(-2, SourceLocation.INITIAL_DOM);
//		if (jsonObject.exists()) {
//	        try {
//	            in = new BufferedReader(new FileReader(jsonObject));
//	            json = new JsonParser().parse(in).getAsJsonArray().get(0).getAsJsonObject();
//	        } catch (IOException e) {
//	            throw new IllegalArgumentException("Error reading jalangi_sourcemap.json", e);
//	        } catch (JsonParseException e) {
//	            throw new IllegalArgumentException("Parser error in jalangi_sourcemap.json", e);
//	        }
//	        for (Map.Entry<String,JsonElement> keyO : json.entrySet()) {
//	            String key = keyO.getKey();
//	            JsonArray entry = keyO.getValue().getAsJsonArray();
//	            String file = entry.get(0).getAsString();
//	            Long startLine = entry.get(1).getAsLong();
//	            Long startColumn = entry.get(2).getAsLong();
//                Long endLine = entry.get(3).getAsLong();
//                Long endColumn = entry.get(4).getAsLong();
//	            result.put(Integer.parseInt(key), new SourceLocation(file,startLine,startColumn,endLine,endColumn));
//	        }
//		}
//        return new SourceMap();
//	}

	public static SourceMap empty() {
	    return new SourceMap();
	}

	private final Map<SourceLocId, SourceLocation> iid2SourceLoc = HashMapFactory.make();

	private final Map<Integer, String> sid2FileName = HashMapFactory.make();


	public void addScriptMapping(int sid, String filename) {
	    sid2FileName.put(sid, filename);
	}

	public SourceLocation get(SourceLocId slID) {
		SourceLocation result = iid2SourceLoc.get(slID);
		assert result != null;
		return result;
	}

	public void addMapping(SourceLocId slID, int startLine, int startColumn, int endLine, int endColumn) {
	    int sid = slID.getSourceFileId();
	    if (iid2SourceLoc.containsKey(slID)) {
	        throw new IllegalArgumentException("already have a mapping for SourceLocId " + slID);
	    }
	    if (!sid2FileName.containsKey(sid)) {
	        throw new IllegalArgumentException("unknown script id " + sid);
	    }
	    SourceLocation loc = new SourceLocation(sid2FileName.get(sid), startLine, startColumn, endLine, endColumn);
	    iid2SourceLoc.put(slID, loc);
	}
}
