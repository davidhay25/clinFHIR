//import { parse } from 'node-html-parser';

const syncRequest = require('sync-request');

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds
let url = "https://northport.co.nz/inportpage/allshippingmovements"
var response = syncRequest('GET', url, options);

let html = response.getBody().toString()
const cheerio = require('cheerio')
const $ = cheerio.load(html)


let json = {inPort:[],expecting:[]}

let arInPort = [];
let arExpecting = [];


$("table.views-table").each(function(index, table) {
    console.log("table "+ index)


    $("tr",table).each(function(index1,tableRow){
        console.log('row',index1)
        let row = {};
        $("td",tableRow).each(function(colNum,data){
            console.log('---------------')
            let value = "";

            data.children.forEach(function (child) {
                switch (child.type) {
                    case 'span':
                        child.children.forEach(function (grandChild) {
                            value += grandChild.data;
                        });
                        break;
                    case 'text' :
                        value += child.data;
                        break;
                    case 'tag' :
                        switch (child.name) {
                            case 'span' :
                                child.children.forEach(function (grandChild) {
                                    value += grandChild.data;
                                });
                                break;
                            case 'a' :
                                child.children.forEach(function (grandChild) {
                                    value += grandChild.data;
                                });
                                break;
                            default :
                                break
                        }
                        break;
                    default :
                        console.log(data)
                }
            });



            if (value) {
                value = value.trim()
                switch (colNum) {
                    case 0 :
                        row.shipName = value;
                        break;
                    case 1:
                        row.eta = splitDate(value)
                        break;
                    case 2:
                        row.pob = splitDate(value)
                        break;
                    case 3:
                        row.etd = splitDate(value)
                        break;
                    case 4:
                        row.berth = value;
                        break;
                    case 5:
                        row.agent = value;
                        break;
                    case 6:
                        row.stevedores = value;
                        break;
                    case 7:
                        row.cargo = value;
                        break;
                    case 8:
                        row.lastPort = value;
                        break;
                    case 9:
                        row.nextPort = value;
                        break;
                }
            }


            //console.log(colNum + ' value=' + value)

        })

        //add to the correct array...
        if (row && row.shipName) {
            switch (index) {
                case 0 :
                    json.inPort.push(row)

                    break;
                case 1 :
                    json.expecting.push(row)
                    break;
                default :
                    console.log('more than 2 matching rows!')
                    break;
            }
        }

    });



});

function splitDate(s) {
    //let result = {};
    try {
        if (s) {
            let ar = s.split('-');
            let arDate = ar[0].trim().split('/')
            let date = arDate[2] + '-' + arDate[1] + '-' + arDate[0]
            let time = ar[1].trim()
            return date + "T"+time
        }
    } catch (ex) {
        console.log("Invalid date: "+ s,ex)
    }

}

console.log(json)

