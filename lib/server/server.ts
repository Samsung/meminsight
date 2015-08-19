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
///<reference path='../ts-declarations/mkdirp.d.ts' />

/**
 * Created by m.sridharan on 5/29/14.
 */

import websocket = require('websocket');
import http = require('http');
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
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
parser.addArgument(['--noHTTPServer'], { help: "don't start up a local HTTP server", action: 'storeTrue'});
parser.addArgument(['--outputFile'], { help: "name for output file for memory trace (default mem-trace in app directory)" });
parser.addArgument(['app'], { help: "the app to serve.  if --noHTTPServer is passed, directory of the uninstrumented app, or where app code will be stored (if a proxy server is being used)", nargs: 1});
var args: { noHTTPServer: string; app: Array<string>; outputFile: string; } = parser.parseArgs();

var app = args.app[0];

var outputDir = app;

/**
 * initializes the output target, both a Java process and a WriteStream for a file
 */
function initOutputTarget(): void {
    if (!outputStream) {
        var outputFileName = args.outputFile;
        if (!outputFileName) {
            outputFileName = path.join(outputDir, 'mem-trace');
        }
        outputStream = fs.createWriteStream(outputFileName);
    }
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
                outputStream.write(binaryMsg);
                javaProc.stdin.write(binaryMsg);
                connection.sendUTF("done");
            }
        });
        connection.on('close', function(reasonCode: any, description: any) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. '+reasonCode+" "+description);
            outputStream.end("", function () { console.log("done writing log")});
            process.stdout.write("completing lifetime analysis...");
            javaProc.stdin.end();
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
    outputStream.write(finalBuffer);
    javaProc.stdin.write(finalBuffer);
}

if (!args.noHTTPServer) {
    showApp();
}
record();
