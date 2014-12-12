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

import http = require('http');
import fs = require('fs');

var finalhandler = require('finalhandler')
var serveStatic = require('serve-static')

var appDir = process.argv[2];

console.log("app dir " + appDir);
// Serve up public/ftp folder
var serve = serveStatic(appDir);

var OUTPUT_FILE_NAME = 'mem-trace';
var PROTOCOL_NAME = 'mem-trace-protocol';

function sendEmptyResponse(response:http.ServerResponse) {
    response.writeHead(200, {'content-type': 'text/plain' });
    response.end();
}

function start() {
    var port = 8080;
    var outputDir = '.';
    var writeStream : fs.WriteStream;
    var server = http.createServer(function (request:http.ServerRequest, response:http.ServerResponse) {
//        console.log((new Date()) + ' Received request for ' + request.url);
//        response.writeHead(404);
//        response.end();
        var handled = false;
        if (request.method === 'POST') {
            handled = true;
            var url = request.url;
            if (url === '/__jalangi_startup__') {
                console.log("starting up");
                writeStream = fs.createWriteStream(OUTPUT_FILE_NAME);
                sendEmptyResponse(response);
            } else if (url === '/__jalangi_close__') {
                writeStream.end("", function () {
                    console.log("done writing log")
                });
                sendEmptyResponse(response);
            } else if (url === '/__jalangi_mem_trace__') {
                var data = '';
                request.on('data', function (chunk:string) {
                    data += chunk;
                });
                request.on('end', function () {
                    writeStream.write(data);
                    sendEmptyResponse(response);
                })
            } else {
                handled = false;
            }
        }
        if (!handled) {
            var done = finalhandler(request, response);
            serve(request, response, done);
        }
    });
    server.listen(port, function () {
        console.log((new Date()) + ' Server is listening on port ' + port);
    });
}

start();