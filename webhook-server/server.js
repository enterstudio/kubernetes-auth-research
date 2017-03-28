var express = require('express');
var bodyparser = require('body-parser');
var app = express();

app.post('/authenticate', bodyparser.json(), require('./authenticate'));
app.post('/authorize', bodyparser.json(), require('./authorize'));

app.listen(process.env.NODE_PORT || 3000);
