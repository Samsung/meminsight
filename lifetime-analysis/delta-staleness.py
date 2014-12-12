#
# Copyright (c) 2014 Samsung Electronics Co., Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import sys
import os
import tempfile
import shutil
import subprocess

annex = True

def gen_wrapper_html(js_files,inline=None):
    script_tags = ["<script src=\"%s\"></script>"%os.path.basename(x) for x in js_files]
    # create dummy HTML file loading js_file in /tmp
    html = "<html><head></head><body>"
    if inline != None:
        html += "<script>" + inline + "</script>"
    html += "%s</body></html>"%"".join(script_tags)
    return html

def gen_wrapper_html_file(js_files, filename,inline=None):
    html = gen_wrapper_html(js_files,inline)
    dummy_file = open(filename, "w")
    dummy_file.write(html)
    dummy_file.close()

arg = os.path.abspath(sys.argv[1])
dir = os.path.dirname(arg)
if annex:
    appTempDir = os.path.abspath("../../annex")
    shutil.copy(arg,os.path.join(appTempDir,"combined.js"))
else:
    appTempDir = tempfile.mkdtemp()
    print "app temp dir " + appTempDir
    shutil.copy(arg,appTempDir)
    gen_wrapper_html_file([arg],os.path.join(appTempDir,'index.html'))
instTempDir = tempfile.mkdtemp()
print "inst temp dir " + instTempDir
genTraceCmd = ['node',
       os.path.join(os.path.dirname(os.path.realpath(__file__)),'../memory-trace/drivers/memTraceDriver.js'),
       '--outputDir',
       instTempDir,
       appTempDir]

sp = subprocess.Popen(genTraceCmd,stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out, err = sp.communicate()
print out
print >> sys.stderr, err

refCountCmd = "java -ea -Dtesting=yes -jar build/libs/memory-analysis-v2-all.jar --staleness --trace".split(' ')
refCountCmd.append(os.path.join(instTempDir,os.path.basename(appTempDir),'mem-trace'))
sp = subprocess.Popen(refCountCmd,stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out, err = sp.communicate()
print out
print >> sys.stderr, err

if not annex:
    shutil.rmtree(appTempDir)
shutil.rmtree(instTempDir)
