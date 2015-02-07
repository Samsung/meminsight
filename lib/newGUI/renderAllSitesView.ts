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
///<reference path='../ts-declarations/d3.d.ts' />
///<reference path='../ts-declarations/c3.d.ts' />
///<reference path='./guiUtil.ts' />
/**
 * Created by m.sridharan on 9/22/14.
 */

interface DetailsChartState {
    topSiteNames: Array<string>
    chart: C3Chart
}

(function (){

    function computeMaxInd(arr: Array<number>): number {
        // use reduce, just for fun
        return arr.reduce((prev: { max: number; maxInd: number }, cur: number, ind: number) => {
            if (cur > prev.max) {
                return { max: cur, maxInd: ind };
            } else {
                return prev;
            }
        }, { max: arr[0], maxInd: 0 }).maxInd;
    }

    var allSitesState: DetailsChartState = {
        topSiteNames: null,
        chart: null
    };
    var staleSitesState: DetailsChartState = {
        topSiteNames: null,
        chart: null
    };

    /**
     * the time index corresponding to clickLine.  -1 means no click has been performed
     */
    var clickIndex: number = -1;

    function initChartsToMax(maxTime: number, maxInd: number): void {
        $.get("sizedetails/" + maxTime + "/" + "false", detailsChartGenerator(true, 'allsitedetails', allSitesState));
        $.get("sizedetails/" + maxTime + "/" + "true", detailsChartGenerator(true, 'stalesitedetails', staleSitesState));
        drawClickLineAtIndex(maxInd, false);
        clickIndex = maxInd;
    }

    // keep this shared between different invocations of detailsChartGenerator.
    // a very small leak, but fixes some bugs
    var formatted2FullSiteName: { [fmt: string]: string } = {};

    function detailsChartGenerator(pieChart: boolean, domID: string, state: DetailsChartState): (sizeDetails: any) => void {
        return function (sizeDetails: any) {
            var summaryData: any = sizeDetails.summaryData;
            var totalSize = 0;
            var curId = 0;
            var totalNumObjs = 0;
            var topSiteNames = state.topSiteNames;
            var detailsChart = state.chart;
            // allocation site names
            var siteNames: Array<string> = [];
            // number of objects per site
            var numObjs: Array<{id: number; count: number}> = [];
            for (var i in summaryData) {
                siteNames[curId] = i;
                numObjs[curId] = { id: curId, count: parseInt(summaryData[i]["count"]) };
                totalNumObjs = totalNumObjs + numObjs[curId].count;
                curId = curId + 1;
            }
            numObjs.sort((a,b) => { return b.count - a.count; });
            var numToShow = 5;
            var oldTopSiteNames: Array<string> = null;
            if (topSiteNames && pieChart) {
                oldTopSiteNames = topSiteNames;
            }
            topSiteNames = [];
//                var topSiteNames: Array<string> = [];
            var topObjCounts: any = pieChart ? [] : ['object count'];
            var numLeft = totalNumObjs;
            for (var j = 0; j < numToShow; j++) {
                var record = numObjs[j];
                var formatted = formatSourceLoc(siteNames[record.id]);
                formatted2FullSiteName[formatted] = siteNames[record.id];
                if (pieChart) {
                    topObjCounts.push([formatted, record.count]);
                } else {
                    topObjCounts.push(record.count);
                }
                topSiteNames.push(formatted);
                numLeft -= record.count;
            }
            if (pieChart) {
                topObjCounts.push(['other', numLeft]);
            } else {
                topObjCounts.push(numLeft);
            }
            topSiteNames.push('other');
//                console.log(topObjCounts);
//                console.log(topSiteNames);
            if (detailsChart) {
                var updateObj = {
                    columns: pieChart ? topObjCounts : [topObjCounts]
                };
                if (!pieChart) {
                    (<any>updateObj).categories = topSiteNames
                } else {
                    // unload old data from piechart
                    var namesToDelete: Array<string> = oldTopSiteNames.filter((name) => {
                        return topSiteNames.indexOf(name) === -1;
                    });
                    if (namesToDelete.length > 0) {
                        (<any>updateObj).unload = namesToDelete;
                    }
                }
                detailsChart.load(updateObj);
            } else {
                var dataConfig = {
                    columns: pieChart ? topObjCounts : [topObjCounts],
                    type: pieChart ? 'pie' : 'bar',
                    onclick: (pieChart ? ((d: any, i: any) => {
                        //console.log("onclick", d, i);
                        if (d.id !== 'other') {
                            window.open("/allocpage/" + encodeURIComponent(formatted2FullSiteName[d.id]));
                        }
                    }) : null)
                };
                var config = {
                    bindto: '#' + domID,
                    data: dataConfig,
                    size: { height: 320 }
                };
                if (!pieChart) {
                    (<any>config).axis = {
                        x: {
                            type: 'category',
                            categories: topSiteNames
                        },
                        rotated: true
                    };
                }
                detailsChart = c3.generate(config);

            }
            state.topSiteNames = topSiteNames;
            state.chart = detailsChart;
        };
    }

    function attachClickHandlers(data: Array<any>): void {
        var timeData =
            data.map(function (t) {
                return t["time"];
            });
        d3.selectAll('.c3-event-rect').on('click.mine', function (d: any,i: any) {
            var t = timeData[i];
            console.log("index " + i);
            console.log("time " + t);
            clickIndex = i;
            drawClickLineAtIndex(i, true);
            $.get("sizedetails/" + t + "/" + "false", detailsChartGenerator(true, 'allsitedetails', allSitesState));
            $.get("sizedetails/" + t + "/" + "true", detailsChartGenerator(true, 'stalesitedetails', staleSitesState));
        });
    }


    $.get("timeline/*", function (data: Array<any>) {
        drawTimeline(data, 'chart', function () {
            // when resized, need to re-attach the click handlers and re-draw the click line
            attachClickHandlers(data);
            if (clickIndex !== -1) {
                drawClickLineAtIndex(clickIndex, false);
            }
        });
        var allocData =
            data.map(function (t) {
                return t["alloc"];
            });
        var maxInd = computeMaxInd(allocData);
        var timeData =
            data.map(function (t) {
                return t["time"];
            });
        var maxTime = timeData[maxInd];
        initChartsToMax(maxTime, maxInd);
        attachClickHandlers(data);

    });
})();


