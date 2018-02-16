//Map of Universities of Salzburg


// WGS84 Coordinate System

// creating variable 'map'
var map = L.map('map', {
    center: [45.0, 11.0],
    zoom: 4.5
});


//basemap
var Esri_NatGeoWorldMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
	maxZoom: 16
});
var OpenSeaMap = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
	attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
});
var Stamen_TonerHybrid = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-hybrid/{z}/{x}/{y}.{ext}', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	subdomains: 'abcd',
	minZoom: 0,
	maxZoom: 20,
	ext: 'png'
});
Esri_NatGeoWorldMap.addTo(map);




/////////////////////////////////////////////////////////////
// snake funcion


///// FIXME: Use path._rings instead of path._latlngs???
///// FIXME: Panic if this._map doesn't exist when called.
///// FIXME: Implement snakeOut()
///// FIXME: Implement layerGroup.snakeIn() / Out()


L.Polyline.include({

	// Hi-res timestamp indicating when the last calculations for vertices and
	// distance took place.
	_snakingTimestamp: 2000,

	// How many rings and vertices we've already visited
	// Yeah, yeah, "rings" semantically only apply to polygons, but L.Polyline
	// internally uses that nomenclature.
	_snakingRings: 0,
	_snakingVertices: 0,

	// Distance to draw (in screen pixels) since the last vertex
	_snakingDistance: 0,

	// Flag
	_snaking: false,


	/// TODO: accept a 'map' parameter, fall back to addTo() in case
	/// performance.now is not available.
	snakeIn: function(){

		if (this._snaking) { return; }

		if ( !('performance' in window) ||
		     !('now' in window.performance) ||
		     !this._map) {
			return;
		}

		this._snaking = true;
		this._snakingTime = performance.now();
		this._snakingVertices = this._snakingRings = this._snakingDistance = 0;

		if (!this._snakeLatLngs) {
			this._snakeLatLngs = L.Polyline._flat(this._latlngs) ?
				[ this._latlngs ] :
				this._latlngs ;
		}

		// Init with just the first (0th) vertex in a new ring
		// Twice because the first thing that this._snake is is chop the head.
		this._latlngs = [[ this._snakeLatLngs[0][0], this._snakeLatLngs[0][0] ]];

		this._update();
		this._snake();
		this.fire('snakestart');
		return this;
	},


	_snake: function(){

		var now = performance.now();
		var diff = now - this._snakingTime;	// In milliseconds
		var forward = diff * this.options.snakingSpeed / 2000;	// In pixels
		this._snakingTime = now;

		// Chop the head from the previous frame
		this._latlngs[ this._snakingRings ].pop();

		return this._snakeForward(forward);
	},

	_snakeForward: function(forward) {

		// Calculate distance from current vertex to next vertex
		var currPoint = this._map.latLngToContainerPoint(
			this._snakeLatLngs[ this._snakingRings ][ this._snakingVertices ]);
		var nextPoint = this._map.latLngToContainerPoint(
			this._snakeLatLngs[ this._snakingRings ][ this._snakingVertices + 1 ]);

		var distance = currPoint.distanceTo(nextPoint);

// 		console.log('Distance to next point:', distance, '; Now at: ', this._snakingDistance, '; Must travel forward:', forward);
// 		console.log('Vertices: ', this._latlngs);

		if (this._snakingDistance + forward > distance) {
			// Jump to next vertex
			this._snakingVertices++;
			this._latlngs[ this._snakingRings ].push( this._snakeLatLngs[ this._snakingRings ][ this._snakingVertices ] );

			if (this._snakingVertices >= this._snakeLatLngs[ this._snakingRings ].length - 1 ) {
				if (this._snakingRings >= this._snakeLatLngs.length - 1 ) {
					return this._snakeEnd();
				} else {
					this._snakingVertices = 0;
					this._snakingRings++;
					this._latlngs[ this._snakingRings ] = [
						this._snakeLatLngs[ this._snakingRings ][ this._snakingVertices ]
					];
				}
			}

			this._snakingDistance -= distance;
			return this._snakeForward(forward);
		}

		this._snakingDistance += forward;

		var percent = this._snakingDistance / distance;

		var headPoint = nextPoint.multiplyBy(percent).add(
			currPoint.multiplyBy( 1 - percent )
		);

		// Put a new head in place.
		var headLatLng = this._map.containerPointToLatLng(headPoint);
		this._latlngs[ this._snakingRings ].push(headLatLng);

		this.setLatLngs(this._latlngs);
		this.fire('snake');
		L.Util.requestAnimFrame(this._snake, this);
	},

	_snakeEnd: function() {

		this.setLatLngs(this._snakeLatLngs);
		this._snaking = false;
		this.fire('snakeend');

	}

});


