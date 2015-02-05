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
///<reference path='../ts-declarations/node.d.ts' />
///<reference path='../ts-declarations/jalangi.d.ts' />
///<reference path='../ts-declarations/websocket.d.ts' />
///<reference path='../ts-declarations/rewriting-proxy.d.ts' />
///<reference path='../ts-declarations/mkdirp.d.ts' />

/**
 * Created by m.sridharan on 5/29/14.
 */

import websocket = require('websocket');
import http = require('http');
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import proxy = require('rewriting-proxy');
import urlparser = require('url');
import instUtil = require('jalangi2/src/js/instrument/instUtil');
import memTracer = require('./../analysis/memTraceAPI');
import bufUtil = require('./../analysis/bufferUtil');
import mkdirp = require('mkdirp');
import lifetimeAnalysis = require('./../gui/lifetimeAnalysisAPI')
import assert = require('assert');

var serveStatic : any = require('serve-static');
var finalhandler : any = require('finalhandler');

var WebSocketServer = websocket.server;

var PROTOCOL_NAME = 'mem-trace-protocol';

var javaProc : cp.ChildProcess;
var outputStream: fs.WriteStream;


/**
 * utility function used by the websocket server.
 * currently does nothing
 */
function originIsAllowed(origin: string) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Integrated server for memory profiler"
});
parser.addArgument(['--proxy'], { help: "run as a proxy server, instrumenting code on-the-fly", action:'storeTrue' });
parser.addArgument(['--proxyOutput'], { help: "in proxy server mode, directory under which to store instrumented code", defaultValue: '/tmp/proxyOut' });
parser.addArgument(['--noHTTPServer'], { help: "don't start up a local HTTP server", action: 'storeTrue'});
parser.addArgument(['--outputFile'], { help: "write generated trace to a file, instead of sending to lifetime analysis"});
parser.addArgument(['app'], { help: "the app to serve.  in proxy mode, the app should be uninstrumented.", nargs: 1});
var args = parser.parseArgs();

var app = args.app[0];

// default to app directory; we'll change it in proxy server mode
var outputDir = app;

/**
 * create a fresh directory in which to dump instrumented scripts
 */
function initProxyOutputDir(): void {
    outputDir = args.proxyOutput;
    var scriptDirToTry = "";
    for (var i = 0; i < 100; i++) {
        scriptDirToTry = path.join(outputDir, "/site" + i);
        if (!fs.existsSync(scriptDirToTry)) {
            break;
        }
    }
    // create the directory, including parents
    mkdirp.sync(scriptDirToTry);
    console.log("writing output to " + scriptDirToTry);
    outputDir = scriptDirToTry;
}

/**
 * initializes the output target, either the Java process or a WriteStream for a file
 */
function initOutputTarget(): void {
    if (args.outputFile) {
        if (outputStream) {
            // already initialized
            return;
        }
        outputStream = fs.createWriteStream(args.outputFile);
    } else {
        if (javaProc) {
            // already initialized
            return;
        }
        console.log("running lifetime analysis");
        javaProc = lifetimeAnalysis.runLifetimeAnalysis(outputDir);
        javaProc.stdout.on("data", (chunk : any) => {
            console.log(chunk.toString());
        });
        javaProc.stderr.on("data", (chunk : any) => {
            console.error(chunk.toString());
        });
        javaProc.on("exit", () => {
            console.log("done");
            process.exit(0);
//            showGui();
        });
    }
}

var recordServer : http.Server;
function record() {
    var port = 8080;
    var outputDir = '.';
    recordServer = http.createServer(function(request: http.ServerRequest, response: http.ServerResponse) {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();

    });
    recordServer.listen(port, function() {
        console.log((new Date()) + ' Server is listening on port ' + port);
    });

    var wsServer = new WebSocketServer({
        httpServer: recordServer
    });
    wsServer.on('request', function(request) {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
            return;
        }

        var connection = request.accept(PROTOCOL_NAME, request.origin);
        console.log((new Date()) + ' Connection accepted.');
        connection.on('message', function(message: any) {
            if (message.type === 'utf8') {
                var stringMsg = message.utf8Data;

                if (stringMsg === 'startup') {
                    initOutputTarget();
                } else {
                }
            } else if (message.type === 'binary') {
                // node.js will buffer in RAM if data isn't written yet
                // TODO do our own buffering via the callback?
                var binaryMsg = message.binaryData;
                if (args.outputFile) {
                    outputStream.write(binaryMsg);
                } else {
                    javaProc.stdin.write(binaryMsg);
                }
                connection.sendUTF("done");
            }
        });
        connection.on('close', function(reasonCode: any, description: any) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. '+reasonCode+" "+description);
            if (args.outputFile) {
                outputStream.end("", function () { console.log("done writing log")});
            } else {
                process.stdout.write("completing lifetime analysis...");
                javaProc.stdin.end();
            }
        });
    });

}


