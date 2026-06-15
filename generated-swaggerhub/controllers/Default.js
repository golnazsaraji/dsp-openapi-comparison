'use strict';

var utils = require('../utils/writer.js');
var Default = require('../service/DefaultService');

module.exports.filmsGET = function filmsGET (req, res, next) {
  Default.filmsGET()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.filmsIdGET = function filmsIdGET (req, res, next, id) {
  Default.filmsIdGET(id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