L.Polyline.mergeOptions({
	snakingSpeed: 100	// In pixels/sec
});





L.LayerGroup.include({

	_snakingLayers: [],
	_snakingLayersDone: 0,

	snakeIn: function() {

		if ( !('performance' in window) ||
		     !('now' in window.performance) ||
		     !this._map ||
		     this._snaking) {
				 
			return;
		}


		this._snaking = true;
		this._snakingLayers = [];
		this._snakingLayersDone = 0;
		var keys = Object.keys(this._layers);
		for (var i in keys) {
			var key = keys[i];
			this._snakingLayers.push(this._layers[key]);
		}
		this.clearLayers();

		this.fire('snakestart');
		return this._snakeNext();
	},


	_snakeNext: function() {


		if (this._snakingLayersDone >= this._snakingLayers.length) {
			this.fire('snakeend');
			this._snaking = false;
			return ;
		}

		var currentLayer = this._snakingLayers[this._snakingLayersDone];

		this._snakingLayersDone++;

		this.addLayer(currentLayer);
		if ('snakeIn' in currentLayer) {
			currentLayer.once('snakeend', function(){
				setTimeout(this._snakeNext.bind(this), this.options.snakingPause);
			}, this);
			currentLayer.snakeIn();
		} else {
			setTimeout(this._snakeNext.bind(this), this.options.snakingPause);
		}


		this.fire('snake');
		return this;
	}

});


L.LayerGroup.mergeOptions({
	snakingPause: 200
});



////////////////////////////////////////////////////////////////////////////////////
//animated marker

