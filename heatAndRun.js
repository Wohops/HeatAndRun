var red = {r:255, g:0, b:0};
var yellow = {r:255, g:255, b:0};
var blue = {r:0, g:0, b:255};
var green = {r:0, g:255, b:0};
var white = {r:255, g:255, b:255};
var EMPTY_ARRAY = [];

var map = L.map('map');
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	  attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
}).addTo(map);

initForm("#ConfigForm", map);


var currentFile = 'trail.gpx'
var currentLayer = loadGPX(currentFile, map); // URL to your GPX file or the GPX itself

function loadGPX(gpx_file, map, config_options) {
	return new L.GPX(
		gpx_file, {
		  async: true,
		  marker_options: {
	          startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
	          endIconUrl:   'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
	          shadowUrl:    'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
	      },
	      'scales': {
	        'hr': {
	          'zones': [80, 125, 150, 170, 185],
	          'colors': ['gray', 'green', 'lime', 'yellow', 'red', 'darkred'],
	          'gradient': EMPTY_ARRAY.concat(
	              generateGradient(green, yellow, 25), 
	              generateGradient(yellow, red, 25))
	        },
	        'cad': {
	          'zones': [40, 60, 80, 90, 100],
	          'colors': ['gray', 'red', 'orange', 'green', 'blue', 'purple'],
	          'gradient': EMPTY_ARRAY.concat(
	              generateGradient(red, green, 25), 
	              generateGradient(green, blue, 25))
	        },
	        'pace': {
	          'zones': [3, 4.5, 5, 7, 9],
	          'colors': ['gray', 'green', 'lime', 'yellow', 'red', 'darkred'],
	          'gradient': EMPTY_ARRAY.concat(
                  generateGradient(green, yellow, 25), 
                  generateGradient(yellow, red, 25))
	        },
	        'vspeed': {
	          'zones': [-200,0,100,500,700],
	          'colors': ['purple', 'blue', 'gray', 'yellow', 'lime', 'green'],
	          'gradient': EMPTY_ARRAY.concat(
                  generateGradient(blue, white, 25), 
                  generateGradient(white, green, 25))
	        }
	      },
	      polyline_options: {
	    	  opacity: 1.0
	      },
	      config_options: config_options ? config_options : null
		}).on('loaded', function(e) {
	  map.fitBounds(e.target.getBounds());
	}).addTo(map);
}



function initForm(formName, map) {
	$(formName).submit(function( event ) {
		event.preventDefault();
		var values = getValues(formName);
		map.removeLayer(currentLayer);
		currentLayer = loadGPX(currentFile, map, values);
	});
	
	$(formName + ' :input[name="measure"]').on('change', function() {
		var values = getValues(formName);
		map.removeLayer(currentLayer);
		currentLayer = loadGPX(currentFile, map, values);
	});
}


function getValues(target, map) {
  var $inputs = $(target +' :input');

  var values = {};
  $inputs.each(function() {
	  if (this.name) {
		  values[this.name] = $(this).val();
	  }
  });
  values["mode"] = $(target +' :input[name="mode"]:checked').val();
  values["measure"] = $(target +' :input[name="measure"]:checked').val();
  return values;
}

function makeGradientColor(color1, color2, percent) {
    var newColor = {};

    function makeChannel(a, b) {
        return(a + Math.round((b-a)*(percent/100)));
    }

    function makeColorPiece(num) {
        num = Math.min(num, 255);   // not more than 255
        num = Math.max(num, 0);     // not less than 0
        var str = num.toString(16);
        if (str.length < 2) {
            str = "0" + str;
        }
        return(str);
    }

    newColor.r = makeChannel(color1.r, color2.r);
    newColor.g = makeChannel(color1.g, color2.g);
    newColor.b = makeChannel(color1.b, color2.b);
    newColor.cssColor = "#" + 
                        makeColorPiece(newColor.r) + 
                        makeColorPiece(newColor.g) + 
                        makeColorPiece(newColor.b);
    return(newColor);
}

function generateGradient(color1, color2, numberParts) {
	var colors = [];
	for (var i = 0; i < numberParts; i++) {
		colors[i] = makeGradientColor(color1, color2, i * Math.floor(100 / numberParts)).cssColor;
	}
	return colors;
}
