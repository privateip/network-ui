/* Copyright (c) 2017 Red Hat, Inc. */

const templateUrl = require('~network-ui/core/debug.partial.svg');

function debug () {
  return { restrict: 'A', templateUrl};
}

exports.debug = debug;
