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
///<reference path='./guiUtil.ts' />

/**
 * Created by schandra on 9/29/14.
 */

(function (){

    function timeLineHandlerBuilder(site: string): (evt: any) => void {
        var encodedSite = encodeURIComponent(site);
        return function timeLineHandler(evt) {
            console.log(encodedSite);
            window.open("/allocpage/"+encodedSite);
        };

    };

    $("#restable").html('<img src="/images/ajax-loader.gif" style="display: block; margin: 0 auto">');

    console.time("dataFetch");
    $.get("/summary", function (data) {
        console.timeEnd("dataFetch");
        console.time("gen data");
        var k = 0;
        var lim = data.length;

        $("#restable").html("<table id=\"Table1\" class=\"table table-bordered table-striped\" cellspacing=\"0\" width=\"100%\"></table>");

        var tableData: Array<Array<string>> = [];
        while (k < lim) {
            var curData = data[k];
            tableData.push([
                curData.site,
                curData.count,
                curData.aggregateMoment,
                curData.kind,
                (data[k].leakiness.toFixed(2) === "0.00") ? " " : data[k].leakiness.toFixed(2),
                (data[k].relativeStaleness.toFixed(2) === "0.00") ? " " : data[k].relativeStaleness.toFixed(2),
                ((data[k].inlineBenefit.toFixed(2) === "0.00") ? " " :
                    data[k].inlineBenefit.toFixed(2) + "___" + formatSourceLoc(data[k].consistentlyPointedBy)),
                (data[k].stackAllocBenefit.toFixed(2) === "0.00") ? " " : data[k].stackAllocBenefit.toFixed(2)
            ]);
            k++;
        }
        console.timeEnd("gen data");
        console.time("data table");

        (<any>$('#Table1')).dataTable({
            "data": tableData,
            "columns": [
                { 'title': 'Site', 'render': (siteStr, type, full, meta) => {
                    return "<a onclick=\"window.open('/allocpage/"+ encodeURIComponent(siteStr) + "')\">" +
                        formatSourceLoc(siteStr) + "</a>";
                }},
                { 'title': 'Count', 'sClass': 'dt-right'},
                { 'title': 'Occupancy', 'sClass': 'dt-right'},
                { 'title': 'Kind', 'sClass': 'dt-right'},
                { 'title': 'Leak', 'sClass': 'dt-right' },
                { 'title': 'Staleness', 'sClass': 'dt-right'},
                { 'title': 'Inline-able', 'sClass': 'dt-right', 'render': (inlineStr, type, full, meta) => {
                    if (inlineStr === " ") return " ";
                    var split = inlineStr.split("___");
                    return "<a onclick=\"alert('" + split[1] + "')\">" +
                    split[0] + "</a>";
                }},
                { 'title': 'Non-escaping', 'sClass': 'dt-right'}],
            "deferRender": true
        });
        console.timeEnd("data table");

        $("#restable").append("<div> Toggle Column <a class=\"toggle-vis\" data-column=\"4\">Leak</a> - " +
            "<a class=\"toggle-vis\" data-column=\"5\">Staleness</a> - " +
            "<a class=\"toggle-vis\" data-column=\"6\">Inline</a> - " +
            "<a class=\"toggle-vis\" data-column=\"7\">Stack Alloc</a>" + "</div>")

        $('a.toggle-vis').on( 'click', function (e) {
            e.preventDefault();

            var table = (<any>$('#Table1')).dataTable();
            // Get the column API object
            var column = table.api().column( $(this).attr('data-column') );

            // Toggle the visibility
            column.visible( ! column.visible() );
        } );

    });
})();