var appServer : http.Server;
function showApp() {
    var serve = serveStatic(app, {'index': ['index.html', 'index.htm']});

    appServer = http.createServer(function(req, res){
        var done = finalhandler(req, res);
        serve(req, res, done);
    });
    appServer.listen(8888, function () {
        console.log('Serving ' + app + ' on http://localhost:8888')
    })
}

var runGUIServer = function () {
    throw new Error("this code needs to be fixed");
    //process.chdir("../memory-analysis");
    var nodeArgs = ["lib/gui/guiServer.js", path.join(app,"enhanced-trace"), "dummy"];
     cp.spawn("node", nodeArgs,  {
         cwd   : process.cwd(),
         env   : process.env,
         stdio : 'inherit'
     });

    console.log("Showing the results on http://localhost:9000/ Kill with Ctrl-C");
};
var showGui = function () {
    recordServer.close(() => {
        console.log("recorder closed");
    });//Close the trace writer
    runGUIServer();
    appServer.close(() => {  //Close the app
    });
    //TODO Running the GUI from with an API is not possible
    //Just spawn a subprocess for it.
};

////////
// PROXY SERVER CODE
///////

var jalangiRuntimePrefix = "jalangiRuntime/";
var memTracerRuntimePrefix = "memTracerRuntime/";
var memTracerInitCode = "__memTracer__init__.js";
// TODO generalize this
var initCode = "J$.initParams = {};";
var memTracerDir = path.resolve(path.join(__dirname, '..', '..'));
var jalangiDir = path.resolve(path.join(memTracerDir,'node_modules','jalangi'));

function getHeaderURLs(): Array<string> {
    var result: Array<string> = [];
    // set up headers for analysis2
    instUtil.setHeaders(true);
    instUtil.headerSources.forEach((src) => {
        result.push(jalangiRuntimePrefix + src);
    });
    // some initialization code via  a fake URL
    result.push(memTracerInitCode);
    // we also need our own analysis files
    memTracer.browserAnalysisFiles.forEach((src) => {
        result.push(memTracerRuntimePrefix + path.relative(path.join(__dirname, "..", ".."), src));
    });
    return result;
}

// copied from LoggingAnalysis; yuck
// TODO switch to require.js in the browser so we don't need this copy-pasting
// IID special values: -1 is unknown, -2 corresponds to the initial
// DOM traversal to attach mutation observers
enum LogEntryType {
    DECLARE, // fields: iid, name, obj-id
    CREATE_OBJ, // fields: iid, obj-id
    CREATE_FUN, // fields: iid, function-enter-iid, obj-id.  NOTE: proto-obj-id is always obj-id + 1
    PUTFIELD, // fields: iid, base-obj-id, prop-name, val-obj-id
    WRITE, // fields: iid, name, obj-id
    LAST_USE, // fields: obj-id, timestamp, iid
    FUNCTION_ENTER, // fields: iid, function-object-id.  NOTE: only emitted when CALL is not emitted
    FUNCTION_EXIT, // fields: iid
    TOP_LEVEL_FLUSH, // fields: iid
    UPDATE_IID, // fields: obj-id, new-iid
    DEBUG, // fields: call-iid, obj-id
    RETURN, // fields: obj-id
    CREATE_DOM_NODE, // fields: iid, obj-id
    ADD_DOM_CHILD, // fields: parent-obj-id, child-obj-id
    REMOVE_DOM_CHILD, // fields: parent-obj-id, child-obj-id
    ADD_TO_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
    REMOVE_FROM_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
    DOM_ROOT, // fields: obj-id
    CALL, // fields: iid, function-obj-id, function-enter-iid.  NOTE: only emitted for calls to *instrumented* functions
    SCRIPT_ENTER, // fields: iid, filename
    SCRIPT_EXIT, // fields: iid
    FREE_VARS, // fields: iid, array-of-names or ANY
    SOURCE_MAPPING, // fields: iid, filename, startLine, startColumn
}

