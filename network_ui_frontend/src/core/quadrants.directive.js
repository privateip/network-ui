/* Copyright (c) 2017 Red Hat, Inc. */

const templateUrl = require('~network-ui/core/quadrants.partial.svg');

function quadrants () {
  return { restrict: 'A', templateUrl};
}
exports.quadrants = quadrants;
