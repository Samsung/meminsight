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
package com.samsung.memoryanalysis;

import static org.junit.Assert.assertEquals;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.util.List;
import java.util.Scanner;

import org.junit.Test;

/**
 * Created by s.jensen on 6/25/14.
 */
public abstract class AbstractTester {


    final static String TESTDATA = "test/traces";
    final static File EXPECTED = new File("test/expected");
    private final TestCaseInfo testCaseInfo;
    private PrintStream old = null;

    public AbstractTester(TestCaseInfo file) {
        this.testCaseInfo = file;
    }

    protected abstract String runAnalysis(File trace) throws Exception;

    public StringBuilder redirect() {
        old = System.out;
        final StringBuilder res = new StringBuilder();
        System.setOut(new PrintStream(new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                res.append(Character.toChars(b));
            }
        }));
        return res;
    }
    protected static void addMatchingHTML(File dir, List<Object[]> res, String htmlPref) throws IOException {
        File[] files = dir.listFiles();
        for (File f : files) {
            if (f.getName().startsWith(htmlPref)) {
                res.add(new Object[]{new HTMLTestCaseInfo(f)});
            }
        }
//        Files.newDirectoryStream(dir, e -> e.getFileName().toString().startsWith(htmlPref))
//                .forEach(tc -> res.add(new Object[]{new HTMLTestCaseInfo(tc)}));
    }

    protected static void addMatchingJS(File dir, List<Object[]> res, String pref) throws IOException {
        File[] files = dir.listFiles();
        for (File f : files) {
            if (f.getName().startsWith(pref)) {
                res.add(new Object[]{new JSTestCaseInfo(f)});
            }
        }
//        Files.newDirectoryStream(dir, e -> e.getFileName().toString().startsWith(pref))
//                .forEach(tc -> res.add(new Object[]{new JSTestCaseInfo(tc)}));
    }
    public void revert() {
        System.setOut(old);
    }

    @Test
    public void doCompare() throws Exception {
        File trace = new File(testCaseInfo.dir, "mem-trace");
        String output = runAnalysis(trace).trim();
        if (!EXPECTED.exists()) {
            EXPECTED.mkdir();
        }
        File exp = new File(EXPECTED, getExpectedFileName(testCaseInfo));
        if (exp.exists()) {
            String expected = readFile(exp);
            assertEquals(expected, output);
        } else {
            writeStringToFile(output, exp);
        }
    }

	private void writeStringToFile(String output, File exp) throws FileNotFoundException {
	    PrintWriter out = new PrintWriter(exp);
	    try {
	        out.print(output);
	    } finally {
	        out.close();
	    }
    }

    private String readFile(File file) throws FileNotFoundException {
	    StringBuilder fileContents = new StringBuilder((int)file.length());
	    Scanner scanner = new Scanner(file);
	    String lineSeparator = "\n";

	    try {
	        while(scanner.hasNextLine()) {
	            fileContents.append(scanner.nextLine());
	            if (scanner.hasNextLine()) {
	                fileContents.append(lineSeparator);
	            }
	        }
	        return fileContents.toString();
	    } finally {
	        scanner.close();
	    }
    }

    protected String getExpectedFileName(TestCaseInfo tcInfo) {
		return tcInfo.name + ".expected";
	}

    static abstract class TestCaseInfo {
        public File dir;
        public String name;

        @Override
        public String toString() {
            return name;
        }
    }

    static class JSTestCaseInfo extends TestCaseInfo {

        public JSTestCaseInfo(File dir) {
            this.dir = dir;
            String filename = dir.getName();
            this.name = filename.substring(0, filename.length() - 5);
        }
    }

    static class HTMLTestCaseInfo extends TestCaseInfo {

        public HTMLTestCaseInfo(File dir) {
            this.dir = dir;
            this.name = dir.getName().toString();
        }
    }
}
