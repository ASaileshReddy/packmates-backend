const express = require('express');
const bodyParser = require('body-parser');
var router = express.Router();

var program = 'PackMates';
var version = '1.0.0';
var release = '01';
var date = new Date();
var timestamp = date.getTime();

module.exports.success_message = function (data, res, totalRecords = 0) {
  res.status(200).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Success',
    code: 200,
    message: 'OK',
    totalRecords: totalRecords,
    data: data,
  });
};

module.exports.custom_success_message = function (data, res, statusCode = 200, message = 'OK', totalRecords = 0) {
  res.status(statusCode).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Success',
    code: statusCode,
    message: message,
    totalRecords: totalRecords,
    data: data,
  });
};

module.exports.custom_error_message = function (data, res, message, statusCode = 500) {
  res.status(statusCode).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Failure',
    code: statusCode,
    message,
    data: data,
  });
};

module.exports.error_message = function (data, res) {
  res.status(500).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Failure',
    code: 500,
    message: 'Internal Server Error',
    data: data,
  });
};

module.exports.validation_error_message = function (data, res) {
  res.status(403).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Ok',
    code: 403,
    message: 'Validation Error',
    data: data,
  });
};

module.exports.data_error_message = function (data, res) {
  res.status(403).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'OK',
    code: 403,
    message: 'No Data Found',
    data: data,
  });
};

module.exports.unauthorized_error_message = function (data, res) {
  res.status(401).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Ok',
    code: 401,
    message: 'Unauthorized Information',
    data: data,
  });
};

module.exports.success_message_list = function (data, res) {
  datas = {};
  datas.list = data.docs;
  datas.total_counts = data.totalDocs;
  datas.current = data.page;
  datas.auth = true;
  datas.next = data.nextPage;
  datas.pages = Math.ceil(data.totalDocs / data.limit);

  if (data.low_stock) datas.low_stock = data.low_stock;
  if (data.out_of_stock) datas.out_of_stock = data.out_of_stock;

  res.status(200).send({
    program: program,
    version: version,
    release: release,
    datetime: date,
    timestamp: timestamp,
    status: 'Success',
    code: 200,
    message: 'OK',
    data: datas,
  });
};
