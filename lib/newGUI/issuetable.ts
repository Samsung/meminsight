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

    $.get("/summary", function (data) {
        var k = 0;
        var lim = data.length;

        $("#restable").append("<table id=\"Table1\" class=\"table table-bordered table-striped\" cellspacing=\"0\" width=\"100%\"></table>");

        $("#Table1").append("<thead><tr>" + "<th>" + "Site" + "</th>" +
            "<th style=\"text-align:right\">" + "Count" + "</th>" +
            "<th style=\"text-align:right\">" + "Occupancy" + "</th>" +
            "<th style=\"text-align:right\">" + "Kind" + "</th>" +
            "<th style=\"text-align:right\">" + "Leak" + "</th>" +
            "<th style=\"text-align:right\">" + "Staleness" + "</th>" +
            "<th style=\"text-align:right\">" + "Inline-able" + "</th>" +
            "<th style=\"text-align:right\">" + "Non-escaping" + "</th>" +
            "</tr> </thead>");
        $("#Table1").append("<tbody>");
        while (k < lim) {
            var b = "<a onclick=\"window.open('/allocpage/"+ encodeURIComponent(data[k].site) + "')\">" +
                    formatSourceLoc(data[k].site) + "</a> ";

            var s1 = "<span id=\"topSite" + k + "span1\">" + data[k].count + "</span>";
            var s2 = "<span id=\"topSite" + k + "span2\">" + data[k].aggregateMoment + "</span>";
            var s3 = "<span id=\"topSite" + k + "span3\">" + data[k].kind + "</span>";
            var s4 = "<span id=\"topSite" + k + "span4\">" +
                        ((data[k].leakiness.toFixed(2) === "0.00") ? " " : data[k].leakiness.toFixed(2)) + "</span>";
            var s5 = "<span id=\"topSite" + k + "span5\">" +
                        ((data[k].relativeStaleness.toFixed(2) === "0.00") ? " " : data[k].relativeStaleness.toFixed(2)) + "</span>";
            var s6 = "<span id=\"topSite" + k + "span6\">" +
                        ((data[k].inlineBenefit.toFixed(2) === "0.00") ? " " :
                            "<a onclick=\"alert('" + formatSourceLoc(data[k].consistentlyPointedBy) + "')\">" +
                            data[k].inlineBenefit.toFixed(2) + "</a>") + "</span>";
            var s7 = "<span id=\"topSite" + k + "span7\">" +
                        ((data[k].stackAllocBenefit.toFixed(2) === "0.00") ? " " : data[k].stackAllocBenefit.toFixed(2)) + "</span>";

            $("#Table1").append("<tr>" + "<td>" + b + // bs +
                    "</td>" + "<td style=\"text-align:right\">" + s1 + "</td>" +
                    "<td style=\"text-align:right\">" + s2 + "</td>" +
                    "<td style=\"text-align:right\">" + s3 + "</td>" +
                    "<td style=\"text-align:right\">" + s4 + "</td>" +
                    "<td style=\"text-align:right\">" + s5 + "</td>" +
                    "<td style=\"text-align:right\">" + s6 + "</td>" +
                    "<td style=\"text-align:right\">" + s7 + "</td>" +
                    "</tr>");
            k++;
        }
        $('#Table1').append("</tbody>");
        (<any>$('#Table1')).dataTable();

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


