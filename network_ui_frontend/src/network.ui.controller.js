/* Copyright (c) 2017 Red Hat, Inc. */
//var fake_data = require('./fake_data.js');
var angular = require('angular');
var ReconnectingWebSocket = require('reconnectingwebsocket');
var nunjucks = require('nunjucks');

var fsm = require('./fsm.js');
var util = require('./util.js');

var null_fsm = require('./core/null.fsm.js');
var view = require('./core/view.fsm.js');
var hotkeys = require('./core/hotkeys.fsm.js');
var time = require('./core/time.fsm.js');
var animations = require('./core/animations.js');
var core_models = require('./core/models.js');
var core_messages = require('./core/messages.js');

var app_models = require('./application/models.js');
var stream_fsm = require('./application/stream.fsm.js');

var buttons = require('./button/buttons.fsm.js');
var button_models = require('./button/models.js');

var mode_fsm = require('./network/mode.fsm.js');
var device_detail_fsm = require('./network/device.detail.fsm.js');
var rack_fsm = require('./network/rack.fsm.js');
var site_fsm = require('./network/site.fsm.js');
var move = require('./network/move.fsm.js');
var link = require('./network/link.fsm.js');
var group = require('./network/group.fsm.js');
var net_models = require('./network/models.js');
var net_messages = require('./network/messages.js');


var log_pane = require('./log/log.pane.fsm.js');
var log_models = require('./log/models.js');

var toolbox_fsm = require('./toolbox/toolbox.fsm.js');
var toolbox_models = require('./toolbox/models.js');

var test_fsm = require('./test/test.fsm.js');
var test_messages = require('./test/messages.js');

var keybindings = require('./menu/keybindings.fsm.js');
var details_panel_fsm = require('./menu/details.panel.fsm.js');
var menu_models = require('./menu/models.js');

var monitor_models = require('./monitor/models.js');

var svg_crowbar = require('./vendor/svg-crowbar.js');

