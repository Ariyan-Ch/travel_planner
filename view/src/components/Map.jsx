import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';


const Map = ({ routePoints, stops, start, end }) => {
  if (!routePoints || routePoints.length === 0){
    return (
      <div className="">
        <img src="/map.jpg" alt="Map" className="p-4 w-full h-auto" />
      </div>
    )
  }


   // helper to check “valid coordinate”
  const isValid = coord => coord != null && !Number.isNaN(coord);

  const bounds = [
    [Math.min(...routePoints.map(p => p[0])), Math.min(...routePoints.map(p => p[1]))],
    [Math.max(...routePoints.map(p => p[0])), Math.max(...routePoints.map(p => p[1]))]
  ];
  return (
    <MapContainer bounds={bounds} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polyline positions={routePoints} color="blue" weight={2.5} opacity={0.8} />
      {isValid(start?.lat) && isValid(start?.lon) && (
        <Marker position={[start.lat, start.lon]} icon={L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] })}>
          
          <Popup>{start.name}</Popup>
        </Marker>
      )}
      {stops.map((stop, index) => isValid(stop.lat) && isValid(stop.lon) ? (
        <Marker key={index} position={[stop.lat, stop.lon]} icon={L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] })}>
          <Popup>
            <b>{stop.title}</b><br />{stop.extract.slice(0, 200)}...
          </Popup>
        </Marker>
        ) : null
      )}
      
      {isValid(end?.lat) && isValid(end?.lon) && (
        <Marker position={[end.lat, end.lon]} icon={L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] })}>
          <Popup>{end.name}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

export default Map