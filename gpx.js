/**
 * Copyright (C) 2011-2012 Pavel Shramov
 * Copyright (C) 2013 Maxime Petazzoni <maxime.petazzoni@bulix.org>
 * All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * Thanks to Pavel Shramov who provided the initial implementation and Leaflet
 * integration. Original code was at https://github.com/shramov/leaflet-plugins.
 *
 * It was then cleaned-up and modified to record and make available more
 * information about the GPX track while it is being parsed so that the result
 * can be used to display additional information about the track that is
 * rendered on the Leaflet map.
 */

var _MAX_POINT_INTERVAL_MS = 15000;
var _SECOND_IN_MILLIS = 1000;
var _MINUTE_IN_MILLIS = 60 * _SECOND_IN_MILLIS;
var _HOUR_IN_MILLIS = 60 * _MINUTE_IN_MILLIS;

var _DEFAULT_DATASET = 'hr';
var _DEFAULT_MODE = 'gradient';
var _MAX_PACE_FOR_GRADIENT = 14.0; // min/km

var _DEFAULT_MARKER_OPTS = {
  startIconUrl: 'pin-icon-start.png',
  endIconUrl: 'pin-icon-end.png',
  shadowUrl: 'pin-shadow.png',
  iconSize: [33, 50],
  shadowSize: [50, 50],
  iconAnchor: [16, 45],
  shadowAnchor: [16, 47]
};
var _DEFAULT_GPX_OPTS = {
  parseElements: ['track', 'route']
};
L.GPX = L.FeatureGroup.extend({
  initialize: function(gpx, options) {
    options.max_point_interval = options.max_point_interval || _MAX_POINT_INTERVAL_MS;
    options.marker_options = this._merge_objs(
        _DEFAULT_MARKER_OPTS,
        options.marker_options || {});
    options.polyline_options = this._merge_objs(
        options.polyline_options || {});
    options.gpx_options = this._merge_objs(
        _DEFAULT_GPX_OPTS,
        options.gpx_options || {});

    L.Util.setOptions(this, options);

    // Base icon class for track pins.
    L.GPXTrackIcon = L.Icon.extend({ options: options.marker_options });

    this._gpx = gpx;
    this._layers = {};
    this._info = {
      name: null,
      length: 0.0,
      elevation: {gain: 0.0, loss: 0.0, _points: []},
      hr: {avg: 0, _total: 0, _points: []},
      duration: {start: null, end: null, moving: 0, total: 0}
    };

    if (gpx) {
      this._parse(gpx, options, this.options.async);
    }
  },

  get_duration_string: function(duration, hidems) {
    var s = '';

    if (duration >= _HOUR_IN_MILLIS) {
      s += Math.floor(duration / _HOUR_IN_MILLIS) + ':';
      duration = duration % _HOUR_IN_MILLIS;
    }

    var mins = Math.floor(duration / _MINUTE_IN_MILLIS);
    duration = duration % _MINUTE_IN_MILLIS;
    if (mins < 10) s += '0';
    s += mins + '\'';

    var secs = Math.floor(duration / _SECOND_IN_MILLIS);
    duration = duration % _SECOND_IN_MILLIS;
    if (secs < 10) s += '0';
    s += secs;

    if (!hidems && duration > 0) s += '.' + Math.round(Math.floor(duration)*1000)/1000;
    else s += '"';

    return s;
  },

  // Public methods
  to_miles:            function(v) { return v / 1.60934; },
  to_ft:               function(v) { return v * 3.28084; },
  m_to_km:             function(v) { return v / 1000; },
  m_to_mi:             function(v) { return v / 1609.34; },

  get_name:            function() { return this._info.name; },
  get_desc:            function() { return this._info.desc; },
  get_author:          function() { return this._info.author; },
  get_copyright:       function() { return this._info.copyright; },
  get_desc:            function() { return this._info.desc; },
  get_distance:        function() { return this._info.length; },
  get_distance_imp:    function() { return this.to_miles(this.m_to_km(this.get_distance())); },

  get_start_time:      function() { return this._info.duration.start; },
  get_end_time:        function() { return this._info.duration.end; },
  get_moving_time:     function() { return this._info.duration.moving; },
  get_total_time:      function() { return this._info.duration.total; },

  get_moving_pace:     function() { return this.get_moving_time() / this.m_to_km(this.get_distance()); },
  get_moving_pace_imp: function() { return this.get_moving_time() / this.get_distance_imp(); },

  get_moving_speed:    function() { return this.m_to_km(this.get_distance()) / (this.get_moving_time() / (3600 * 1000)) ; },
  get_moving_speed_imp:function() { return this.to_miles(this.m_to_km(this.get_distance())) / (this.get_moving_time() / (3600 * 1000)) ; },

  get_elevation_gain:     function() { return this._info.elevation.gain; },
  get_elevation_loss:     function() { return this._info.elevation.loss; },
  get_elevation_data:     function() {
    var _this = this;
    return this._info.elevation._points.map(
        function(p) { return _this._prepare_data_point(p, _this.m_to_km, null,
            function(a, b) { return a.toFixed(2) + ' km, ' + b.toFixed(0) + ' m'; });
        });
  },
  get_elevation_data_imp: function() {
    var _this = this;
    return this._info.elevation._points.map(
        function(p) { return _this._prepare_data_point(p, _this.m_to_mi, _this.to_ft,
            function(a, b) { return a.toFixed(2) + ' mi, ' + b.toFixed(0) + ' ft'; });
        });
  },

  get_average_hr:         function() { return this._info.hr.avg; },
  get_heartrate_data:     function() {
    var _this = this;
    return this._info.hr._points.map(
        function(p) { return _this._prepare_data_point(p, _this.m_to_km, null,
            function(a, b) { return a.toFixed(2) + ' km, ' + b.toFixed(0) + ' bpm'; });
        });
  },
  get_heartrate_data_imp: function() {
    var _this = this;
    return this._info.hr._points.map(
        function(p) { return _this._prepare_data_point(p, _this.m_to_mi, null,
            function(a, b) { return a.toFixed(2) + ' mi, ' + b.toFixed(0) + ' bpm'; });
        });
  },

  reload: function() {
    this.clearLayers();
    this._parse(this._gpx, this.options, this.options.async);
  },

  // Private methods
  _merge_objs: function(a, b) {
    var _ = {};
    for (var attr in a) { _[attr] = a[attr]; }
    for (var attr in b) { _[attr] = b[attr]; }
    return _;
  },

  _prepare_data_point: function(p, trans1, trans2, trans_tooltip) {
    var r = [trans1 && trans1(p[0]) || p[0], trans2 && trans2(p[1]) || p[1]];
    r.push(trans_tooltip && trans_tooltip(r[0], r[1]) || (r[0] + ': ' + r[1]));
    return r;
  },

  _load_xml: function(url, cb, options, async) {
    if (async == undefined) async = this.options.async;
    if (options == undefined) options = this.options;

    var req = new window.XMLHttpRequest();
    req.open('GET', url, async);
    try {
      req.overrideMimeType('text/xml'); // unsupported by IE
    } catch(e) {}
    req.onreadystatechange = function() {
      if (req.readyState != 4) return;
      if(req.status == 200) cb(req.responseXML, options);
    };
    req.send(null);
  },

  _parse: function(input, options, async) {
    var _this = this;
    var cb = function(gpx, options) {
      var layers = _this._parse_gpx_data(gpx, options);
      if (!layers) return;
      _this.addLayer(layers);
      _this.fire('loaded');
    }
    if (input.substr(0,1)==='<') { // direct XML has to start with a <
      var parser = new DOMParser();
      setTimeout(function() {
        cb(parser.parseFromString(input, "text/xml"), options);
      });
    } else {
      this._load_xml(input, cb, options, async);
    }
  },

  _parse_gpx_data: function(xml, options) {
    var j, i, el, layers = [];
    var tags = [];
    var parseElements = options.gpx_options.parseElements;
    if(parseElements.indexOf('route') > -1) {
      tags.push(['rte','rtept']);
    }
    if(parseElements.indexOf('track') > -1) {
      tags.push(['trkseg','trkpt']);
    }

    var name = xml.getElementsByTagName('name');
    if (name.length > 0) {
      this._info.name = name[0].textContent;
    }
    var desc = xml.getElementsByTagName('desc');
    if (desc.length > 0) {
      this._info.desc = desc[0].textContent;
    }
    var author = xml.getElementsByTagName('author');
    if (author.length > 0) {
      this._info.author = author[0].textContent;
    }
    var copyright = xml.getElementsByTagName('copyright');
    if (copyright.length > 0) {
      this._info.copyright = copyright[0].textContent;
    }

    for (j = 0; j < tags.length; j++) {
      el = xml.getElementsByTagName(tags[j][0]);
      for (i = 0; i < el.length; i++) {
        var data = this._extract_data(el[i], options, tags[j][1]);
        var measures = this._extract_measures(data, options);
        var zonesCoords = this._extract_zones(data, options, measures);

        for (var z = 0; z < zonesCoords.length; z++) {
          if (zonesCoords[z]) {
            this._addTrack(layers,zonesCoords[z],options);
          }
        }

        if (options.marker_options.startIconUrl) {
          // add start pin
          var firstSegment = zonesCoords[0];
          var p = new L.Marker(firstSegment.coords[0], {
            clickable: false,
            icon: new L.GPXTrackIcon({iconUrl: options.marker_options.startIconUrl})
          });
          this.fire('addpoint', { point: p });
          layers.push(p);
        }

        if (options.marker_options.endIconUrl) {
          // add end pin
          var lastSegment = zonesCoords[zonesCoords.length - 1];
          p = new L.Marker(lastSegment.coords[lastSegment.coords.length - 1], {
            clickable: false,
            icon: new L.GPXTrackIcon({iconUrl: options.marker_options.endIconUrl})
          });
          this.fire('addpoint', { point: p });
          layers.push(p);
        }
      }
    }

    this._info.hr.avg = Math.round(this._info.hr._total / this._info.hr._points.length);

    if (!layers.length) return;
    var layer = layers[0];
    if (layers.length > 1)
      layer = new L.FeatureGroup(layers);
    return layer;
  },

  _addTrack: function(layers,segment,options) {
    var dataset = _DEFAULT_DATASET;
    var mode = _DEFAULT_MODE; 
    if (options.config_options) {
        dataset = options.config_options.measure;
        mode = options.config_options.mode;
    }
    var colors = options.scales[dataset][mode === 'zones' ? 'zonesColors' : 'gradient'];
	var selectedColor = colors[segment.zone];
	if (!selectedColor) {
	  selectedColor = colors[colors.length - 1];
	}
	options.polyline_options.color = selectedColor;
	var l = new L.Polyline(segment.coords, options.polyline_options);
	this.fire('addline', { line: l })
	layers.push(l);
  },
  
  _extract_data : function(line, options, tag) {
    var el = line.getElementsByTagName(tag);
    if (!el.length)
      return [];
    
    var data = [];
    var last = null;
    var vspeeds = [];

    for (var i = 0; i < el.length; i++) {
      var ll = this._extract_point_data(el[i], last, vspeeds, options);
      data.push(ll);
      last = ll;
    }
    return data;
  },

  _extract_measures : function(points, options, tag) {
    if (!points.length)
      return [];
    var measures = {};

    for (var i = 0; i < points.length; i++) {
      var ll = points[i];
      for (var key in ll.meta) {
        if (!measures[key]) {
          measures[key] = {
            'min' : Number.MAX_VALUE,
            'max' : Number.MIN_VALUE,
            'avg' : 0,
            'data' : []
          }
        }
        var value = ll.meta[key];
        if (value < measures[key].min) {
          measures[key].min = value;
        }
        if (value > measures[key].max) {
          measures[key].max = value;
        }
        measures[key].avg += value;
        measures[key].data.push(value);
      }
    }
    
    for (var key in measures) {
      measures[key].avg = measures[key].avg / measures[key].data.length;
      measures[key].stdDev = this._standard_deviation(measures[key].data, measures[key].avg);
    }
    
    return measures;
  },
  
  _standard_deviation : function (data, average) {
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
      sum += Math.pow(data[i] - average, 2);
    }
    return Math.sqrt(sum / data.length);
  },

  _extract_zones : function(points, options, measures) {
    if (!points.length)
      return [];
    var zoneIndex = -1;
    var lastZone = 0;
    var currentZone = 0;
    var zonesCoords = [];

    for (var i = 0; i < points.length; i++) {
      var ll = points[i];

      var dataset = _DEFAULT_DATASET;
      var customZones = _DEFAULT_MODE === 'zones';
      if (options.config_options) {
    	  dataset = options.config_options.measure;
    	  customZones = options.config_options.mode === 'zones';
      }
      
      var targetZones = options.scales[dataset].zones;
      if (!customZones) {
        targetZones = this._generateZones(dataset, measures[dataset], options.scales[dataset].gradient.length);
      }

      currentZone = this._getZone(ll.meta[dataset], targetZones);
      
      if (currentZone != lastZone){
        zoneIndex++;
        lastZone = currentZone;
        if (zonesCoords[zoneIndex-1]) {
          zonesCoords[zoneIndex-1].coords.push(ll);
        }
      }
      if (!zonesCoords[zoneIndex]){
        zonesCoords[zoneIndex]={
          zone:currentZone,
          coords:[]
        };
      }
      zonesCoords[zoneIndex].coords.push(ll);
    }
    return zonesCoords;
  },
  
  _generateZones: function(dataset, measures, numberZones) {
    var min = measures.min;
    var max = dataset === 'pace' ? _MAX_PACE_FOR_GRADIENT : measures.max;
    var scale = (max - min) / numberZones;
    var zones = [];
    zones.push(min);
    for (var i = 1; i < numberZones - 1; i++) {
      zones.push(min + (i * scale));
    }
    zones.push(max);
    return zones;
  },

  _extract_point_data : function(point, lastPoint, vspeeds, options) {
    var _, ll = new L.LatLng(point.getAttribute('lat'), point
        .getAttribute('lon'));
    ll.meta = {
      time : null,
      ele : null,
      hr : null
    };

    _ = point.getElementsByTagName('time');
    if (_.length > 0) {
      ll.meta.time = new Date(Date.parse(_[0].textContent));
    }

    _ = point.getElementsByTagName('ele');
    if (_.length > 0) {
      ll.meta.ele = parseFloat(_[0].textContent);
    }

    _ = point.getElementsByTagNameNS('*', 'hr');
    if (_.length > 0) {
      ll.meta.hr = parseInt(_[0].textContent);
      this._info.hr._points.push([ this._info.length, ll.meta.hr ]);
      this._info.hr._total += ll.meta.hr;
    }

    _ = point.getElementsByTagNameNS('*', 'cad');
    if (_.length > 0) {
      ll.meta.cad = parseFloat(_[0].textContent);
    }

    this._info.elevation._points.push([ this._info.length, ll.meta.ele ]);
    this._info.duration.end = ll.meta.time;

    if (lastPoint != null) {
      var d = this._dist3d(lastPoint, ll);
      this._info.length += d;

      var e = ll.meta.ele - lastPoint.meta.ele;
      if (e > 0)
        this._info.elevation.gain += e;
      else
        this._info.elevation.loss += Math.abs(e);

      var t = Math.abs(ll.meta.time - lastPoint.meta.time);
      this._info.duration.total += t;
      if (t < options.max_point_interval)
        this._info.duration.moving += t;

      // speed
      ll.meta.speed = d / t;

      // pace
      ll.meta.pace = t / d / 60;

      // elevation speed
      var vspeed = e / t;
      vspeeds.unshift(vspeed);
      if (vspeeds.length > 10) {
        vspeeds.pop();
      }

      var vspeedMean = 0;
      for (var v = 0; v < vspeeds.length; v++) {
        vspeedMean += vspeed;
      }

      ll.meta.vspeed = vspeedMean / vspeeds.length;
    } else {
      this._info.duration.start = ll.meta.time;
    }
    return ll;
  },

  _getZone: function(data,zones) {
	  for (var i = 0; i < zones.length; i++) {
		if (data < zones[i]) {
			return i;
		}
	  }
	  return zones.length;
  },

  _dist2d: function(a, b) {
    var R = 6371000;
    var dLat = this._deg2rad(b.lat - a.lat);
    var dLon = this._deg2rad(b.lng - a.lng);
    var r = Math.sin(dLat/2) *
        Math.sin(dLat/2) +
        Math.cos(this._deg2rad(a.lat)) *
        Math.cos(this._deg2rad(b.lat)) *
        Math.sin(dLon/2) *
        Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(r), Math.sqrt(1-r));
    var d = R * c;
    return d;
  },

  _dist3d: function(a, b) {
    var planar = this._dist2d(a, b);
    var height = Math.abs(b.meta.ele - a.meta.ele);
    return Math.sqrt(Math.pow(planar, 2) + Math.pow(height, 2));
  },

  _deg2rad: function(deg) {
    return deg * Math.PI / 180;
  }
});