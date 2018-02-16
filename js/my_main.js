//Map of Universities of Salzburg


// WGS84 Coordinate System

// creating variable 'map'
var map = L.map('map', {
    center: [47.0, 11.0],
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
//data

var mFirstTrip = L.polyline( [ [ 47.803276039597009, 12.985797214921604 ], [ 48.151492657087239, 11.539358957654484 ], [ 48.231850338046527, 16.334033921558458 ], [ 50.080077000110066, 14.405449578535629 ], [ 48.606852849189856, 13.494729194330406 ], [ 48.312208019005809, 14.271520110270155 ], [ 48.205064444393429, 16.334033921558458 ], [ 48.151492657087239, 17.110824837498207 ], [ 47.803276039597009, 12.985797214921604 ] ],
	{"color": "#ff7800", "weight": 3, "opacity": 0.8},
	{snakingSpeed: 2000});
mFirstTrip.addTo(map);


var mSecondTrip = L.polyline ( [ [ 47.803276039597009, 12.985797214921604 ], [ 48.151492657087239, 11.566144851307577 ], [ 48.365779806311998, 10.869711616327113 ], [ 49.390340238542876, 8.572821235574232 ], [ 50.019808739390619, 8.264783458563638 ], [ 50.126952314002999, 8.679964810186609 ], [ 50.36802535688085, 7.595136117236269 ], [ 50.876957336289621, 4.354042985211799 ], [ 48.171582077327045, 11.532662484241207 ], [ 49.484090866328707, 8.452284714135304 ], [ 48.881408259134055, 2.358493908056235 ], [ 51.506425837137343, -0.159380095334677 ], [ 52.095715497505431, 4.287078251079062 ], [ 48.908194152787146, 2.358493908056235 ], [ 47.381398214560747, 8.519249448268042 ], [ 47.970687874928828, 8.465677660961852 ], [ 48.104617343194306, 11.546055431067755 ], [ 48.211760917806686, 16.36751628862482 ] ],
	{"color": "#D41B56", "weight": 2, "opacity": 0.8},
	{snakingSpeed: 2});
mSecondTrip.addTo(map);


var mThirdTrip = L.polyline ( [ [ 47.823365459836801, 12.992493688334875 ], [ 47.260861693121811, 11.398733015975735 ], [ 46.51085667083516, 11.345161228669545 ], [ 45.894781116813981, 11.037123451658953 ], [ 45.452813871537913, 10.983551664352765 ], [ 45.158169041353872, 10.782657461954553 ], [ 45.479599765191011, 9.188896789595413 ], [ 45.318884403272442, 9.496934566606003 ], [ 44.823345370690184, 10.313904323025394 ], [ 44.501914646853045, 11.345161228669545 ], [ 43.778695518219486, 11.251410600883712 ], [ 41.890290015676307, 12.483561708926072 ], [ 40.845640163205609, 14.251430690030329 ], [ 41.890290015676307, 12.483561708926072 ], [ 43.457264794382354, 13.608569242356053 ], [ 44.059947401576984, 12.563919389885356 ], [ 44.501914646853045, 11.345161228669543 ], [ 45.479599765191011, 9.188896789595411 ], [ 45.064418413568042, 7.662100851369007 ], [ 45.492992712017561, 9.188896789595411 ], [ 45.452813871537913, 12.336239293834049 ], [ 45.399242084231723, 11.854093208078343 ], [ 45.54656449932375, 10.206760748413013 ], [ 47.823365459836808, 13.005886635161421 ], [ 45.479599765191011, 9.188896789595411 ], [ 47.809972513010258, 12.992493688334871 ], [ 45.452813871537913, 9.188896789595411 ] ],
	{"color": "#FF0000", "weight": 2, "opacity": 0.8},
	{snakingSpeed: 500});
mThirdTrip.addTo(map);


var mFourthTrip = L.polyline ( [ [ 47.796579566183709, 12.965707794681775 ], [ 48.225153864633228, 16.340730394971718 ], [ 48.14479618367394, 11.546055431067751 ], [ 49.484090866328678, 8.438891767308755 ], [ 48.89480120596059, 2.331708014403143 ], [ 49.457304972675587, 8.438891767308755 ], [ 48.14479618367394, 11.599627218373941 ], [ 47.796579566183709, 12.99249368833487 ], [ 48.171582077327031, 11.572841324720846 ], [ 48.251939758286319, 16.367516288624813 ] ],
	{"color": "#0300FD", "weight": 2, "opacity": 0.8},
	{snakingSpeed: 500});
mFourthTrip.addTo(map);	


var mFifthTrip = L.polyline ( [ [ 48.225153864633228, 16.340730394971718 ], [ 47.796579566183709, 12.99249368833487 ], [ 48.225153864633228, 16.367516288624813 ], [ 50.100166420349858, 14.385360158295798 ], [ 48.225153864633228, 16.367516288624813 ], [ 51.359103422045315, 12.37641813431369 ], [ 51.064458591861275, 13.715712816968429 ], [ 52.537682742781485, 13.367496199478197 ], [ 50.100166420349858, 8.679964810186608 ], [ 49.484090866328678, 8.46567766096185 ] ],
	{"color": "#660066", "weight": 2, "opacity": 0.8},
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


var cities = L.geoJson(allCities, {
	pointToLayer: function(feature, latlng) {
    return  L.marker(latlng, {icon: starIcon});
	},
	onEachFeature: function(feature, marker) {
			marker.bindPopup(feature.properties.name);;
	}
});
cities.addTo(map);


//map.addEventListener('click', function(e) {
  //  alert(e.latlng);
//});


