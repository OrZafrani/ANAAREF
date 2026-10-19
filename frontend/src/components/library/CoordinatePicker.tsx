import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface CoordinatePickerProps {
  latitude: number | null;
  longitude: number | null;
  disabled?: boolean;
  onPick: (latitude: number, longitude: number) => void;
}

function MapClickHandler({ onPick, disabled }: Pick<CoordinatePickerProps, 'onPick' | 'disabled'>) {
  useMapEvents({
    click(event) {
      if (!disabled) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function CoordinatePicker({ latitude, longitude, disabled, onPick }: CoordinatePickerProps) {
  const hasPoint = latitude !== null && longitude !== null;
  const center: [number, number] = hasPoint ? [latitude, longitude] : [31.5, 34.8];

  return (
    <div className="coordinate-picker" aria-label="מפת בחירת נקודה">
      <div className="map-caption"><span>בחירת מיקום</span><span>{disabled ? 'תצוגה בלבד' : 'לחיצה במפה תעדכן קואורדינטות'}</span></div>
      <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={hasPoint ? 11 : 7} scrollWheelZoom={!disabled} className="coordinate-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={onPick} disabled={disabled} />
        {hasPoint && <CircleMarker center={center} radius={8} pathOptions={{ color: '#174f42', fillColor: '#f0b345', fillOpacity: 1, weight: 2 }} />}
      </MapContainer>
    </div>
  );
}
