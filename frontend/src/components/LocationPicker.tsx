'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  latitude: number | null
  longitude: number | null
  onSelect: (latitude: number, longitude: number, address?: Record<string, string>) => void
}

const defaultCenter: [number, number] = [17.4486, 78.3908]

const redPin = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#dc2626;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 7px #555"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function MapClick({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(position, 17)
  }, [map, position])
  return null
}

export default function LocationPicker({ latitude, longitude, onSelect }: Props) {
  const [position, setPosition] = useState<[number, number]>(
    latitude != null && longitude != null ? [latitude, longitude] : defaultCenter
  )

  useEffect(() => {
    if (latitude != null && longitude != null) {
      setPosition([latitude, longitude])
    }
  }, [latitude, longitude])

  useEffect(() => {
    if (latitude == null || longitude == null) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          { signal: controller.signal }
        )
        if (!response.ok) return
        const result = await response.json()
        onSelect(latitude, longitude, result.address || {})
      } catch {
        // Keep the selected coordinates even if address lookup is unavailable.
      }
    }, 500)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [latitude, longitude])

  const markerPosition = useMemo(() => position, [position])

  function selectPoint(lat: number, lng: number) {
    setPosition([lat, lng])
    onSelect(lat, lng)
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-300">
      <div className="bg-white px-3 py-2 text-sm font-semibold text-slate-800">
        📍 Select your delivery point
      </div>
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom
        style={{ height: 350, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenter position={markerPosition} />
        <MapClick onSelect={selectPoint} />
        <Marker
          position={markerPosition}
          icon={redPin}
          draggable
          eventHandlers={{
            dragend(event) {
              const point = event.target.getLatLng()
              selectPoint(point.lat, point.lng)
            },
          }}
        />
      </MapContainer>
      <p className="bg-white px-3 py-2 text-xs text-slate-600">
        Map meeda tap cheyyandi or red pin drag chesi exact house location select cheyyandi.
      </p>
    </div>
  )
}
