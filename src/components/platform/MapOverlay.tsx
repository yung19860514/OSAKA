// 地圖線稿疊層（平台視覺主題：平台＝一張地圖，每款遊戲是地圖上的一個地點）。
// 細等高線＋路線＋圓形標記，疊在主視覺圖片上，參考 RENON 的製圖風格。

const CONTOURS = [
  "M-20 300 C 160 250, 260 330, 420 280 S 700 180, 860 230 S 1100 320, 1240 260",
  "M-20 330 C 170 285, 280 360, 430 315 S 710 215, 870 262 S 1110 352, 1240 296",
  "M-20 360 C 180 320, 300 392, 440 350 S 720 252, 880 296 S 1120 384, 1240 332",
  "M-20 120 C 120 80, 260 150, 380 110 S 620 30, 780 70 S 1060 140, 1240 90",
  "M-20 150 C 130 112, 268 182, 390 142 S 630 62, 790 102 S 1070 172, 1240 124",
];
const ROUTE = "M120 360 C 260 300, 300 220, 430 210 S 640 250, 760 170 S 960 90, 1100 120";
const NODES: [number, number, number][] = [
  [430, 210, 22],
  [760, 170, 30],
  [1100, 120, 16],
  [250, 300, 10],
];

export default function MapOverlay({ label }: { label?: string }) {
  return (
    <svg className="pf-map" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="pf-map-contour">
        {CONTOURS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path className="pf-map-route" d={ROUTE} />
      {NODES.map(([x, y, r], i) => (
        <g key={i} className="pf-map-node">
          <circle cx={x} cy={y} r={r} />
          <circle cx={x} cy={y} r={3} className="pf-map-dot" />
        </g>
      ))}
      {label && (
        <g className="pf-map-label">
          <line x1={760} y1={140} x2={760} y2={96} />
          <text x={770} y={92}>
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}
