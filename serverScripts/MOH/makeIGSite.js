#!/usr/bin/env node




var showdown  = require('../../../js/libs/showdown.min.js'),
    converter = new showdown.Converter(),
    text      = '# hello, markdown!',
    html      = converter.makeHtml(text);

console.log(html)