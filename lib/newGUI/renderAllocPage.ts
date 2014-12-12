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
///<reference path='../ts-declarations/jquery.d.ts' />
///<reference path='../ts-declarations/codemirror.d.ts' />
///<reference path='../ts-declarations/jstree.d.ts' />
///<reference path='../ts-declarations/d3.d.ts' />
///<reference path='./guiUtil.ts' />


/**
 * Created by m.sridharan on 10/5/14.
 */

function renderAllocPage(site: string): void {

    var encodedSite = encodeURIComponent(site);

    function initHeader() {
        $('title').text(formatSourceLoc(site));
        var split = site.split(":");
        $('#allocheader').append('<h3>Allocation at ' + split[0] + ', line ' + (parseInt(split[1])) + '</h3>\n');
    }

    initHeader();

    var allocRowsInitialized = false;

    var myCodeMirror: CodeMirror.EditorFromTextArea = null;

    function initAllocRows(): void {
        $('#sourceviewcontainer').append("<div id=\"sourceviewheader\" style=\"text-align: center\"></div>\n" +
            "<textarea id=\"sourceview\"></textarea>");
        $('#sitetimelinecontainer').append("<div style=\"text-align: center\"><p class=\"lead\">Timeline</p>" +
            "<p>Click on any time point to show retaining access paths.</p></div>" +
            "<div id=\"sitetimeline\"></div>");
        $('#calltreecontainer').append("<div style=\"text-align: center\"><p class=\"lead\">Call Tree</p></div>" +
            "<div id=\"calltree\"></div>");
        $('#accesspathcontainer').append("<div style=\"text-align: center\"><p class=\"lead\">Access Paths</p></div>" +
            "<div id=\"accesspaths\"></div>");

        myCodeMirror = CodeMirror.fromTextArea(<HTMLTextAreaElement>document.getElementById('sourceview'), {
            readOnly: true,
            lineNumbers: true
        });
    }

    function addTreeLabels(treeData: any, labeler: (node: any) => string) {
        treeData.text = labeler(treeData);
        if (treeData.children) {
            treeData.children.forEach((child: any) => {
                addTreeLabels(child, labeler);
            })
        }
    }

    var EXPANSION_WEIGHT = 0.95;
    /**
     * look at first child.  if its weight
     * is > some threshold percentage of node, expand node, and recurse to first child.
     * @param node
     */
    function expandHeavyChildren(node: any, treedata: any): void {
        var nodeCount = node.original.count;
        if (node.children && node.children.length > 0) {
            var firstChildId = node.children[0];
            var firstChild = treedata.instance.get_node(firstChildId);
            if ((firstChild.original.count / nodeCount) > EXPANSION_WEIGHT) {
                // TODO there must be a more efficient way to do this...
                $('#calltree').jstree('open_node', node);
                expandHeavyChildren(firstChild, treedata);

            }
        }
    }

    var callTreeRootName = "calltreeroot";

    function renderCallTree(treeData: any) {
        addTreeLabels(treeData, (node) => {
            return "(" + node.count + ") " + formatSourceLoc(node.root);
        });
        treeData.id = callTreeRootName;
        var selection = $('#calltree');
        selection.jstree({ 'core': {
            'data': [treeData]
        }}).on('changed.jstree', (e: any, data: any) => {
            var selected = data.selected[0];
            var callSite = data.instance.get_node(selected).original.root;
            highlightSrcLoc(callSite);
        }).on('open_node.jstree', (e: any, data: any) => {
            expandHeavyChildren(data.node, data);
        }).on('ready.jstree', () => {
            $('#calltree').jstree('open_node', $('#' + callTreeRootName));
        });
    }

    var currentSrcFile:string = null;

    function highlightSrcLoc(loc: string): void {
        var split = loc.split(":");
        var file = split[0];
        var siteStart = {
            line: parseInt(split[1])-1,
            ch: parseInt(split[2])-1
        };
        var siteEnd = {
            line: parseInt(split[3])-1,
            ch: parseInt(split[4])-1
        };
        if (file === currentSrcFile) {
            // just set the selection
            myCodeMirror.getDoc().setSelection(siteStart, siteEnd);
        } else {
            // need to grab the src code, then do the highlight
            // TODO cache things
            $.get("/srcloc/" + encodeURIComponent(loc), (srcData: any) => {
                $('#sourceviewheader').html('<p class=\"lead\">' + file + ' source</p>');
                var doc = myCodeMirror.getDoc();
                doc.setValue(srcData.src);
                doc.setSelection(siteStart, siteEnd);
                currentSrcFile = file;
            })
        }
    }

    /**
     * the time index corresponding to clickLine.  -1 means no click has been performed
     */
    var clickIndex = -1;

    var apTreeRootName = "aptreeroot";
    function renderAccessPathTree(treeData: any) {
        addTreeLabels(treeData, (node) => {
            var result = "";
            if (node.root.indexOf("C(") === 0) {
                // context
                if (node.label.indexOf('|') === -1) {
                    result += "var ";
                } else {
                    result += "vars ";
                }
                result += node.label + " of ";
                var loc = node.root.substring(2,node.root.length-1);
                if (loc === 'GLOBAL') {
                    result += "global scope";
                } else {
                    result += formatSourceLoc(loc);
                }
            } else {
                if (node.label !== "") {
                    if (node.label === "_CONTEXT_") {
                        result += "closure of ";
                    } else {
                        if (node.label.indexOf('|') === -1) {
                            result += "prop ";
                        } else {
                            result += "props ";
                        }
                        result += node.label + " of ";
                    }
                }
                result += formatSourceLoc(node.root);
            }
            return result;
        });
        treeData.id = apTreeRootName;
        function expandSingleChild(node: any, treedata: any): void {
            if (node.children && node.children.length === 1) {
                var firstChildId = node.children[0];
                var firstChild = treedata.instance.get_node(firstChildId);
                // TODO there must be a more efficient way to do this...
                $('#accesspaths').jstree('open_node', node);
                expandSingleChild(firstChild, treedata);

            }
        }
        $('#accesspaths').jstree({ 'core': {
            'data': [treeData]
        }}).on('changed.jstree', (e: any, data: any) => {
            var selected = data.selected[0];
            var loc = data.instance.get_node(selected).original.root;
            if (loc === 'GLOBAL') {
                return;
            }
            if (loc.indexOf("C(") === 0) {
                loc = loc.substring(2,loc.length-1);
            }
            highlightSrcLoc(loc);
        }).on('open_node.jstree', (e: any, data: any) => {
            expandSingleChild(data.node, data);
        }).on('ready.jstree', () => {
            $('#accesspaths').jstree('open_node', $('#' + apTreeRootName));
        });
    }
    function attachClickHandlers(data: Array<any>) {
        var timeData =
            data.map(function (t) {
                return t["time"];
            });
        d3.selectAll('.c3-event-rect').on('click.mine', function (d: any,i: any) {
            var t = timeData[i];
            console.log("index " + i);
            console.log("time " + t);
            drawClickLineAtIndex(i, true);
            clickIndex = i;
            var apDiv = $('#accesspaths');
            apDiv.jstree('destroy');
            apDiv.html('<img src="/images/ajax-loader.gif" style="display: block; margin: 0 auto">');
            $.get('/accesspaths', { site: site, time: t }, (r) => {
                apDiv.html("");
                renderAccessPathTree(r);
            });
        });

    }

    $.when($.ajax("/timeline" + "/" + encodedSite),$.ajax("/srcloc/" + encodedSite),$.ajax("/callingcontexts/"+encodedSite))
        .done((a1: any, a2: any, a3: any) => {
            if (!allocRowsInitialized) {
                initAllocRows();
                allocRowsInitialized = true;
            }
            var srcData = a2[0];
            var doc = myCodeMirror.getDoc();
            doc.setValue(srcData.src);
            currentSrcFile = site.split(':')[0];
            $('#sourceviewheader').html('<p class=\"lead\">' + currentSrcFile + ' source</p>');
            highlightSrcLoc(site);
            var timelineData = a1[0];
            drawTimeline(timelineData, 'sitetimeline', () => {
                attachClickHandlers(timelineData);
                if (clickIndex !== -1) {
                    drawClickLineAtIndex(clickIndex, false);
                }
            });
            attachClickHandlers(timelineData);
            renderCallTree(a3[0]);
        });

}