function sendMetadata(iidSourceInfo: any, freeVars: any): void {
    var result: Array<Buffer> = [];
    var totalLength = 0;
    Object.keys(iidSourceInfo).forEach((iid) => {
        var sourceInfo = iidSourceInfo[iid];
        var len = 1+4*4+sourceInfo[0].length*2;
        var tmpBuf = new bufUtil.BufferManager(len);
        tmpBuf.writeByte(LogEntryType.SOURCE_MAPPING).writeInt(parseInt(iid))
            .writeString(sourceInfo[0]).writeInt(sourceInfo[1]).writeInt(sourceInfo[2]);
        result.push(tmpBuf.buffer);
        totalLength += len;
    });
    Object.keys(freeVars).forEach((iid) => {
        var curVarNames = freeVars[iid];
        var tmpBuf: bufUtil.BufferManager, offset = 0;
        var len: number;
        if (typeof curVarNames === 'string') {
            len = 9+curVarNames.length*2;
            tmpBuf = new bufUtil.BufferManager(len);
            tmpBuf.writeByte(LogEntryType.FREE_VARS)
                .writeInt(parseInt(iid))
                .writeInt(-1)
                .writeString(curVarNames);
        } else { // array of strings
            var arrayByteLength = 4;
            for (var i = 0; i < curVarNames.length; i++) {
                arrayByteLength += 4+curVarNames[i].length*2;
            }
            len = 5+arrayByteLength;
            tmpBuf = new bufUtil.BufferManager(len);
            tmpBuf.writeByte(LogEntryType.FREE_VARS)
                .writeInt(parseInt(iid))
                .writeInt(curVarNames.length);
            for (var i = 0; i < curVarNames.length; i++) {
                tmpBuf.writeString(curVarNames[i]);
            }
        }
        result.push(tmpBuf.buffer);
        totalLength += len;
    });
    var finalBuffer = Buffer.concat(result,totalLength);
    if (args.outputFile) {
        outputStream.write(finalBuffer);
    } else {
        javaProc.stdin.write(finalBuffer);
    }
}

function startProxy(): void {
    initProxyOutputDir();
    // just get the Java process running so it's ready when we start instrumenting
    initOutputTarget();
    var headerURLs = getHeaderURLs();
    throw new Error("this code needs to be fixed");
    // blow away source map files if they exist in temp dir
    //["jalangi_sourcemap.js", "jalangi_sourcemap.json", "jalangi_initialIID.json"].forEach((file) => {
    //    var thePath = path.join(outputDir,file);
    //    if (fs.existsSync(thePath)) {
    //        fs.unlinkSync(thePath);
    //    }
    //});
    var rewriter = (src: string, metadata: proxy.RewriteMetadata) => {
        var url = metadata.url;
        console.log("instrumenting " + url);
        var basename = instUtil.createFilenameForScript(url);
        var filename = path.join(outputDir, basename);
        // TODO check for file conflicts and handle appropriately
        fs.writeFileSync(filename, src);

        var instFileName = basename.replace(new RegExp(".js$"), "_jalangi_.js");

        var options = {
            inputFileName: basename,
            outputFile: instFileName,
            dirIIDFile: outputDir
        };
        var instResult = memTracer.instScriptAndGetMetadata(src, options);
        fs.writeFileSync(path.join(outputDir, instFileName), instResult.instCode);
        assert(false, "TODO: fix this code!");
//        sendMetadata(instResult.iidSourceInfo, instResult.freeVars);
        return instResult.instCode;
    };
    var intercept = (url: string): string => {
        var parsedPath = urlparser.parse(url).path;
        if (parsedPath.indexOf(memTracerInitCode) !== -1) {
            return initCode;
        }
        var filePath: string = null;
        if (parsedPath.indexOf(jalangiRuntimePrefix) !== -1) {
            // serve from Jalangi directory
            filePath = path.join(jalangiDir, parsedPath.substring(jalangiRuntimePrefix.length+1));

        } else if (parsedPath.indexOf(memTracerRuntimePrefix) !== -1){
            // serve from parent's parent
            filePath = path.join(memTracerDir, parsedPath.substring(memTracerRuntimePrefix.length+1));
        }
        if (filePath !== null) {
            console.log("serving " + filePath);
        }
        return filePath ? String(fs.readFileSync(filePath)) : null;
    };
    var port = 8501;
    proxy.start({ headerURLs: headerURLs, rewriter: rewriter, intercept: intercept, port: port, noInstRegExp: new RegExp("localhost:9000") });
    console.log("proxy server running on port " + port);
}

if (args.proxy) {
    startProxy();
}
if (!args.noHTTPServer) {
    showApp();
}
record();
