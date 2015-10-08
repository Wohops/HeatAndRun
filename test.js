var red = {r:255, g:0, b:0};
var blue = {r:0, g:0, b:255};
var GRADIENT1 = ['red', 'yellow', 'green', 'blue', 'cyan'];
var GRADIENT2 = generateGradient(red, blue, 5);
var GRADIENT = GRADIENT1;

var map = L.map('map');
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	  attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
}).addTo(map);

var gpx = 'trail.gpx'; // URL to your GPX file or the GPX itself
new L.GPX(
	gpx, {
	  async: true,
	  marker_options: {
          startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
          endIconUrl:   'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
          shadowUrl:    'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
      },
      gradient: GRADIENT,
      polyline_options: {
    	  opacity: 1.0
      }
	}).on('loaded', function(e) {
  map.fitBounds(e.target.getBounds());
}).addTo(map);


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
		colors[i] = makeGradientColor(red, blue, i * Math.floor(100 / numberParts)).cssColor;
	}
	return colors;
}