L.AnimatedMarker = L.Marker.extend({
  options: {
    // meters
    distance: 200,
    // ms
    interval: 1000,
    // animate on add?
    autoStart: true,
    // callback onend
    onEnd: function(){},
    clickable: false
  },

  initialize: function (latlngs, options) {
    this.setLine(latlngs);
    L.Marker.prototype.initialize.call(this, latlngs[0], options);
  },

  // Breaks the line up into tiny chunks (see options) ONLY if CSS3 animations
  // are not supported.
  _chunk: function(latlngs) {
    var i,
        len = latlngs.length,
        chunkedLatLngs = [];

    for (i=1;i<len;i++) {
      var cur = latlngs[i-1],
          next = latlngs[i],
          dist = cur.distanceTo(next),
          factor = this.options.distance / dist,
          dLat = factor * (next.lat - cur.lat),
          dLng = factor * (next.lng - cur.lng);

      if (dist > this.options.distance) {
        while (dist > this.options.distance) {
          cur = new L.LatLng(cur.lat + dLat, cur.lng + dLng);
          dist = cur.distanceTo(next);
          chunkedLatLngs.push(cur);
        }
      } else {
        chunkedLatLngs.push(cur);
      }
    }
    chunkedLatLngs.push(latlngs[len-1]);

    return chunkedLatLngs;
  },

  onAdd: function (map) {
    L.Marker.prototype.onAdd.call(this, map);

    // Start animating when added to the map
    if (this.options.autoStart) {
      this.start();
    }
  },

  animate: function() {
    var self = this,
        len = this._latlngs.length,
        speed = this.options.interval;

    // Normalize the transition speed from vertex to vertex
    if (this._i < len && this._i > 0) {
      speed = this._latlngs[this._i-1].distanceTo(this._latlngs[this._i]) / this.options.distance * this.options.interval;
    }

    // Only if CSS3 transitions are supported
    if (L.DomUtil.TRANSITION) {
      if (this._icon) { this._icon.style[L.DomUtil.TRANSITION] = ('all ' + speed + 'ms linear'); }
      if (this._shadow) { this._shadow.style[L.DomUtil.TRANSITION] = 'all ' + speed + 'ms linear'; }
    }

    // Move to the next vertex
    this.setLatLng(this._latlngs[this._i]);
    this._i++;

    // Queue up the animation to the next next vertex
    this._tid = setTimeout(function(){
      if (self._i === len) {
        self.options.onEnd.apply(self, Array.prototype.slice.call(arguments));
      } else {
        self.animate();
      }
    }, speed);
  },

  // Start the animation
  start: function() {
    this.animate();
  },

  // Stop the animation in place
  stop: function() {
    if (this._tid) {
      clearTimeout(this._tid);
    }
  },

  setLine: function(latlngs){
    if (L.DomUtil.TRANSITION) {
      // No need to to check up the line if we can animate using CSS3
      this._latlngs = latlngs;
    } else {
      // Chunk up the lines into options.distance bits
      this._latlngs = this._chunk(latlngs);
      this.options.distance = 10;
      this.options.interval = 30;
    }
    this._i = 0;
  }

});

L.animatedMarker = function (latlngs, options) {
  return new L.AnimatedMarker(latlngs, options);
};

var animatedMarker = L.animatedMarker(line.getLatLngs(), {
  icon: FirstTripIcon
});

////////////////////////////////////////////////////////////////////////////////////
//data

var animatedMarker = L.animatedMarker(mFirstTrip.getLatLngs(), {
  icon: FirstTripIcon
});


var mFirstTrip = L.polyline( [ [ 47.803276039597009, 12.985797214921604 ], [ 48.151492657087239, 11.539358957654484 ], [ 48.231850338046527, 16.334033921558458 ], [ 50.080077000110066, 14.405449578535629 ], [ 48.606852849189856, 13.494729194330406 ], [ 48.312208019005809, 14.271520110270155 ], [ 48.205064444393429, 16.334033921558458 ], [ 48.151492657087239, 17.110824837498207 ], [ 47.803276039597009, 12.985797214921604 ] ],
	{"color": "#ff7800", "weight": 6, "opacity": 0.8},
	{snakingSpeed: 2000});
mFirstTrip.addTo(map);


var mSecondTrip = L.polyline ( [ [ 47.803276039597009, 12.985797214921604 ], [ 48.151492657087239, 11.566144851307577 ], [ 48.365779806311998, 10.869711616327113 ], [ 49.390340238542876, 8.572821235574232 ], [ 50.019808739390619, 8.264783458563638 ], [ 50.126952314002999, 8.679964810186609 ], [ 50.36802535688085, 7.595136117236269 ], [ 50.876957336289621, 4.354042985211799 ], [ 48.171582077327045, 11.532662484241207 ], [ 49.484090866328707, 8.452284714135304 ], [ 48.881408259134055, 2.358493908056235 ], [ 51.506425837137343, -0.159380095334677 ], [ 52.095715497505431, 4.287078251079062 ], [ 48.908194152787146, 2.358493908056235 ], [ 47.381398214560747, 8.519249448268042 ], [ 47.970687874928828, 8.465677660961852 ], [ 48.104617343194306, 11.546055431067755 ], [ 48.211760917806686, 16.36751628862482 ] ],
	{"color": "#D41B56", "weight": 4, "opacity": 0.8},
	{snakingSpeed: 2});
mSecondTrip.addTo(map);


