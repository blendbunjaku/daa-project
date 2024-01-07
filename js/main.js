// Map function
//Start coordinates

let cntr = {lng: -73.9897360560045, lat: 40.989441544726446};


function mapBox(center){
    let map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: center,
        zoom: 9

    })

    //Search
    map.addControl(
        new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            marker:{
                color: 'red'
            }
        })
    );
    //Add fullscreen button
    map.addControl(new mapboxgl.FullscreenControl());
    //Add zoom and rotation controls to the map
    map.addControl(new mapboxgl.NavigationControl());
    //Add geolocate control to the map
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    }));
  

}

//Navigato find my position
navigator.geolocation.getCurrentPosition (position => {
    console.log(position);
    let lat = position.coords.latitude;
    let lng = position.coords.longitude;
    let center = [lng, lat];
    mapBox(cntr);

 })