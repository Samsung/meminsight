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
///<reference path='../ts-declarations/d3.d.ts' />
///<reference path='../ts-declarations/c3.d.ts' />

/**
 * Created by m.sridharan on 10/1/14.
 */

function drawTimeline(data: Array<any>, domID: string, resizeHandler: () => void): C3Chart {
    var allocData =
        data.map(function (t) {
            return t["alloc"];
        });

    var staleData =
        data.map(function (t) {
            return t["stale"];
        });
    allocData.unshift('alloc');
    staleData.unshift('stale');

    var result = c3.generate({
        bindto: '#' + domID,
        data: {
            columns: [
                allocData,
                staleData
            ],
            types: {
                alloc: 'area-spline',
                stale: 'area-spline'
            }
        },
        axis: {
            x: {
                tick: {
                    count: 1
                }
            }
        },
        point: {show: false},
        onresized: resizeHandler
    });
    return result;
}

/**
 * NOTE: this function assumes your page contains exactly one timeline that has already
 * been drawn using the drawTimeline() function
 * @param index
 * @param realClick is this really a click, or are we just setting the line programatically?
 */
function drawClickLineAtIndex(index: number, realClick: boolean): void {
    var clickLine: D3.Selection = d3.select('line.clickmarkline');
    var x1: number, x2: number, y1: number, y2: number;
    if (realClick) {
        var focusLine = d3.select('line.c3-xgrid-focus')[0][0];
        x1 = focusLine.getAttribute('x1');
        x2 = focusLine.getAttribute('x2');
        y1 = focusLine.getAttribute('y1');
        y2 = focusLine.getAttribute('y2');
    } else { // setting programatically
        var maxRect = d3.select('.c3-event-rect-'+(index))[0][0];
        var xOfMaxRect = maxRect.getAttribute('x');
        var heightOfMaxRect = maxRect.getAttribute('height');
        x1 = xOfMaxRect;
        x2 = xOfMaxRect;
        y1 = 0;
        y2 = heightOfMaxRect;
    }
    if (!clickLine.empty()) {
        clickLine.attr('x1', x1)
            .attr('x2', x2)
            .attr('y1', y1)
            .attr('y2', y2);
    } else {
        var focusGrid = d3.select('g.c3-xgrid-focus');
        focusGrid.append('line')
            .attr('class', "clickmarkline")
            .attr('stroke-width', 3)
            .attr('x1', xOfMaxRect)
            .attr('x2', xOfMaxRect)
            .attr('y1', 0)
            .attr('y2', heightOfMaxRect)
            .attr('stroke-dasharray', '10,10')
            .style("visibility", "visible");
    }
}



/**
 * given a source loc of the form file:sl:sc:el:ec, return
 * file:sl:sc for now
 */
function formatSourceLoc(site: string): string {
    var thirdColon = site.split(':', 3).join(':').length;
    return site.substring(0, thirdColon);
}