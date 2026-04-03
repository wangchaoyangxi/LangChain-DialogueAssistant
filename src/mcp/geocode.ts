// 直接调用的地理编码工具（不依赖 MCP 子进程）

export interface GeoInfo {
  address: string;
  city: string;
  state: string;
  country: string;
  timezone?: string;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`;
  const res = await fetch(url, { headers: { "User-Agent": "my-chatbot/1.0" } });

  if (!res.ok) throw new Error(`反向地理编码失败: ${res.status}`);

  const data = await res.json() as {
    display_name: string;
    address: {
      city?: string; town?: string; county?: string;
      state?: string; country?: string;
    };
  };

  const a = data.address;
  return {
    address: data.display_name,
    city: a.city ?? a.town ?? a.county ?? "未知",
    state: a.state ?? "未知",
    country: a.country ?? "未知",
  };
}
