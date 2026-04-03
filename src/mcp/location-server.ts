import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "location-server",
  version: "1.0.0",
});

// ==================== 反向地理编码 ====================
// 坐标 → 详细地址（使用 OpenStreetMap Nominatim，免费无需 Key）

// @ts-ignore TS2589
server.tool(
  "reverse_geocode",
  "将经纬度坐标转换为可读地址，包含城市、区县、国家等信息",
  {
    lat: z.number().describe("纬度"),
    lon: z.number().describe("经度"),
  },
  async ({ lat, lon }) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`;
    const res = await fetch(url, {
      headers: { "User-Agent": "my-chatbot/1.0" },
    });

    if (!res.ok) throw new Error(`反向地理编码失败: ${res.status}`);

    const data = await res.json() as {
      display_name: string;
      address: {
        city?: string; town?: string; county?: string;
        state?: string; country?: string;
        road?: string; neighbourhood?: string;
      };
    };

    const a = data.address;
    const city = a.city ?? a.town ?? a.county ?? "未知";
    const district = a.neighbourhood ?? a.road ?? "";

    return {
      content: [{
        type: "text",
        text: [
          `📍 完整地址：${data.display_name}`,
          `🏙 城市：${city}`,
          district ? `🗺 区域：${district}` : null,
          `🌏 省份：${a.state ?? "未知"}`,
          `🚩 国家：${a.country ?? "未知"}`,
        ].filter(Boolean).join("\n"),
      }],
    };
  }
);

// ==================== 时区查询 ====================

// @ts-ignore TS2589
server.tool(
  "get_timezone",
  "根据经纬度坐标查询当地时区和当前时间",
  {
    lat: z.number().describe("纬度"),
    lon: z.number().describe("经度"),
  },
  async ({ lat, lon }) => {
    const url = `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`时区查询失败: ${res.status}`);

    const data = await res.json() as {
      timeZone: string;
      currentLocalTime: string;
      utcOffset: string;
    };

    return {
      content: [{
        type: "text",
        text: [
          `🕐 时区：${data.timeZone}`,
          `🕑 当地时间：${data.currentLocalTime}`,
          `🌐 UTC 偏移：${data.utcOffset}`,
        ].join("\n"),
      }],
    };
  }
);

// ==================== 启动服务 ====================

void (async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
