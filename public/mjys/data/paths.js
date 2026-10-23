// 怪物路徑工具：每章的路線座標在 data/layouts.js

// 把座標點變成「走了多遠 → 在哪裡」的查詢
export function makePath(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, dx: (x2 - x1) / len, dy: (y2 - y1) / len, len, start: total });
    total += len;
  }
  return {
    points, total,
    at(d) {
      d = Math.max(0, Math.min(total, d));
      let s = segs[segs.length - 1];
      for (const g of segs) { if (d <= g.start + g.len) { s = g; break; } }
      const k = d - s.start;
      return { x: s.x1 + s.dx * k, y: s.y1 + s.dy * k, dx: s.dx, dy: s.dy };
    },
  };
}