var mThirdTrip = L.polyline ( [ [ 47.823365459836801, 12.992493688334875 ], [ 47.260861693121811, 11.398733015975735 ], [ 46.51085667083516, 11.345161228669545 ], [ 45.894781116813981, 11.037123451658953 ], [ 45.452813871537913, 10.983551664352765 ], [ 45.158169041353872, 10.782657461954553 ], [ 45.479599765191011, 9.188896789595413 ], [ 45.318884403272442, 9.496934566606003 ], [ 44.823345370690184, 10.313904323025394 ], [ 44.501914646853045, 11.345161228669545 ], [ 43.778695518219486, 11.251410600883712 ], [ 41.890290015676307, 12.483561708926072 ], [ 40.845640163205609, 14.251430690030329 ], [ 41.890290015676307, 12.483561708926072 ], [ 43.457264794382354, 13.608569242356053 ], [ 44.059947401576984, 12.563919389885356 ], [ 44.501914646853045, 11.345161228669543 ], [ 45.479599765191011, 9.188896789595411 ], [ 45.064418413568042, 7.662100851369007 ], [ 45.492992712017561, 9.188896789595411 ], [ 45.452813871537913, 12.336239293834049 ], [ 45.399242084231723, 11.854093208078343 ], [ 45.54656449932375, 10.206760748413013 ], [ 47.823365459836808, 13.005886635161421 ], [ 45.479599765191011, 9.188896789595411 ], [ 47.809972513010258, 12.992493688334871 ], [ 45.452813871537913, 9.188896789595411 ] ],
	{"color": "#FF0000", "weight": 4, "opacity": 0.8},
	{snakingSpeed: 500});
mThirdTrip.addTo(map);


var mFourthTrip = L.polyline ( [ [ 47.796579566183709, 12.965707794681775 ], [ 48.225153864633228, 16.340730394971718 ], [ 48.14479618367394, 11.546055431067751 ], [ 49.484090866328678, 8.438891767308755 ], [ 48.89480120596059, 2.331708014403143 ], [ 49.457304972675587, 8.438891767308755 ], [ 48.14479618367394, 11.599627218373941 ], [ 47.796579566183709, 12.99249368833487 ], [ 48.171582077327031, 11.572841324720846 ], [ 48.251939758286319, 16.367516288624813 ] ],
	{"color": "#0300FD", "weight": 4, "opacity": 0.8},
	{snakingSpeed: 500});
mFourthTrip.addTo(map);	


var mFifthTrip = L.polyline ( [ [ 48.225153864633228, 16.340730394971718 ], [ 47.796579566183709, 12.99249368833487 ], [ 48.225153864633228, 16.367516288624813 ], [ 50.100166420349858, 14.385360158295798 ], [ 48.225153864633228, 16.367516288624813 ], [ 51.359103422045315, 12.37641813431369 ], [ 51.064458591861275, 13.715712816968429 ], [ 52.537682742781485, 13.367496199478197 ], [ 50.100166420349858, 8.679964810186608 ], [ 49.484090866328678, 8.46567766096185 ] ],
	{"color": "#660066", "weight": 4, "opacity": 0.8},
	{snakingSpeed: 500});	
mFifthTrip.addTo(map);

//creating style for city shape
var myPolygonStyle = {
	"color": 'blue',
	"fillOpacity": 0,
	"weight": 2
}

//staricon
var starIcon = L.icon({
iconUrl: 'css/images/star.png',
iconSize: [12, 12],
});

//first trip icon
var firstTripIcon = L.icon({
iconUrl: 'css/images/firstIcon.png',
iconSize: [20, 20],
});