var NetworkUIController = function($scope,
                                   $document,
                                   $location,
                                   $window,
                                   $http
                                   //$q,
                                   //$state
                                   //ProcessErrors,
                                   //ConfigService,
                                   //rbacUiControlService,
                                   //HostsService,
                                   //GroupsService
                                   ) {

  window.scope = $scope;
  var i = 0;

  $scope.nunjucks = nunjucks;

  $scope.http = $http;

  $scope.api_token = '';
  $scope.disconnected = false;

  $scope.topology_id = $location.search().topology_id || 0;
  // Create a web socket to connect to the backend server

  $scope.inventory_id = $location.search().inventory_id || 1;

  var protocol = null;

  if ($location.protocol() === 'http') {
    protocol = 'ws';
  } else if ($location.protocol() === 'https') {
    protocol = 'wss';
  }

  $scope.initial_messages = [];
  if (!$scope.disconnected) {
      console.log("connecting " + protocol + "://" + window.location.host + "/ws/network_ui?topology_id=" + $scope.topology_id);
      $scope.control_socket = new ReconnectingWebSocket(protocol + "://" + window.location.host + "/ws/network_ui?topology_id=" + $scope.topology_id + '&inventory_id=' + $scope.inventory_id,
                                                         null,
                                                         {debug: true, reconnectInterval: 300});
      console.log("connected " + protocol + "://" + window.location.host + "/ws/network_ui");
  } else {
      $scope.control_socket = {
          on_message: util.noop
      };
  }
  $scope.document = document;
  $scope.my_location = $location.protocol() + "://" + $location.host() + ':' + $location.port();
  $scope.history = [];
  $scope.client_id = 1;
  $scope.onMouseDownResult = "";
  $scope.onMouseUpResult = "";
  $scope.onMouseEnterResult = "";
  $scope.onMouseLeaveResult = "";
  $scope.onMouseMoveResult = "";
  $scope.onMouseMoveResult = "";
  $scope.current_scale = 1.0;
  $scope.current_mode = null;
  $scope.panX = 0;
  $scope.panY = 0;
  $scope.mouseX = 0;
  $scope.mouseY = 0;
  $scope.scaledX = 0;
  $scope.scaledY = 0;
  $scope.pressedX = 0;
  $scope.pressedY = 0;
  $scope.pressedScaledX = 0;
  $scope.pressedScaledY = 0;
  $scope.lastPanX = 0;
  $scope.lastPanY = 0;
  $scope.selected_devices = [];
  $scope.selected_links = [];
  $scope.selected_interfaces = [];
  $scope.selected_items = [];
  $scope.selected_groups = [];
  $scope.new_link = null;
  $scope.new_stream = null;
  $scope.new_group_type = null;
  $scope.last_key = "";
  $scope.last_key_code = null;
  $scope.last_event = null;
  $scope.cursor = {'x':100, 'y': 100, 'hidden': false};

  $scope.debug = {'hidden': true};
  $scope.hide_buttons = false;
  $scope.hide_links = false;
  $scope.hide_interfaces = false;
  $scope.hide_groups = false;
  $scope.viewport_update_subscribers = [$scope];
  $scope.graph = {'width': 0,
                  'right_column': 0,
                  'height': 0,
                  'update_size': function($window) {
                      $scope.graph.width = $window.innerWidth;
                      $scope.graph.right_column = $window.innerWidth - 300;
                      $scope.graph.height = $window.innerHeight;
                  }};
  $scope.viewport_update_subscribers.push($scope.graph);
  $scope.graph.update_size($window);
  $scope.device_id_seq = util.natural_numbers(0);
  $scope.link_id_seq = util.natural_numbers(0);
  $scope.group_id_seq = util.natural_numbers(0);
  $scope.message_id_seq = util.natural_numbers(0);
  $scope.stream_id_seq = util.natural_numbers(0);
  $scope.test_result_id_seq = util.natural_numbers(0);
  $scope.animation_id_seq = util.natural_numbers(0);
  $scope.overall_toolbox_collapsed = false;
  $scope.time_pointer = -1;
  $scope.frame = 0;
  $scope.recording = false;
  $scope.replay = false;
  $scope.devices = [];
  $scope.links = [];
  $scope.groups = [];
  $scope.processes = [];
  $scope.tests = [];
  $scope.current_tests = [];
  $scope.current_test = null;
  $scope.testing = false;
  $scope.template_building = false;
  $scope.version = null;
  $scope.test_events = [];
  $scope.test_results = [];
  $scope.test_errors = [];
  $scope.streams = [];
  $scope.animations = [];
  $scope.sequences = {};
  $scope.playbooks = [];
  $scope.playbooks_by_id = {};
  $scope.log_pane = new log_models.LogPane($scope);
  $scope.viewport_update_subscribers.push($scope.log_pane);
  $scope.log_pane.update_size($window);
  $scope.play_status = new monitor_models.PlayStatus($scope.log_pane, $scope);
  $scope.viewport_update_subscribers.push($scope.play_status);
  $scope.play_status.update_size($window);
  $scope.view_port = {'x': 0,
                      'y': 0,
                      'width': 0,
                      'height': 0,
                      top_extent: function (scaledY) {
                          this.x1 = this.x;
                          this.x2 = this.x + this.width;
                          this.y1 = this.y;
                          this.y2 = this.y + this.height;
                          var y2 = this.y2 !== null ? this.y2 : scaledY;
                          return (this.y1 < y2? this.y1 : y2);
                      },
                      left_extent: function (scaledX) {
                          this.x1 = this.x;
                          this.x2 = this.x + this.width;
                          this.y1 = this.y;
                          this.y2 = this.y + this.height;
                          var x2 = this.x2 !== null ? this.x2 : scaledX;
                          return (this.x1 < x2? this.x1 : x2);
                      },
                      bottom_extent: function (scaledY) {
                          this.x1 = this.x;
                          this.x2 = this.x + this.width;
                          this.y1 = this.y;
                          this.y2 = this.y + this.height;
                          var y2 = this.y2 !== null ? this.y2 : scaledY;
                          return (this.y1 > y2? this.y1 : y2);
                      },
                      right_extent: function (scaledX) {
                          this.x1 = this.x;
                          this.x2 = this.x + this.width;
                          this.y1 = this.y;
                          this.y2 = this.y + this.height;
                          var x2 = this.x2 !== null ? this.x2 : scaledX;
                          return (this.x1 > x2? this.x1 : x2);
                      }
                  };
  $scope.trace_id_seq = util.natural_numbers(0);
  $scope.trace_order_seq = util.natural_numbers(0);
  $scope.trace_id = $scope.trace_id_seq();
  $scope.jump = {from_x: 0,
                 from_y: 0,
                 to_x: 0,
                 to_y: 0};

    $scope.send_trace_message = function (message) {
        if (!$scope.recording && !$scope.debug.hidden) {
            return;
        }
        message.sender = $scope.client_id;
        message.trace_id = $scope.trace_id;
        message.message_id = $scope.message_id_seq();
        var data = core_messages.serialize(message);
        if (!$scope.disconnected) {
            try {
                $scope.control_socket.send(data);
            }
            catch(err) {
                $scope.initial_messages.push(message);
            }
        } else {
            console.log(message);
        }
    };

    $scope.onKeyDown = function ($event) {
        if ($scope.recording) {
            $scope.send_control_message(new core_messages.KeyEvent($scope.client_id,
                                                              $event.key,
                                                              $event.keyCode,
                                                              $event.type,
                                                              $event.altKey,
                                                              $event.shiftKey,
                                                              $event.ctrlKey,
                                                              $event.metaKey,
                                                              $scope.trace_id));
        }
        $scope.last_event = $event;
        $scope.last_key = $event.key;
        $scope.last_key_code = $event.keyCode;
        $scope.first_channel.send('KeyDown', $event);
        $scope.$apply();
        $event.preventDefault();
    };

  //Define the FSMs
  $scope.null_controller = new fsm.FSMController($scope, "null_fsm", null_fsm.Start, $scope);
  $scope.hotkeys_controller = new fsm.FSMController($scope, "hotkeys_fsm", hotkeys.Start, $scope);
  $scope.keybindings_controller = new fsm.FSMController($scope, "keybindings_fsm", keybindings.Start, $scope);
  $scope.view_controller = new fsm.FSMController($scope, "view_fsm", view.Start, $scope);
  $scope.device_detail_controller = new fsm.FSMController($scope, "device_detail_fsm", device_detail_fsm.Start, $scope);
  $scope.move_controller = new fsm.FSMController($scope, "move_fsm", move.Start, $scope);
  $scope.details_panel_controller = new fsm.FSMController($scope, "details_panel_fsm", details_panel_fsm.Start, $scope);
  $scope.link_controller = new fsm.FSMController($scope, "link_fsm", link.Start, $scope);
  $scope.stream_controller = new fsm.FSMController($scope, "stream_fsm", stream_fsm.Start, $scope);
  $scope.group_controller = new fsm.FSMController($scope, "group_fsm", group.Start, $scope);
  $scope.rack_controller = new fsm.FSMController($scope, "rack_fsm", rack_fsm.Disable, $scope);
  $scope.site_controller = new fsm.FSMController($scope, "site_fsm", site_fsm.Disable, $scope);
  $scope.buttons_controller = new fsm.FSMController($scope, "buttons_fsm", buttons.Start, $scope);
  $scope.log_pane_controller = new fsm.FSMController($scope.log_pane, "log_pane_controller", log_pane.Start, $scope);
  $scope.log_pane.fsm = $scope.log_pane_controller;
  $scope.time_controller = new fsm.FSMController($scope, "time_fsm", time.Start, $scope);
  $scope.test_controller = new fsm.FSMController($scope, "test_fsm", test_fsm.Start, $scope);
  $scope.app_toolbox_controller = new fsm.FSMController($scope, "toolbox_fsm", toolbox_fsm.Start, $scope);

  //App Toolbox Setup
  // const toolboxTopMargin = 115;
  var toolboxTopMargin = 0; //$('.Networking-top').height();
  var toolboxTitleMargin = toolboxTopMargin + 0;
  var toolboxHeight = $scope.graph.height - toolboxTopMargin;
  $scope.app_toolbox = new toolbox_models.ToolBox(0, 'Process', 'app', 0, toolboxTopMargin, 200, toolboxHeight);
  $scope.app_toolbox.title_coordinates = {x: 70, y: toolboxTitleMargin};
  $scope.app_toolbox.spacing = 150;
  $scope.app_toolbox.enabled = false;
  $scope.app_toolbox_controller.toolbox = $scope.app_toolbox;
  $scope.app_toolbox_controller.debug = true;
  $scope.app_toolbox_controller.dropped_action = function (selected_item) {
    $scope.first_channel.send("PasteProcess", new net_messages.PasteProcess(selected_item));
  };

  $scope.app_toolbox.items.push(new app_models.Process(0, 'BGP', 'process', 0, 0));
  $scope.app_toolbox.items.push(new app_models.Process(0, 'OSPF', 'process', 0, 0));
  $scope.app_toolbox.items.push(new app_models.Process(0, 'STP', 'process', 0, 0));
  $scope.app_toolbox.items.push(new app_models.Process(0, 'Zero Pipeline', 'process', 0, 0));

  for(i = 0; i < $scope.app_toolbox.items.length; i++) {
      $scope.app_toolbox.items[i].icon = true;
  }

  $scope.inventory_toolbox_controller = new fsm.FSMController($scope, "toolbox_fsm", toolbox_fsm.Start, $scope);


  //Inventory Toolbox Setup
  $scope.inventory_toolbox = new toolbox_models.ToolBox(0, 'Inventory', 'device', 0, toolboxTopMargin, 200, toolboxHeight);
  $scope.inventory_toolbox.spacing = 150;
  $scope.inventory_toolbox.enabled = true;
  $scope.inventory_toolbox.title_coordinates = {x: 60, y: toolboxTitleMargin};
  $scope.inventory_toolbox_controller.toolbox = $scope.inventory_toolbox;
  $scope.inventory_toolbox_controller.remove_on_drop = true;
  $scope.inventory_toolbox_controller.debug = true;
  $scope.inventory_toolbox_controller.dropped_action = function (selected_item) {
    $scope.first_channel.send("PasteDevice", new net_messages.PasteDevice(selected_item));
  };

  //End Inventory Toolbox Setup
  $scope.rack_toolbox_controller = new fsm.FSMController($scope, "toolbox_fsm", toolbox_fsm.Start, $scope);
  //Rack Toolbox Setup
  $scope.rack_toolbox = new toolbox_models.ToolBox(0, 'Rack', 'rack', 0, toolboxTopMargin, 200, toolboxHeight);
  $scope.rack_toolbox.title_coordinates = {x: 80, y: toolboxTitleMargin};
  $scope.rack_toolbox.spacing = 200;
  $scope.rack_toolbox.enabled = false;
  $scope.rack_toolbox_controller.remove_on_drop = false;
  $scope.rack_toolbox_controller.toolbox = $scope.rack_toolbox;
  $scope.rack_toolbox_controller.debug = true;
  $scope.rack_toolbox_controller.dropped_action = function (selected_item) {
    $scope.first_channel.send("PasteRack", new net_messages.PasteRack(selected_item));
  };
  for(i = 0; i < $scope.rack_toolbox.items.length; i++) {
      $scope.rack_toolbox.items[i].icon = true;
      $scope.rack_toolbox.items[i].selected = false;
  }
  //End Rack Toolbox Setup
  $scope.site_toolbox_controller = new fsm.FSMController($scope, "toolbox_fsm", toolbox_fsm.Start, $scope);
  //Site Toolbox Setup
  $scope.site_toolbox = new toolbox_models.ToolBox(0, 'Sites', 'sites', 0, toolboxTopMargin, 200, toolboxHeight);
  $scope.site_toolbox.title_coordinates = {x: 80, y: toolboxTitleMargin};
  $scope.site_toolbox.spacing = 200;
  $scope.site_toolbox.enabled = false;
  $scope.site_toolbox_controller.remove_on_drop = false;
  $scope.site_toolbox_controller.toolbox = $scope.site_toolbox;
  $scope.site_toolbox_controller.debug = true;
  $scope.site_toolbox_controller.dropped_action = function (selected_item) {
    $scope.first_channel.send("PasteSite", new net_messages.PasteSite(selected_item));
  };
  for(i = 0; i < $scope.site_toolbox.items.length; i++) {
      $scope.site_toolbox.items[i].icon = true;
      $scope.site_toolbox.items[i].selected = false;
  }
  //End Site Toolbox Setup

  $scope.mode_controller = new fsm.FSMController($scope, "mode_fsm", mode_fsm.Start, $scope);

  //Wire up the FSMs
  $scope.keybindings_controller.delegate_channel = new fsm.Channel($scope.keybindings_controller,
                                                            $scope.hotkeys_controller,
                                                            $scope);

  $scope.view_controller.delegate_channel = new fsm.Channel($scope.view_controller,
                                                            $scope.keybindings_controller,
                                                            $scope);
  $scope.device_detail_controller.delegate_channel = new fsm.Channel($scope.device_detail_controller,
                                                            $scope.view_controller,
                                                            $scope);
  $scope.move_controller.delegate_channel = new fsm.Channel($scope.move_controller,
                                                            $scope.device_detail_controller,
                                                            $scope);
  $scope.details_panel_controller.delegate_channel = new fsm.Channel($scope.details_panel_controller,
                                                            $scope.move_controller,
                                                            $scope);
  $scope.link_controller.delegate_channel = new fsm.Channel($scope.link_controller,
                                                                  $scope.details_panel_controller,
                                                                  $scope);
  $scope.stream_controller.delegate_channel = new fsm.Channel($scope.stream_controller,
                                                                  $scope.link_controller,
                                                                  $scope);
  $scope.group_controller.delegate_channel = new fsm.Channel($scope.group_controller,
                                                                  $scope.stream_controller,
                                                                  $scope);
  $scope.rack_controller.delegate_channel = new fsm.Channel($scope.rack_controller,
                                                               $scope.group_controller,
                                                               $scope);
  $scope.site_controller.delegate_channel = new fsm.Channel($scope.site_controller,
                                                               $scope.rack_controller,
                                                               $scope);
  $scope.app_toolbox_controller.delegate_channel = new fsm.Channel($scope.app_toolbox_controller,
                                                            $scope.site_controller,
                                                            $scope);
  $scope.inventory_toolbox_controller.delegate_channel = new fsm.Channel($scope.inventory_toolbox_controller,
                                                            $scope.app_toolbox_controller,
                                                            $scope);
  $scope.rack_toolbox_controller.delegate_channel = new fsm.Channel($scope.rack_toolbox_controller,
                                                            $scope.inventory_toolbox_controller,
                                                            $scope);
  $scope.site_toolbox_controller.delegate_channel = new fsm.Channel($scope.site_toolbox_controller,
                                                            $scope.rack_toolbox_controller,
                                                            $scope);
  $scope.log_pane_controller.delegate_channel = new fsm.Channel($scope.log_pane_controller,
                                                               $scope.site_toolbox_controller,
                                                               $scope);
  $scope.buttons_controller.delegate_channel = new fsm.Channel($scope.buttons_controller,
                                                               $scope.log_pane_controller,
                                                               $scope);
  $scope.time_controller.delegate_channel = new fsm.Channel($scope.time_controller,
                                                            $scope.buttons_controller,
                                                            $scope);
  $scope.mode_controller.delegate_channel = new fsm.Channel($scope.mode_controller,
                                                            $scope.time_controller,
                                                            $scope);
  $scope.test_controller.delegate_channel = new fsm.Channel($scope.test_controller,
                                                            $scope.mode_controller,
                                                            $scope);


  $scope.first_channel = new fsm.Channel(null,
                                         $scope.test_controller,
                                         $scope);

    var getMouseEventResult = function (mouseEvent) {
      return "(" + mouseEvent.x + ", " + mouseEvent.y + ")";
    };

    $scope.updateScaledXY = function() {
        if (isNaN($scope.mouseX) ||
            isNaN($scope.mouseY) ||
            isNaN($scope.panX) ||
            isNaN($scope.panY) ||
            isNaN($scope.current_scale)) {
            return;
        }
        $scope.scaledX = ($scope.mouseX - $scope.panX) / $scope.current_scale;
        $scope.scaledY = ($scope.mouseY - $scope.panY) / $scope.current_scale;
        $scope.view_port.x = - $scope.panX / $scope.current_scale;
        $scope.view_port.y = - $scope.panY / $scope.current_scale;
        $scope.view_port.width = $scope.graph.width / $scope.current_scale;
        $scope.view_port.height = $scope.graph.height / $scope.current_scale;

    };

    $scope.updatePanAndScale = function() {
        if (isNaN($scope.panX) ||
            isNaN($scope.panY) ||
            isNaN($scope.current_scale)) {
            return;
        }
        var g = document.getElementById('frame_g');
        g.setAttribute('transform','translate(' + $scope.panX + ',' + $scope.panY + ') scale(' + $scope.current_scale + ')');
    };

    $scope.to_virtual_coordinates = function (b_x, b_y) {
        var v_x = (b_x - $scope.panX) / $scope.current_scale;
        var v_y = (b_y - $scope.panY) / $scope.current_scale;
        return {x: v_x, y: v_y};
    };

    $scope.to_browser_coordinates = function (v_x, v_y) {
        var b_x = (v_x * $scope.current_scale) + $scope.panX;
        var b_y = (v_y * $scope.current_scale) + $scope.panY;
        return {x: b_x, y: b_y};
    };

    $scope.to_pan = function (v_x, v_y) {
        var p_x = v_x * $scope.current_scale * -1;
        var p_y = v_y * $scope.current_scale * -1;
        return {x: p_x, y: p_y};
    };

    $scope.clear_selections = function () {

        var i = 0;
        var j = 0;
        var devices = $scope.devices;
        var links = $scope.links;
        var groups = $scope.groups;
        $scope.selected_items = [];
        $scope.selected_devices = [];
        $scope.selected_links = [];
        $scope.selected_interfaces = [];
        $scope.selected_groups = [];
        for (i = 0; i < devices.length; i++) {
            for (j = 0; j < devices[i].interfaces.length; j++) {
                devices[i].interfaces[j].selected = false;
            }
            if (devices[i].selected) {
                $scope.send_control_message(new net_messages.DeviceUnSelected($scope.client_id, devices[i].id));
            }
            devices[i].selected = false;
        }
        for (i = 0; i < links.length; i++) {
            if (links[i].selected) {
                $scope.send_control_message(new net_messages.LinkUnSelected($scope.client_id, links[i].id));
            }
            links[i].selected = false;
        }
        for (i = 0; i < groups.length; i++) {
            groups[i].selected = false;
        }
    };

    $scope.select_items = function (multiple_selection) {

        var i = 0;
        var j = 0;
        var devices = $scope.devices;
        var last_selected_device = null;
        var last_selected_interface = null;
        var last_selected_link = null;

        $scope.pressedX = $scope.mouseX;
        $scope.pressedY = $scope.mouseY;
        $scope.pressedScaledX = $scope.scaledX;
        $scope.pressedScaledY = $scope.scaledY;

        if (!multiple_selection) {
            $scope.clear_selections();
        }

        for (i = devices.length - 1; i >= 0; i--) {
            if (devices[i].is_selected($scope.scaledX, $scope.scaledY)) {
                devices[i].selected = true;
                $scope.send_control_message(new net_messages.DeviceSelected($scope.client_id, devices[i].id));
                last_selected_device = devices[i];
                  if ($scope.selected_items.indexOf($scope.devices[i]) === -1) {
                      $scope.selected_items.push($scope.devices[i]);
                  }
                if ($scope.selected_devices.indexOf(devices[i]) === -1) {
                    $scope.selected_devices.push(devices[i]);
                }
                if (!multiple_selection) {
                    break;
                }
            }
        }

        // Do not select interfaces if a device was selected
        if (last_selected_device === null && !$scope.hide_interfaces) {
            for (i = devices.length - 1; i >= 0; i--) {
                for (j = devices[i].interfaces.length - 1; j >= 0; j--) {
                    if (devices[i].interfaces[j].is_selected($scope.scaledX, $scope.scaledY)) {
                        devices[i].interfaces[j].selected = true;
                        last_selected_interface = devices[i].interfaces[j];
                        if ($scope.selected_interfaces.indexOf($scope.devices[i].interfaces[j]) === -1) {
                            $scope.selected_interfaces.push($scope.devices[i].interfaces[j]);
                        }
                        if ($scope.selected_items.indexOf($scope.devices[i].interfaces[j]) === -1) {
                            $scope.selected_items.push($scope.devices[i].interfaces[j]);
                        }
                        if (!multiple_selection) {
                            break;
                        }
                    }
                }
            }
        }

        // Do not select links if a device was selected
        if (last_selected_device === null && last_selected_interface === null) {
            for (i = $scope.links.length - 1; i >= 0; i--) {
                if ($scope.links[i].is_selected($scope.scaledX, $scope.scaledY)) {
                    $scope.links[i].selected = true;
                    $scope.send_control_message(new net_messages.LinkSelected($scope.client_id, $scope.links[i].id));
                    last_selected_link = $scope.links[i];
                    if ($scope.selected_items.indexOf($scope.links[i]) === -1) {
                        $scope.selected_items.push($scope.links[i]);
                    }
                    if ($scope.selected_links.indexOf($scope.links[i]) === -1) {
                        $scope.selected_links.push($scope.links[i]);
                        if (!multiple_selection) {
                            break;
                        }
                    }
                }
            }
        }

        return {last_selected_device: last_selected_device,
                last_selected_link: last_selected_link,
                last_selected_interface: last_selected_interface,
               };
    };

    // Event Handlers

    $scope.normalize_mouse_event = function ($event) {
        if ($event.pageX !== undefined && $event.x === undefined) {
            $event.x = $event.pageX;
        }
        if ($event.pageY !== undefined && $event.y === undefined) {
            $event.y = $event.pageY;
        }
        if ($event.originalEvent !== undefined) {
            var originalEvent = $event.originalEvent;
            if (originalEvent.wheelDelta !== undefined) {
                $event.delta = $event.originalEvent.wheelDelta;
            }
            if (originalEvent.wheelDeltaX !== undefined) {
                $event.deltaX = $event.originalEvent.wheelDeltaX;
            }
            if (originalEvent.wheelDeltaY !== undefined) {
                $event.deltaY = $event.originalEvent.wheelDeltaY;
            }
        }
    };

    $scope.onMouseDown = function ($event) {
      $scope.normalize_mouse_event($event);
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseEvent($scope.client_id, $event.x, $event.y, $event.type, $scope.trace_id));
      }
      $scope.last_event = $event;
      $scope.first_channel.send('MouseDown', $event);
      $scope.onMouseDownResult = getMouseEventResult($event);
      $event.preventDefault();
    };

    $scope.onMouseUp = function ($event) {
      $scope.normalize_mouse_event($event);
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseEvent($scope.client_id, $event.x, $event.y, $event.type, $scope.trace_id));
      }
      $scope.last_event = $event;
      $scope.first_channel.send('MouseUp', $event);
      $scope.onMouseUpResult = getMouseEventResult($event);
      $event.preventDefault();
    };

    $scope.onMouseLeave = function ($event) {
      $scope.normalize_mouse_event($event);
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseEvent($scope.client_id, $event.x, $event.y, $event.type, $scope.trace_id));
      }
      $scope.onMouseLeaveResult = getMouseEventResult($event);
      $scope.cursor.hidden = true;
      $event.preventDefault();
    };

    $scope.onMouseMove = function ($event) {
      $scope.normalize_mouse_event($event);
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseEvent($scope.client_id, $event.x, $event.y, $event.type, $scope.trace_id));
      }
      //var coords = getCrossBrowserElementCoords($event);
      $scope.cursor.hidden = false;
      $scope.cursor.x = $event.x;
      $scope.cursor.y = $event.y;
      $scope.mouseX = $event.x;
      $scope.mouseY = $event.y;
      $scope.updateScaledXY();
      $scope.first_channel.send('MouseMove', $event);
      $scope.onMouseMoveResult = getMouseEventResult($event);
      $event.preventDefault();
    };

    $scope.onMouseOver = function ($event) {
      $scope.normalize_mouse_event($event);
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseEvent($scope.client_id, $event.x, $event.y, $event.type, $scope.trace_id));
      }
      $scope.onMouseOverResult = getMouseEventResult($event);
      $scope.cursor.hidden = false;
      $event.preventDefault();
    };

    $scope.onMouseEnter = $scope.onMouseOver;

    $scope.onMouseWheel = function ($event) {
      $scope.normalize_mouse_event($event);
      var delta = $event.delta;
      var deltaX = $event.deltaX;
      var deltaY = $event.deltaY;
      if ($scope.recording) {
          $scope.send_control_message(new core_messages.MouseWheelEvent($scope.client_id, delta, deltaX, deltaY, $event.type, $event.originalEvent.metaKey, $scope.trace_id));
      }
      $scope.last_event = $event;
      $scope.first_channel.send('MouseWheel', [$event, delta, deltaX, deltaY]);
      $event.preventDefault();
    };

    // Conext Menu Button Handlers
    $scope.removeContextMenu = function(){
        $scope.move_controller.handle_message("Ready", {});
        let context_menu = $scope.context_menus[0];
        context_menu.enabled = false;
        context_menu.x = -100000;
        context_menu.y = -100000;
        context_menu.buttons.forEach(function(button){
            button.enabled = false;
            button.x = -100000;
            button.y = -100000;
        });
    };

    $scope.closeDetailsPanel = function () {
        $scope.first_channel.send('DetailsPanelClose', {});
    };

    $scope.$on('hostUpdateSaved', (e, host) => {
        if (host.variables !== "" && $scope.selected_devices.length === 1) {
            host.data = jsyaml.safeLoad(host.variables);
            $scope.selected_devices[0].type = host.data.type;
        }
    });

    $scope.onDetailsContextButton = function () {
        function emitCallback(item, canAdd){
            $scope.first_channel.send('DetailsPanel', {});
            $scope.removeContextMenu();
            $scope.update_toolbox_heights();
            $scope.$emit('showDetails', item, canAdd);
        }

        // show details for devices
        if ($scope.selected_devices.length === 1 && $scope.selected_devices[0].host_id === 0){
            // following block is intended for devices added in the network UI but not in Tower
            emitCallback($scope.selected_devices[0]);
        }

        // following block is intended for devices that are saved in the API
        if ($scope.selected_devices.length === 1 && $scope.selected_devices[0].host_id !== 0){
            let host_id = $scope.selected_devices[0].host_id;
            let url = `/api/v2/hosts/${host_id}/`;
            let hostData = $http.get(url)
                 .then(function(response) {
                     let host = response.data;
                     host.host_id = host.id;
                     return host;
                 })
                 .catch(({data, status}) => {
                     console.log([data, status]);
                     //ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get host data: ' + status });
                 });
            let canAdd = true; //rbacUiControlService.canAdd('hosts')
                    //.then(function(res) {
                    //    return res.canAdd;
                    //})
                    //.catch(function() {
                    //    return false;
                    //});
            Promise.all([hostData, canAdd]).then((values) => {
                let item = values[0];
                let canAdd = values[1];
                emitCallback(item, canAdd);
            });
        }

        // show details for interfaces
        else if($scope.selected_interfaces.length === 1){
            emitCallback($scope.selected_interfaces[0]);
        }

        // show details for links
        else if($scope.selected_links.length === 1){
            emitCallback($scope.selected_links[0]);
        }

        //show details for groups, racks, and sites
        else if ($scope.selected_groups.length === 1){
            emitCallback($scope.selected_groups[0]);
        }

    };

    $scope.onRenameContextButton = function () {
        $scope.removeContextMenu();
        $scope.first_channel.send("LabelEdit", {});
    };

    $scope.deleteDevice = function(){
        var i = 0;
        var j = 0;
        var index = -1;
        var devices = $scope.selected_devices;
        var links = $scope.selected_links;
        var all_links = $scope.links.slice();
        $scope.selected_devices = [];
        $scope.selected_links = [];
        $scope.move_controller.changeState(move.Ready);
        for (i = 0; i < links.length; i++) {
            index = $scope.links.indexOf(links[i]);
            if (index !== -1) {
                links[i].selected = false;
                links[i].remote_selected = false;
                $scope.links.splice(index, 1);
                $scope.send_control_message(new net_messages.LinkDestroy($scope.client_id,
                                                                               links[i].id,
                                                                               links[i].from_device.id,
                                                                               links[i].to_device.id,
                                                                               links[i].from_interface.id,
                                                                               links[i].to_interface.id,
                                                                               links[i].name));
            }
        }
        for (i = 0; i < devices.length; i++) {
            index = $scope.devices.indexOf(devices[i]);
            if (index !== -1) {
                $scope.devices.splice(index, 1);
                $scope.$emit('removeSearchOption', devices[i]);
                $scope.send_control_message(new net_messages.DeviceDestroy($scope.client_id,
                                                                                 devices[i].id,
                                                                                 devices[i].x,
                                                                                 devices[i].y,
                                                                                 devices[i].name,
                                                                                 devices[i].type,
                                                                                 devices[i].host_id));
            }
            for (j = 0; j < all_links.length; j++) {
                if (all_links[j].to_device === devices[i] ||
                    all_links[j].from_device === devices[i]) {
                    index = $scope.links.indexOf(all_links[j]);
                    if (index !== -1) {
                        $scope.links.splice(index, 1);
                    }
                }
            }
        }
    };

    $scope.deleteGroup = function(){
        var i = 0;
        var index = -1;
        var selected_groups = $scope.selected_groups;
        $scope.selected_groups = [];
        $scope.group_controller.changeState(group.Ready);

        function removeSingleGroup(group){
            index = $scope.groups.indexOf(group);
            if (index !== -1) {
                group.selected = false;
                group.remote_selected = false;
                $scope.groups.splice(index, 1);
            }
            $scope.send_control_message(new net_messages.GroupDestroy($scope.client_id,
                                                                            group.id,
                                                                            group.x1,
                                                                            group.y1,
                                                                            group.x2,
                                                                            group.y2,
                                                                            group.name,
                                                                            group.group_id));
        }

        if($scope.current_scale <= 0.5){
            // current scale is in racks mode or sites mode
            for (i = 0; i < selected_groups.length; i++) {
                let group = selected_groups[i];
                if(group.groups.length > 0){
                    for(var k = 0; k < group.groups.length; k++){
                        let nested_group = group.groups[k];
                        removeSingleGroup(nested_group);
                    }
                }
                // remove all the nested devices and links
                $scope.selected_devices = group.devices;
                $scope.selected_links = group.links;
                $scope.deleteDevice();

                removeSingleGroup(group);
            }
        }
        if($scope.current_scale > 0.5){
            // current scale is in devices mode
            for (i = 0; i < selected_groups.length; i++) {
                let group = selected_groups[i];
                removeSingleGroup(group);
            }
        }
    };

    $scope.onDeleteContextMenu = function(){
        $scope.removeContextMenu();
        if($scope.selected_devices.length === 1){
            $scope.deleteDevice();
        }
        else if($scope.selected_groups.length === 1){
            $scope.deleteGroup();
        }
    };

    // Button Event Handlers
    $scope.onToggleToolboxButtonLeft = function () {
        $scope.first_channel.send("ToggleToolbox", {});
        $scope.action_icons[0].fsm.handle_message("Disable", {});
        $scope.action_icons[1].fsm.handle_message("Enable", {});
        $scope.overall_toolbox_collapsed = !$scope.overall_toolbox_collapsed;
        $scope.$emit('overall_toolbox_collapsed');
    };

    $scope.onToggleToolboxButtonRight = function () {
        $scope.first_channel.send("ToggleToolbox", {});
        $scope.action_icons[0].fsm.handle_message("Enable", {});
        $scope.action_icons[1].fsm.handle_message("Disable", {});
        $scope.overall_toolbox_collapsed = !$scope.overall_toolbox_collapsed;
        $scope.$emit('overall_toolbox_collapsed');
    };

    $scope.$on('toolbarButtonEvent', function(e, functionName){
        $scope[`on${functionName}Button`]();
    });

    $scope.$on('SearchDropdown', function(){
        $scope.first_channel.send('SearchDropdown', {});
    });

    $scope.$on('SearchDropdownClose', function(){
        $scope.first_channel.send('SearchDropdownClose', {});
    });

    $scope.$on('search', function(e, device){

        var searched;
        for(var i = 0; i < $scope.devices.length; i++){
            if(Number(device.id) === $scope.devices[i].id){
                searched = $scope.devices[i];
            }
        }
        searched.selected = true;
        $scope.selected_devices.push(searched);
        $scope.jump_to_animation(searched.x, searched.y, 1.0);
    });

    $scope.jump_to_animation = function(jump_to_x, jump_to_y, jump_to_scale, updateZoom) {
        $scope.cancel_animations();
        var v_center = $scope.to_virtual_coordinates($scope.graph.width/2, $scope.graph.height/2);
        $scope.jump.from_x = v_center.x;
        $scope.jump.from_y = v_center.y;
        $scope.jump.to_x = jump_to_x;
        $scope.jump.to_y = jump_to_y;
        var distance = util.distance(v_center.x, v_center.y, jump_to_x, jump_to_y);
        var num_frames = 30 * Math.floor((1 + 4 * distance / (distance + 3000)));
        var scale_animation = new core_models.Animation($scope.animation_id_seq(),
                                                  num_frames,
                                                  {
                                                      c: -0.1,
                                                      distance: distance,
                                                      end_height: (1.0/jump_to_scale) - 1,
                                                      current_scale: $scope.current_scale,
                                                      scope: $scope,
                                                      updateZoomBoolean: updateZoom
                                                  },
                                                  $scope,
                                                  $scope,
                                                  animations.scale_animation);
        $scope.animations.push(scale_animation);
        var pan_animation = new core_models.Animation($scope.animation_id_seq(),
                                                  num_frames,
                                                  {
                                                      x2: jump_to_x,
                                                      y2: jump_to_y,
                                                      x1: v_center.x,
                                                      y1: v_center.y,
                                                      scope: $scope
                                                  },
                                                  $scope,
                                                  $scope,
                                                  animations.pan_animation);
        $scope.animations.push(pan_animation);
    };

    $scope.$on('jumpTo', function(e, zoomLevel) {
        var v_center = $scope.to_virtual_coordinates($scope.graph.width/2, $scope.graph.height/2);
        switch (zoomLevel){
            case 'site':
                $scope.jump_to_animation(v_center.x, v_center.y, 0.051);
                break;
            case 'rack':
                $scope.jump_to_animation(v_center.x, v_center.y, 0.11);
                break;
            case 'inventory':
                $scope.jump_to_animation(v_center.x, v_center.y, 0.51);
                break;
            case 'process':
                $scope.jump_to_animation(v_center.x, v_center.y, 5.1);
                break;
        }
    });

    $scope.$on('zoom', (e, zoomPercent) => {
        let v_center = $scope.to_virtual_coordinates($scope.graph.width/2, $scope.graph.height/2);
        let scale = Math.pow(10, (zoomPercent - 120) / 40);
        $scope.jump_to_animation(v_center.x, v_center.y, scale, false);
    });

    $scope.onDeployButton = function () {
        $scope.send_control_message(new net_messages.Deploy($scope.client_id));
    };

    $scope.onDestroyButton = function () {
        $scope.send_control_message(new net_messages.Destroy($scope.client_id));
    };

    $scope.onRecordButton = function () {
        $scope.recording = ! $scope.recording;
        if ($scope.recording) {
            $scope.trace_id = $scope.trace_id_seq();
            $scope.send_control_message(new core_messages.MultipleMessage($scope.client_id,
                                                                     [new core_messages.StartRecording($scope.client_id, $scope.trace_id),
                                                                      new core_messages.ViewPort($scope.client_id,
                                                                                            $scope.current_scale,
                                                                                            $scope.panX,
                                                                                            $scope.panY,
                                                                                            $scope.trace_id),
                                                                      new net_messages.Snapshot($scope.client_id,
                                                                                            $scope.devices,
                                                                                            $scope.links,
                                                                                            $scope.groups,
                                                                                            $scope.streams,
                                                                                            0,
                                                                                            $scope.trace_id)]));
        } else {
            $scope.send_control_message(new core_messages.MultipleMessage($scope.client_id,
                                                                     [new net_messages.Snapshot($scope.client_id,
                                                                                            $scope.devices,
                                                                                            $scope.links,
                                                                                            $scope.groups,
                                                                                            $scope.streams,
                                                                                            1,
                                                                                            $scope.trace_id),
                                                                      new core_messages.StopRecording($scope.client_id, $scope.trace_id)]));
        }
    };

    $scope.onExportButton = function () {
        $scope.cursor.hidden = true;
        $scope.debug.hidden = true;
        $scope.hide_buttons = true;
        setTimeout(function () {
            svg_crowbar.svg_crowbar();
            $scope.cursor.hidden = false;
            $scope.hide_buttons = false;
            $scope.$apply();
        }, 1000);
    };

    $scope.onLayoutButton = function () {
        $scope.send_control_message(new net_messages.Layout($scope.client_id));
    };

    $scope.onTogglePhysical = function () {
        $scope.hide_links = false;
    };

    $scope.onUnTogglePhysical = function () {
        $scope.hide_links = true;
    };

    $scope.onToggleGroup = function () {
        $scope.hide_groups = false;
    };

    $scope.onUnToggleGroup = function () {
        $scope.hide_groups = true;
        $scope.group_controller.changeState(group.Ready);
    };


    $scope.onExportYamlButton = function () {
        $window.open('/network_ui/topology.yaml?topology_id=' + $scope.topology_id , '_blank');
    };

    // Context Menu Buttons
    $scope.context_menu_buttons = [
        new menu_models.ContextMenuButton("Rename", 210, 200, 160, 26, $scope.onRenameContextButton, $scope),
        new menu_models.ContextMenuButton("Details", 236, 231, 160, 26, $scope.onDetailsContextButton, $scope),
        new menu_models.ContextMenuButton("Delete", 256, 231, 160, 26, $scope.onDeleteContextMenu, $scope)
    ];

    // Context Menus
    $scope.context_menus = [
        new menu_models.ContextMenu('HOST', 210, 200, 160, 90, $scope.contextMenuCallback, false, $scope.context_menu_buttons, $scope)
    ];

    // Icons
    var actionIconVerticalOffset = toolboxTopMargin + (toolboxHeight/2);
    $scope.action_icons = [
        new toolbox_models.ActionIcon("chevron-left", 170, actionIconVerticalOffset, 16, $scope.onToggleToolboxButtonLeft, true, $scope),
        new toolbox_models.ActionIcon("chevron-right", 15, actionIconVerticalOffset, 16, $scope.onToggleToolboxButtonRight, false, $scope)
    ];

    $scope.onDownloadTraceButton = function () {
        window.open("/network_ui/download_trace?topology_id=" + $scope.topology_id + "&trace_id=" + $scope.trace_id + "&client_id=" + $scope.client_id);
    };

    $scope.onDownloadRecordingButton = function () {
        window.open("/network_ui/download_recording?topology_id=" + $scope.topology_id + "&trace_id=" + $scope.trace_id + "&client_id=" + $scope.client_id);
    };

    $scope.onUploadTestButton = function () {
        window.open("/network_ui/upload_test", "_top");
    };

    $scope.onRunTestsButton = function () {

        $scope.test_results = [];
        $scope.current_tests = $scope.tests.slice();
        $scope.first_channel.send("EnableTest", new test_messages.EnableTest());
    };

    $scope.onCompileVariablesButton = function () {};

    var button_offset = 200;

    $scope.buttons = [
      new button_models.Button("DEPLOY", button_offset + 10, 48, 70, 30, $scope.onDeployButton, $scope),
      new button_models.Button("DESTROY", button_offset + 90, 48, 80, 30, $scope.onDestroyButton, $scope),
      new button_models.Button("RECORD", button_offset + 180, 48, 80, 30, $scope.onRecordButton, $scope),
      new button_models.Button("EXPORT", button_offset + 270, 48, 70, 30, $scope.onExportButton, $scope),
      new button_models.Button("DISCOVER", button_offset + 350, 48, 80, 30, $scope.onDiscoverButton, $scope),
      new button_models.Button("LAYOUT", button_offset + 440, 48, 70, 30, $scope.onLayoutButton, $scope),
      new button_models.Button("CONFIGURE", button_offset + 520, 48, 90, 30, $scope.onConfigureButton, $scope),
      new button_models.Button("EXPORT YAML", button_offset + 620, 48, 120, 30, $scope.onExportYamlButton, $scope),
      new button_models.Button("DOWNLOAD TRACE", button_offset + 750, 48, 150, 30, $scope.onDownloadTraceButton, $scope),
      new button_models.Button("DOWNLOAD RECORDING", button_offset + 910, 48, 170, 30, $scope.onDownloadRecordingButton, $scope),
      new button_models.Button("UPLOAD TEST", button_offset + 10, 88, 100, 30, $scope.onUploadTestButton, $scope),
      new button_models.Button("RUN TESTS", button_offset + 120, 88, 100, 30, $scope.onRunTestsButton, $scope),
    ];

    $scope.all_buttons = [];
    $scope.all_buttons.extend($scope.context_menu_buttons);
    $scope.all_buttons.extend($scope.action_icons);
    $scope.all_buttons.extend($scope.buttons);
    $scope.all_buttons.push($scope.play_status);

    $scope.onFacts = function(data) {
        var i = 0;
        var j = 0;
        var k = 0;
        var device = null;
        var keys = null;
        var peers = null;
        var ptm = null;
        var intf = null;
        for (i = 0; i < $scope.devices.length; i++) {
            device = $scope.devices[i];
            if (device.name === data.key) {

                //Check PTM
                if (data.value.ansible_local !== undefined &&
                    data.value.ansible_local.ptm !== undefined) {
                    keys = Object.keys(data.value.ansible_local.ptm);
                    for (j = 0; j < keys.length; j++) {
                        ptm = data.value.ansible_local.ptm[keys[j]];
                        for (k = 0; k < device.interfaces.length; k++) {
                            intf = device.interfaces[k];
                            if (intf.name === ptm.port) {
                                intf.link.status = ptm['cbl status'] === 'pass';
                            }
                        }
                    }
                }

                //Check LLDP
                if (data.value.ansible_net_neighbors !== undefined) {
                    keys = Object.keys(data.value.ansible_net_neighbors);
                    for (j = 0; j < keys.length; j++) {
                        peers = data.value.ansible_net_neighbors[keys[j]];
                        for (k = 0; k < peers.length; k++) {
                            intf = $scope.getDeviceInterface(device.name, keys[j]);
                            if (intf !== null && intf.link !== null) {
                                if (intf.link.to_interface === intf) {
                                    intf.link.status = ($scope.getDeviceInterface(peers[k].host, peers[k].port) === intf.link.from_interface);
                                } else {
                                    intf.link.status = ($scope.getDeviceInterface(peers[k].host, peers[k].port) === intf.link.to_interface);
                                }
                            }
                        }
                    }
                }
            }
        }

        $scope.$apply();
    };

    $scope.getDevice = function(name) {

        var i = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].name === name) {
                return $scope.devices[i];
            }
        }

        return null;
    };


    $scope.getDeviceInterface = function(device_name, interface_name) {

        var i = 0;
        var k = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].name === device_name) {
                for (k = 0; k < $scope.devices[i].interfaces.length; k++) {
                    if ($scope.devices[i].interfaces[k].name === interface_name) {
                        return $scope.devices[i].interfaces[k];
                    }
                }
            }
        }
        return null;
    };

    $scope.create_template_sequences = function (sequences, template, template_context) {
        var i = 0;
        var template_variables  = util.nunjucks_find_variables(template);
        for (i = 0; i < template_variables.length; i++) {
            if (template_context[template_variables[i]] === undefined) {
                if (sequences[template_variables[i]] === undefined) {
                    sequences[template_variables[i]] = util.natural_numbers(0);
                }
                template_context[template_variables[i]] = sequences[template_variables[i]]();
            }
        }
    };

    $scope.create_inventory_host = function (device) {
        if ($scope.template_building || device.template) {
            return;
        }
        console.log(device);

        return [];
    };

    $scope.create_inventory_group = function (group) {
        if ($scope.template_building || group.template) {
            return;
        }
        console.log(group);
        return [];
    };

    $scope.create_group_association = function () {};

    $scope.delete_group_association = function (group, devices) {
        if ($scope.template_building || group.template) {
            return;
        }

        console.log(['delete_group_association', group, devices]);
    };

    $scope.onDeviceCreate = function(data) {
        $scope.create_device(data);
    };

    $scope.create_device = function(data) {
        console.log(data);
        var device = new net_models.Device(data.id,
                                       data.name,
                                       data.x,
                                       data.y,
                                       data.type,
                                       data.host_id);
        $scope.device_id_seq = util.natural_numbers(data.id);
        $scope.devices.push(device);
    };

    $scope.onGroupCreate = function(data) {
        $scope.create_group(data);
    };

    $scope.create_group = function(data) {
        var group = new net_models.Group(data.id,
                                     data.name,
                                     data.type,
                                     data.x1,
                                     data.y1,
                                     data.x2,
                                     data.y2,
                                     false);
        $scope.group_id_seq = util.natural_numbers(data.id);
        $scope.groups.push(group);
    };

    $scope.breadcrumbGroups = function(){
        let breadcrumbGroups = [];
        for(var i = 0; i < $scope.groups.length; i++){
            let group = $scope.groups[i];
            if(group.is_in_breadcrumb($scope.view_port)){
                group.distance = util.distance(group.x1, group.y1, group.x2, group.y2);
                breadcrumbGroups.push(group);
            }
        }
        return breadcrumbGroups;
    };

    $scope.forDevice = function(device_id, data, fn) {
        var i = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id === device_id) {
                fn($scope.devices[i], data);
                break;
            }
        }
    };

    $scope.forLink = function(link_id, data, fn) {
        var i = 0;
        for (i = 0; i < $scope.links.length; i++) {
            if ($scope.links[i].id === link_id) {
                fn($scope.links[i], data);
                break;
            }
        }
    };

    $scope.forDeviceInterface = function(device_id, interface_id, data, fn) {
        var i = 0;
        var j = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id === device_id) {
                for (j = 0; j < $scope.devices[i].interfaces.length; j++) {
                    if ($scope.devices[i].interfaces[j].id === interface_id) {
                        fn($scope.devices[i].interfaces[j], data);
                        break;
                    }
                }
            }
        }
    };

    $scope.forGroup = function(group_id, data, fn) {
        var i = 0;
        for (i = 0; i < $scope.groups.length; i++) {
            if ($scope.groups[i].id === group_id) {
                fn($scope.groups[i], data);
                break;
            }
        }
    };

    $scope.onDeviceLabelEdit = function(data) {
        $scope.edit_device_label(data);
    };

    $scope.edit_device_label = function(data) {
        $scope.forDevice(data.id, data, function(device, data) {
            device.name = data.name;
        });
    };

    $scope.onInterfaceCreate = function(data) {
        $scope.create_interface(data);
    };

    $scope.create_interface = function(data) {
        var i = 0;
        var new_interface = new net_models.Interface(data.id, data.name);
        for (i = 0; i < $scope.devices.length; i++){
            if ($scope.devices[i].id === data.device_id) {
                $scope.devices[i].interface_seq = util.natural_numbers(data.id);
                new_interface.device = $scope.devices[i];
                $scope.devices[i].interfaces.push(new_interface);
            }
        }
    };

    $scope.onInterfaceLabelEdit = function(data) {
        $scope.edit_interface_label(data);
    };

    $scope.edit_interface_label = function(data) {
        $scope.forDeviceInterface(data.device_id, data.id, data, function(intf, data) {
            intf.name = data.name;
        });
    };

    $scope.onLinkCreate = function(data) {
        $scope.create_link(data);
    };

    $scope.create_link = function(data) {
        var i = 0;
        var j = 0;
        var new_link = new net_models.Link(null, null, null, null);
        new_link.id = data.id;
        $scope.link_id_seq = util.natural_numbers(data.id);
        for (i = 0; i < $scope.devices.length; i++){
            if ($scope.devices[i].id === data.from_device_id) {
                new_link.from_device = $scope.devices[i];
                for (j = 0; j < $scope.devices[i].interfaces.length; j++){
                    if ($scope.devices[i].interfaces[j].id === data.from_interface_id) {
                        new_link.from_interface = $scope.devices[i].interfaces[j];
                        $scope.devices[i].interfaces[j].link = new_link;
                    }
                }
            }
        }
        for (i = 0; i < $scope.devices.length; i++){
            if ($scope.devices[i].id === data.to_device_id) {
                new_link.to_device = $scope.devices[i];
                for (j = 0; j < $scope.devices[i].interfaces.length; j++){
                    if ($scope.devices[i].interfaces[j].id === data.to_interface_id) {
                        new_link.to_interface = $scope.devices[i].interfaces[j];
                        $scope.devices[i].interfaces[j].link = new_link;
                    }
                }
            }
        }
        if (new_link.from_interface !== null && new_link.to_interface !== null) {
            new_link.from_interface.dot();
            new_link.to_interface.dot();
        }
        if (new_link.from_device !== null && new_link.to_device !== null) {
            $scope.links.push(new_link);
        }
    };

    $scope.onLinkDestroy = function(data) {
        $scope.destroy_link(data);
    };

    $scope.destroy_link = function(data) {
        var i = 0;
        var link = null;
        var index = -1;
        for (i = 0; i < $scope.links.length; i++) {
            link = $scope.links[i];
            if (link.id === data.id &&
                link.from_device.id === data.from_device_id &&
                link.to_device.id === data.to_device_id &&
                link.to_interface.id === data.to_interface_id &&
                link.from_interface.id === data.from_interface_id) {
                link.from_interface.link = null;
                link.to_interface.link = null;
                index = $scope.links.indexOf(link);
                $scope.links.splice(index, 1);
            }
        }
    };

    $scope.onLinkLabelEdit = function(data) {
        $scope.edit_link_label(data);
    };

    $scope.edit_link_label = function(data) {
        $scope.forLink(data.id, data, function(link, data) {
            link.name = data.name;
        });
    };

    $scope.onDeviceMove = function(data) {
        $scope.move_device(data);
    };

    $scope.move_device = function(data) {
        var i = 0;
        var j = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id === data.id) {
                $scope.devices[i].x = data.x;
                $scope.devices[i].y = data.y;
                for (j = 0; j < $scope.devices[i].interfaces.length; j ++) {
                    $scope.devices[i].interfaces[j].dot();
                    if ($scope.devices[i].interfaces[j].link !== null) {
                        $scope.devices[i].interfaces[j].link.to_interface.dot();
                        $scope.devices[i].interfaces[j].link.from_interface.dot();
                    }
                }
                break;
            }
        }
    };

    $scope.onDeviceDestroy = function(data) {
        $scope.destroy_device(data);
    };

    $scope.destroy_device = function(data) {

        // Delete the device and any links connecting to the device.
        var i = 0;
        var j = 0;
        var dindex = -1;
        var lindex = -1;
        var devices = $scope.devices.slice();
        var all_links = $scope.links.slice();
        for (i = 0; i < devices.length; i++) {
            if (devices[i].id === data.id) {
                dindex = $scope.devices.indexOf(devices[i]);
                if (dindex !== -1) {
                    $scope.devices.splice(dindex, 1);
                }
                lindex = -1;
                for (j = 0; j < all_links.length; j++) {
                    if (all_links[j].to_device === devices[i] ||
                        all_links[j].from_device === devices[i]) {
                        lindex = $scope.links.indexOf(all_links[j]);
                        if (lindex !== -1) {
                            $scope.links.splice(lindex, 1);
                        }
                    }
                }
            }
        }
    };

    $scope.onGroupLabelEdit = function(data) {
        $scope.edit_group_label(data);
    };

    $scope.edit_group_label = function(data) {
        $scope.forGroup(data.id, data, function(group, data) {
            group.name = data.name;
        });
    };

    $scope.redo = function(type_data) {
        var type = type_data[0];
        var data = type_data[1];

        if (type === "DeviceMove") {
            $scope.move_device(data);
        }

        if (type === "DeviceCreate") {
            $scope.create_device(data);
        }

        if (type === "DeviceDestroy") {
            $scope.destroy_device(data);
        }

        if (type === "DeviceLabelEdit") {
            $scope.edit_device_label(data);
        }

        if (type === "LinkCreate") {
            $scope.create_link(data);
        }

        if (type === "LinkDestroy") {
            $scope.destroy_link(data);
        }
    };


    $scope.undo = function(type_data) {
        var type = type_data[0];
        var data = type_data[1];
        var inverted_data;

        if (type === "DeviceMove") {
            inverted_data = angular.copy(data);
            inverted_data.x = data.previous_x;
            inverted_data.y = data.previous_y;
            $scope.move_device(inverted_data);
        }

        if (type === "DeviceCreate") {
            $scope.destroy_device(data);
        }

        if (type === "DeviceDestroy") {
            inverted_data = new net_messages.DeviceCreate(data.sender,
                                                      data.id,
                                                      data.previous_x,
                                                      data.previous_y,
                                                      data.previous_name,
                                                      data.previous_type,
                                                      data.previous_host_id);
            $scope.create_device(inverted_data);
        }

        if (type === "DeviceLabelEdit") {
            inverted_data = angular.copy(data);
            inverted_data.name = data.previous_name;
            $scope.edit_device_label(inverted_data);
        }

        if (type === "LinkCreate") {
            $scope.destroy_link(data);
        }

        if (type === "LinkDestroy") {
            $scope.create_link(data);
        }
    };

    $scope.onClientId = function(data) {
        $scope.client_id = data;
        $scope.send_initial_messages();
    };

    $scope.onTopologyId = function(data) {
        $scope.topology_id = data;
    };

    $scope.onTopology = function(data) {
        $scope.topology_id = data.topology_id;
        $scope.panX = data.panX;
        $scope.panY = data.panX;
        $scope.current_scale = data.scale;
        $scope.$emit('awxNet-UpdateZoomWidget', $scope.current_scale, true);
        $scope.link_id_seq = util.natural_numbers(data.link_id_seq);
        $scope.group_id_seq = util.natural_numbers(data.group_id_seq);
        $scope.device_id_seq = util.natural_numbers(data.device_id_seq);
        $location.search({topology_id: data.topology_id, inventory_id: $scope.inventory_id});
    };

    $scope.onDeviceSelected = function(data) {
        var i = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id === data.id) {
                $scope.devices[i].remote_selected = true;
            }
        }
    };

    $scope.onDeviceUnSelected = function(data) {
        var i = 0;
        for (i = 0; i < $scope.devices.length; i++) {
            if ($scope.devices[i].id === data.id) {
                $scope.devices[i].remote_selected = false;
            }
        }
    };

    $scope.onHistory = function (data) {

        $scope.history = [];
        var i = 0;
        for (i = 0; i < data.length; i++) {
            $scope.history.push(data[i]);
        }
    };

    $scope.onToolboxItem = function (data) {
        if (data.toolbox_name === "Site") {
            var site = util.parse_variables(data.data);
            var i = 0;
            var j = 0;
            var site_copy = new net_models.Group(site.id,
                                             site.name,
                                             site.type,
                                             site.x1,
                                             site.y1,
                                             site.x2,
                                             site.y2,
                                             false);
            var device, device_copy;
            var process, process_copy;
            var intf, intf_copy;
            var device_map = {};
            for (i = 0; i < site.devices.length; i++) {
                device = site.devices[i];
                device_copy = new net_models.Device(device.id,
                                                device.name,
                                                device.x,
                                                device.y,
                                                device.type);
                device_map[device.id] = device_copy;
                device_copy.interface_map = {};
                site_copy.devices.push(device_copy);
                for(j=0; j < device.interfaces.length; j++) {
                    intf = device.interfaces[j];
                    intf_copy = new net_models.Interface(intf.id, intf.name);
                    intf_copy.device = device_copy;
                    device_copy.interfaces.push(intf_copy);
                    device_copy.interface_map[intf.id] = intf_copy;
                }
                for(j=0; j < device.processes.length; j++) {
                    process = device.processes[j];
                    process_copy = new app_models.Process(process.id,
                                                      process.name,
                                                      process.type,
                                                      process.x,
                                                      process.y);
                    process_copy.device = device;
                    device_copy.processes.push(process_copy);
                }
            }
            var group, group_copy;
            for (i = 0; i < site.groups.length; i++) {
                group = site.groups[i];
                group_copy = new net_models.Group(group.id,
                                              group.name,
                                              group.type,
                                              group.x1,
                                              group.y1,
                                              group.x2,
                                              group.y2,
                                              false);
                site_copy.groups.push(group_copy);
            }
            var link, link_copy;
            for (i = 0; i < site.links.length; i++) {
                link = site.links[i];
                link_copy = new net_models.Link(link.id,
                                            device_map[link.from_device_id],
                                            device_map[link.to_device_id],
                                            device_map[link.from_device_id].interface_map[link.from_interface_id],
                                            device_map[link.to_device_id].interface_map[link.to_interface_id]);
                link_copy.name = link.name;
                device_map[link.from_device_id].interface_map[link.from_interface_id].link = link_copy;
                device_map[link.to_device_id].interface_map[link.to_interface_id].link = link_copy;
                site_copy.links.push(link_copy);
            }

            var stream, stream_copy;

            for(i = 0; i < site.streams.length;i++) {
                stream = site.streams[i];
                stream_copy = new net_models.Stream(stream.id,
                                                device_map[stream.from_device],
                                                device_map[stream.to_device],
                                                stream.label);
                site_copy.streams.push(stream_copy);
            }
            $scope.site_toolbox.items.push(site_copy);
        }
    };

    $scope.onSnapshot = function (data) {

        //Erase the existing state
        $scope.devices = [];
        $scope.links = [];
        $scope.groups = [];
        $scope.streams = [];

        var device_map = {};
        var device_interface_map = {};
        var i = 0;
        var j = 0;
        var device = null;
        var intf = null;
        var new_device = null;
        var new_intf = null;
        var max_device_id = null;
        var max_link_id = null;
        var max_group_id = null;
        var max_stream_id = null;
        var min_x = null;
        var min_y = null;
        var max_x = null;
        var max_y = null;
        var new_link = null;
        var new_group = null;
        var process = null;
        var new_process = null;
        var new_stream = null;

        //Build the devices
        for (i = 0; i < data.devices.length; i++) {
            device = data.devices[i];
            if (max_device_id === null || device.id > max_device_id) {
                max_device_id = device.id;
            }
            if (min_x === null || device.x < min_x) {
                min_x = device.x;
            }
            if (min_y === null || device.y < min_y) {
                min_y = device.y;
            }
            if (max_x === null || device.x > max_x) {
                max_x = device.x;
            }
            if (max_y === null || device.y > max_y) {
                max_y = device.y;
            }
            new_device = new net_models.Device(device.id,
                                           device.name,
                                           device.x,
                                           device.y,
                                           device.device_type,
                                           device.host_id);

            for (j=0; j < $scope.inventory_toolbox.items.length; j++) {
                 if($scope.inventory_toolbox.items[j].name === device.name) {
                     $scope.inventory_toolbox.items.splice(j, 1);
                     break;
                 }
            }
            new_device.interface_seq = util.natural_numbers(device.interface_id_seq);
            new_device.process_id_seq = util.natural_numbers(device.process_id_seq);
            $scope.devices.push(new_device);
            device_map[device.id] = new_device;
            device_interface_map[device.id] = {};
            for (j = 0; j < device.processes.length; j++) {
                process = device.processes[j];
                new_process = (new app_models.Process(process.id,
                                                  process.name,
                                                  process.process_type,
                                                  0,
                                                  0));
                new_process.device = new_device;
                new_device.processes.push(new_process);
            }
            for (j = 0; j < device.interfaces.length; j++) {
                intf = device.interfaces[j];
                new_intf = (new net_models.Interface(intf.id,
                                                 intf.name));
                new_intf.device = new_device;
                device_interface_map[device.id][intf.id] = new_intf;
                new_device.interfaces.push(new_intf);
            }
        }

        //Build the links
        var link = null;
        for (i = 0; i < data.links.length; i++) {
            link = data.links[i];
            if (max_link_id === null || link.id > max_link_id) {
                max_link_id = link.id;
            }
            new_link = new net_models.Link(link.id,
                                       device_map[link.from_device_id],
                                       device_map[link.to_device_id],
                                       device_interface_map[link.from_device_id][link.from_interface_id],
                                       device_interface_map[link.to_device_id][link.to_interface_id]);
            new_link.name = link.name;
            $scope.links.push(new_link);
            device_interface_map[link.from_device_id][link.from_interface_id].link = new_link;
            device_interface_map[link.to_device_id][link.to_interface_id].link = new_link;
        }

        //Build the streams
        var stream = null;
        for (i = 0; i < data.streams.length; i++) {
            stream = data.streams[i];
            if (max_stream_id === null || stream.id > max_stream_id) {
                max_stream_id = stream.id;
            }
            new_stream = new app_models.Stream(stream.id,
                                           device_map[stream.from_id],
                                           device_map[stream.to_id],
                                           stream.label);
            $scope.streams.push(new_stream);
        }

        //Build the groups
        var group = null;
        for (i = 0; i < data.groups.length; i++) {
            group = data.groups[i];
            if (max_group_id === null || group.id > max_group_id) {
                max_group_id = group.id;
            }
            new_group = new net_models.Group(group.id,
                                         group.name,
                                         group.group_type,
                                         group.x1,
                                         group.y1,
                                         group.x2,
                                         group.y2,
                                         false);
            new_group.group_id = group.inventory_group_id;
            if (group.members !== undefined) {
                for (j=0; j < group.members.length; j++) {
                    new_group.devices.push(device_map[group.members[j]]);
                }
            }
            $scope.groups.push(new_group);
        }

        //Update group membership

        for (i = 0; i < $scope.groups.length; i++) {
            $scope.groups[i].update_membership($scope.devices, $scope.groups);
        }

        var diff_x;
        var diff_y;

        // Calculate the new scale to show the entire diagram
        if (min_x !== null && min_y !== null && max_x !== null && max_y !== null) {
            diff_x = max_x - min_x;
            diff_y = max_y - min_y;

            $scope.current_scale = Math.min(2, Math.max(0.10, Math.min((window.innerWidth-200)/diff_x, (window.innerHeight-300)/diff_y)));
            $scope.$emit('awxNet-UpdateZoomWidget', $scope.current_scale, true);
            $scope.updateScaledXY();
            $scope.updatePanAndScale();
        }
        // Calculate the new panX and panY to show the entire diagram
        if (min_x !== null && min_y !== null) {
            diff_x = max_x - min_x;
            diff_y = max_y - min_y;
            $scope.panX = $scope.current_scale * (-min_x - diff_x/2) + window.innerWidth/2;
            $scope.panY = $scope.current_scale * (-min_y - diff_y/2) + window.innerHeight/2;
            $scope.updateScaledXY();
            $scope.updatePanAndScale();
        }

        //Update the device_id_seq to be greater than all device ids to prevent duplicate ids.
        if (max_device_id !== null) {
            $scope.device_id_seq = util.natural_numbers(max_device_id);
        }
        //
        //Update the link_id_seq to be greater than all link ids to prevent duplicate ids.
        if (max_link_id !== null) {
            $scope.link_id_seq = util.natural_numbers(max_link_id);
        }
        //Update the stream_id_seq to be greater than all stream ids to prevent duplicate ids.
        if (max_stream_id !== null) {
            $scope.stream_id_seq = util.natural_numbers(max_stream_id);
        }
        //Update the group_id_seq to be greater than all group ids to prevent duplicate ids.
        if (max_group_id !== null) {
            $scope.group_id_seq = util.natural_numbers(max_group_id);
        }

        $scope.updateInterfaceDots();
        $scope.$emit('instatiateSelect', $scope.devices);
        $scope.$emit('awxNet-breadcrumbGroups', $scope.breadcrumbGroups());
        $scope.update_device_variables();
    };

    $scope.update_device_variables = function () {

      var hosts_by_id = {};
      var i = 0;
      for (i = 0; i < $scope.devices.length; i++) {
          hosts_by_id[$scope.devices[i].host_id] = $scope.devices[i];
      }

    };

    $scope.updateInterfaceDots = function() {
        var i = 0;
        var j = 0;
        var devices = $scope.devices;
        for (i = devices.length - 1; i >= 0; i--) {
            for (j = devices[i].interfaces.length - 1; j >= 0; j--) {
                devices[i].interfaces[j].dot();
            }
        }
    };

    $scope.control_socket.onmessage = function(message) {
        $scope.first_channel.send('Message', message);
        $scope.$apply();
    };

    $scope.control_socket.onopen = function() {
        //ignore
    };

    $scope.send_initial_messages = function() {
        var i = 0;
        var messages_to_send = $scope.initial_messages;
        var message = null;
        var data = null;
        $scope.initial_messages = [];
        for(i = 0; i < messages_to_send.length; i++) {
            message = messages_to_send[i];
            message.sender = $scope.client_id;
            data = core_messages.serialize(message);
            $scope.control_socket.send(data);
        }
    };

    // Call onopen directly if $scope.control_socket is already open
    if ($scope.control_socket.readyState === WebSocket.OPEN) {
        $scope.control_socket.onopen();
    }

    $scope.send_control_message = function (message) {
        var i = 0;
        message.sender = $scope.client_id;
        message.message_id = $scope.message_id_seq();
        if (message.constructor.name === "MultipleMessage") {
            for (i=0; i < message.messages.length; i++) {
                message.messages[i].message_id = $scope.message_id_seq();
            }
        }
        var data = core_messages.serialize(message);
        if (!$scope.disconnected) {
            $scope.control_socket.send(data);
        } else {
            console.log(message);
        }
    };


    // End web socket
    //
    //

    angular.element($window).bind('resize', function(){

        var i = 0;


        for (i = 0; i < $scope.viewport_update_subscribers.length; i++) {
            $scope.viewport_update_subscribers[i].update_size($window);
        }

        // manuall $digest required as resize event
        // is outside of angular
        $scope.$digest();
    });

    //60fps ~ 17ms delay
    setInterval( function () {
        $scope.frame = Math.floor(window.performance.now());
        $scope.$apply();
    }, 17);

    console.log("Network UI started");

    $scope.$on('$destroy', function () {
        console.log("Network UI stopping");
        $scope.first_channel.send('UnbindDocument', {});
    });

    $scope.update_toolbox_heights = function(){
        toolboxTopMargin = 0;
        toolboxTitleMargin = toolboxTopMargin + 35;
        toolboxHeight = $scope.graph.height - toolboxTopMargin;

        let toolboxes = ['site_toolbox', 'rack_toolbox', 'inventory_toolbox', 'app_toolbox'];
        toolboxes.forEach((toolbox) => {
            $scope[toolbox].y = toolboxTopMargin;
            $scope[toolbox].height = toolboxHeight;
            $scope[toolbox].title_coordinates.y = toolboxTitleMargin;
        });

        $scope.action_icons.forEach((icon) => {
            actionIconVerticalOffset = toolboxTopMargin + (toolboxHeight/2);
            icon.y = actionIconVerticalOffset;
        });

        //$('.Networking-detailPanel').height(toolboxHeight);
        //$('.Networking-detailPanel').css('top', toolboxTopMargin);
    };

    $scope.update_size = function ($window) {
        $scope.update_toolbox_heights($window);
    };

    $scope.update_offsets = function () {

        var i = 0;
        var streams = $scope.streams;
        var map = new Map();
        var stream = null;
        var key = null;
        for (i = 0; i < streams.length; i++) {
            stream = streams[i];
            key = "" + stream.from_device.id + "_" + stream.to_device.id;
            map.set(key, 0);
        }
        for (i = 0; i < streams.length; i++) {
            stream = streams[i];
            key = "" + stream.from_device.id + "_" + stream.to_device.id;
            stream.offset = map.get(key);
            map.set(key, stream.offset + 1);
        }
    };

    setInterval( function () {
        var test_event = null;
        if ($scope.test_events.length  > 0) {
            test_event = $scope.test_events.shift();
            test_event.sender = 0;
            try {
                $scope.first_channel.send(test_event.msg_type, test_event);
            } catch (err) {
                console.log(["Test Error:", $scope.current_test, err]);
                $scope.test_errors.push(err);
            }
        }
        $scope.$apply();
    }, 10);

    //ConfigService
    //    .getConfig()
    //    .then(function(config){
    //        $scope.version = config.version;
    //    });
    $http.get("/network_ui/version")
        .then(function(response) {
            console.log(response.data);
            console.log(response.data.version);
            $scope.version = response.data.version;
        })
        .catch(({data, status}) => {
             console.log([data, status]);
             //ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to get host data: ' + status });
        });

    $scope.reset_coverage = function() {
        var i = null;
        var coverage = null;
        var f = null;
        if (typeof(window.__coverage__) !== "undefined" && window.__coverage__ !== null) {
            for (f in window.__coverage__) {
                coverage = window.__coverage__[f];
                for (i in coverage.b) {
                    coverage.b[i] = [0, 0];
                }
                for (i in coverage.f) {
                    coverage.f[i] = 0;
                }
                for (i in coverage.s) {
                    coverage.s[i] = 0;
                }
            }
        }
    };

    $scope.reset_flags = function () {
      $scope.debug = {'hidden': true};
      $scope.hide_buttons = false;
      $scope.hide_links = false;
      $scope.hide_interfaces = false;
      $scope.hide_groups = false;
    };


    $scope.reset_fsm_state = function () {
        $scope.null_controller.state = null_fsm.Start;
        $scope.null_controller.state.start($scope.null_controller);
        $scope.hotkeys_controller.state = hotkeys.Start;
        $scope.hotkeys_controller.state.start($scope.hotkeys_controller);
        $scope.keybindings_controller.state = keybindings.Start;
        $scope.keybindings_controller.state.start($scope.keybindings_controller);
        $scope.view_controller.state = view.Start;
        $scope.view_controller.state.start($scope.view_controller);
        $scope.device_detail_controller.state = device_detail_fsm.Start;
        $scope.device_detail_controller.state.start($scope.device_detail_controller);
        $scope.move_controller.state = move.Start;
        $scope.move_controller.state.start($scope.move_controller);
        $scope.details_panel_controller.state = details_panel_fsm.Start;
        $scope.details_panel_controller.state.start($scope.details_panel_controller);
        $scope.link_controller.state = link.Start;
        $scope.link_controller.state.start($scope.link_controller);
        $scope.stream_controller.state = stream_fsm.Start;
        $scope.stream_controller.state.start($scope.stream_controller);
        $scope.group_controller.state = group.Start;
        $scope.group_controller.state.start($scope.group_controller);
        $scope.rack_controller.state = rack_fsm.Disable;
        $scope.rack_controller.state.start($scope.rack_controller);
        $scope.site_controller.state = site_fsm.Disable;
        $scope.site_controller.state.start($scope.site_controller);
        $scope.buttons_controller.state = buttons.Start;
        $scope.buttons_controller.state.start($scope.buttons_controller);
        $scope.time_controller.state = time.Start;
        $scope.time_controller.state.start($scope.time_controller);
        $scope.app_toolbox_controller.state = toolbox_fsm.Start;
        $scope.app_toolbox_controller.state.start($scope.app_toolbox_controller);
        $scope.inventory_toolbox_controller.state = toolbox_fsm.Start;
        $scope.inventory_toolbox_controller.state.start($scope.inventory_toolbox_controller);
        $scope.rack_toolbox_controller.state = toolbox_fsm.Start;
        $scope.rack_toolbox_controller.state.start($scope.rack_toolbox_controller);
        $scope.site_toolbox_controller.state = toolbox_fsm.Start;
        $scope.site_toolbox_controller.state.start($scope.site_toolbox_controller);
        $scope.mode_controller.state = mode_fsm.Start;
        $scope.mode_controller.state.start($scope.mode_controller);
    };

    $scope.reset_history =  function () {
        $scope.history = [];
    };

    $scope.reset_toolboxes = function () {
        $scope.app_toolbox.items = [];
        $scope.app_toolbox.items.push(new app_models.Process(0, 'BGP', 'process', 0, 0));
        $scope.app_toolbox.items.push(new app_models.Process(0, 'OSPF', 'process', 0, 0));
        $scope.app_toolbox.items.push(new app_models.Process(0, 'STP', 'process', 0, 0));
        $scope.app_toolbox.items.push(new app_models.Process(0, 'Zero Pipeline', 'process', 0, 0));

        for(i = 0; i < $scope.app_toolbox.items.length; i++) {
            $scope.app_toolbox.items[i].icon = true;
        }
        $scope.inventory_toolbox.items = [];
        $scope.rack_toolbox.items = [];
        $scope.site_toolbox.items = [];
    };

    $scope.cancel_animations = function () {

        var i = 0;
        for (i = 0; i < $scope.animations.length; i++) {
            this.animations[i].fsm.handle_message('AnimationCancelled');
        }
        $scope.animations = [];
    };

    //fake_data.load_fake_data($scope);
};

exports.NetworkUIController = NetworkUIController;
console.log("Network UI loaded");
