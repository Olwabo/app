import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useOrgData } from "@/context/OrgDataContext";

const RANK = { CRITICAL: 3, WARNING: 2, OFFLINE: 1, ONLINE: 0 };
const COLOR = { CRITICAL: "#f87171", WARNING: "#fbbf24", OFFLINE: "#64748b", ONLINE: "#34d399" };
const LABEL = { CRITICAL: "Critical", WARNING: "Warning", OFFLINE: "Offline", ONLINE: "All normal" };

function useSitePoints() {
  const { sites, nodes } = useOrgData();
  return useMemo(() => sites.filter((s) => s.latitude && s.longitude).map((s) => {
    const list = nodes.filter((n) => n.site_id === s.id);
    const worst = list.reduce((w, n) => (RANK[n.status] > RANK[w] ? n.status : w), "ONLINE");
    return { ...s, lat: Number(s.latitude), lng: Number(s.longitude), worst, count: list.length, firstNode: list[0]?.id };
  }), [sites, nodes]);
}

export default function SiteMap() {
  const points = useSitePoints();
  const navigate = useNavigate();
  const center = points.length
    ? [points.reduce((a, p) => a + p.lat, 0) / points.length, points.reduce((a, p) => a + p.lng, 0) / points.length]
    : [-28.5, 25.5];
  return (
    <div className="panel overflow-hidden" data-testid="site-map">
      <div className="flex items-center justify-between border-b border-[#252b36] px-5 py-4">
        <h2 className="font-medium">Your sites</h2>
        <div className="flex gap-4 text-xs text-slate-400">
          {["ONLINE", "WARNING", "CRITICAL"].map((s) => (
            <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLOR[s] }} />{LABEL[s]}</span>
          ))}
        </div>
      </div>
      <div className="h-[340px]">
        <MapContainer center={center} zoom={points.length > 1 ? 7 : 9} scrollWheelZoom={false} className="h-full w-full" attributionControl>
          <TileLayer
            url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`}
            tileSize={512} zoomOffset={-1} maxZoom={18}
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          {points.map((p) => (
            <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.worst === "CRITICAL" ? 13 : 10}
              pathOptions={{ color: COLOR[p.worst], fillColor: COLOR[p.worst], fillOpacity: 0.35, weight: 2 }}
              className={p.worst === "CRITICAL" ? "map-pulse" : ""}
              eventHandlers={{ click: () => p.firstNode && navigate(`/nodes/${p.firstNode}`) }}>
              <Tooltip direction="top" offset={[0, -8]} className="amz-tip">
                <strong>{p.name}</strong><br />{p.location_label}<br />{p.count} meter{p.count === 1 ? "" : "s"} · {LABEL[p.worst]}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
