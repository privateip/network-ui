/* Copyright (c) 2017 Red Hat, Inc. */

const templateUrl = require('~network-ui/monitor/status.light.partial.svg');

function statusLight () {
  return { restrict: 'A', templateUrl};
}
exports.statusLight = statusLight;