var allCities = {
"type": "FeatureCollection",
"crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
                                                                                                                                  
"features": [
{ "type": "Feature", "properties": { "id": "1", "name": "Salzburg" }, "geometry": { "type": "Point", "coordinates": [ 13.003368733045299, 47.808980317142939 ] } },
{ "type": "Feature", "properties": { "id": "2", "name": "Munich" }, "geometry": { "type": "Point", "coordinates": [ 11.572166149630215, 48.13858536251869 ] } },
{ "type": "Feature", "properties": { "id": "3", "name": "Vienna" }, "geometry": { "type": "Point", "coordinates": [ 16.374121949014238, 48.207761196363364 ] } },
{ "type": "Feature", "properties": { "id": "4", "name": "Prague" }, "geometry": { "type": "Point", "coordinates": [ 14.419904642902383, 50.087038015810172 ] } },
{ "type": "Feature", "properties": { "id": "5", "name": "Passau" }, "geometry": { "type": "Point", "coordinates": [ 13.461819344153739, 48.573816650458078 ] } },
{ "type": "Feature", "properties": { "id": "6", "name": "Linz" }, "geometry": { "type": "Point", "coordinates": [ 14.284435301623242, 48.305183829027939 ] } },
{ "type": "Feature", "properties": { "id": "7", "name": "Bratislava" }, "geometry": { "type": "Point", "coordinates": [ 17.110268114177916, 48.152420529287625 ] } },
{ "type": "Feature", "properties": { "id": "8", "name": "Augsburg" }, "geometry": { "type": "Point", "coordinates": [ 10.895972373798616, 48.364559753077963 ] } },
{ "type": "Feature", "properties": { "id": "9", "name": "Schwetzingen" }, "geometry": { "type": "Point", "coordinates": [ 8.572817287181865, 49.382597441158637 ] } },
{ "type": "Feature", "properties": { "id": "10", "name": "Mainz" }, "geometry": { "type": "Point", "coordinates": [ 8.270028897790931, 50.000135874542806 ] } },
{ "type": "Feature", "properties": { "id": "11", "name": "Frakfurt on Main" }, "geometry": { "type": "Point", "coordinates": [ 8.681625109166708, 50.112258371899387 ] } },
{ "type": "Feature", "properties": { "id": "12", "name": "Koblenz" }, "geometry": { "type": "Point", "coordinates": [ 7.593402772997785, 50.354229674035238 ] } },
{ "type": "Feature", "properties": { "id": "13", "name": "Brussel" }, "geometry": { "type": "Point", "coordinates": [ 4.351362026811028, 50.846531024896457 ] } },
{ "type": "Feature", "properties": { "id": "14", "name": "Mannheim" }, "geometry": { "type": "Point", "coordinates": [ 8.463865348876519, 49.49183761210503 ] } },
{ "type": "Feature", "properties": { "id": "15", "name": "Paris" }, "geometry": { "type": "Point", "coordinates": [ 2.3487216370079, 48.857725801862252 ] } },
{ "type": "Feature", "properties": { "id": "16", "name": "London" }, "geometry": { "type": "Point", "coordinates": [ -0.127773214631203, 51.51177196036933 ] } },
{ "type": "Feature", "properties": { "id": "17", "name": "The Hague" }, "geometry": { "type": "Point", "coordinates": [ 4.310144759145244, 52.080743193741753 ] } },
{ "type": "Feature", "properties": { "id": "18", "name": "Zurich" }, "geometry": { "type": "Point", "coordinates": [ 8.541976394592782, 47.37159830476601 ] } },
{ "type": "Feature", "properties": { "id": "19", "name": "Donaueschingen" }, "geometry": { "type": "Point", "coordinates": [ 8.500470894285982, 47.948207703125433 ] } },
{ "type": "Feature", "properties": { "id": "20", "name": "Innsbruck" }, "geometry": { "type": "Point", "coordinates": [ 11.392885446916141, 47.266681623434948 ] } },
{ "type": "Feature", "properties": { "id": "21", "name": "Bolzano" }, "geometry": { "type": "Point", "coordinates": [ 11.353685807737497, 46.498829867759142 ] } },
{ "type": "Feature", "properties": { "id": "22", "name": "Rovereto" }, "geometry": { "type": "Point", "coordinates": [ 11.045565114487708, 45.887200203515896 ] } },
{ "type": "Feature", "properties": { "id": "23", "name": "Verona" }, "geometry": { "type": "Point", "coordinates": [ 10.990224447411974, 45.439863144653714 ] } },
{ "type": "Feature", "properties": { "id": "24", "name": "Mantua" }, "geometry": { "type": "Point", "coordinates": [ 10.791920390390594, 45.158548087018737 ] } },
{ "type": "Feature", "properties": { "id": "25", "name": "Milan" }, "geometry": { "type": "Point", "coordinates": [ 9.187041045194308, 45.467533478191591 ] } },
{ "type": "Feature", "properties": { "id": "26", "name": "Lodi" }, "geometry": { "type": "Point", "coordinates": [ 9.500638158623467, 45.310734921477014 ] } },
{ "type": "Feature", "properties": { "id": "27", "name": "Parma" }, "geometry": { "type": "Point", "coordinates": [ 10.326136442503168, 44.803445473282778 ] } },
{ "type": "Feature", "properties": { "id": "28", "name": "Bologna" }, "geometry": { "type": "Point", "coordinates": [ 11.3418682694557, 44.494460082109917 ] } },
{ "type": "Feature", "properties": { "id": "29", "name": "Florence" }, "geometry": { "type": "Point", "coordinates": [ 11.25366908130375, 43.771572618433161 ] } },
{ "type": "Feature", "properties": { "id": "30", "name": "Rome" }, "geometry": { "type": "Point", "coordinates": [ 12.48499892373883, 41.893448729550464 ] } },
{ "type": "Feature", "properties": { "id": "31", "name": "Naples" }, "geometry": { "type": "Point", "coordinates": [ 14.24898268677785, 40.835058471727073 ] } },
{ "type": "Feature", "properties": { "id": "32", "name": "Loreto" }, "geometry": { "type": "Point", "coordinates": [ 13.609106223714683, 43.441834477106958 ] } },
{ "type": "Feature", "properties": { "id": "33", "name": "Rimini" }, "geometry": { "type": "Point", "coordinates": [ 12.566856993788363, 44.059805259452666 ] } },
{ "type": "Feature", "properties": { "id": "34", "name": "Turin" }, "geometry": { "type": "Point", "coordinates": [ 7.681890193790784, 45.066313641892577 ] } },
{ "type": "Feature", "properties": { "id": "35", "name": "Venice" }, "geometry": { "type": "Point", "coordinates": [ 12.335117950408724, 45.437557283525614 ] } },
{ "type": "Feature", "properties": { "id": "36", "name": "Brescia" }, "geometry": { "type": "Point", "coordinates": [ 10.219490365325985, 45.540168103728533 ] } },
{ "type": "Feature", "properties": { "id": "37", "name": "Padua" }, "geometry": { "type": "Point", "coordinates": [ 11.872792794213531, 45.408734019423655 ] } },
{ "type": "Feature", "properties": { "id": "38", "name": "Leipzig" }, "geometry": { "type": "Point", "coordinates": [ 12.375470520151442, 51.333644188219409 ] } },
{ "type": "Feature", "properties": { "id": "39", "name": "Dresden" }, "geometry": { "type": "Point", "coordinates": [ 13.731316863506917, 51.047717408328118 ] } },
{ "type": "Feature", "properties": { "id": "40", "name": "Berlin" }, "geometry": { "type": "Point", "coordinates": [ 13.390049416539892, 52.514245085835057 ] } }
]
};


var cities = L.geoJson(allCities, {
	pointToLayer: function(feature, latlng) { 
		return L.marker(latlng, {icon: starIcon})
		},
	onEachFeature: function(feature, marker) {
			marker.bindPopup(feature.properties.name);;
	}
});
cities.addTo(map);


 

//map.addEventListener('click', function(e) {
  //  alert(e.latlng);
//});


