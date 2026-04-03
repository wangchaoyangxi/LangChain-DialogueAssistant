// ==================== 类型定义 ====================

export interface SkillContext {
  location?: { lat: number; lon: number };
}

export interface Skill {
  definition: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string }>;
        required: string[];
      };
    };
  };
  execute: (args: Record<string, unknown>, ctx: SkillContext) => Promise<string>;
}

// ==================== 天气查询 ====================

const weatherSkill: Skill = {
  definition: {
    type: "function",
    function: {
      name: "get_weather",
      description: "查询指定城市的实时天气情况，包括温度、天气状况等",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名，支持中文或英文，如：北京、Shanghai" },
        },
        required: ["city"],
      },
    },
  },
  async execute(args, ctx) {
    const city = args.city as string;
    const useCoords = ctx.location && /这里|当前|我这|附近|现在/.test(city);
    const query = useCoords
      ? `${ctx.location!.lat},${ctx.location!.lon}`
      : encodeURIComponent(city);

    const res = await fetch(`https://wttr.in/${query}?format=j1&lang=zh`, {
      headers: { "Accept-Language": "zh-CN" },
    });

    if (!res.ok) throw new Error(`天气查询失败: ${res.status}`);

    const data = await res.json() as {
      current_condition: Array<{
        temp_C: string; FeelsLikeC: string;
        humidity: string; windspeedKmph: string;
        weatherDesc: Array<{ value: string }>;
      }>;
      nearest_area: Array<{
        areaName: Array<{ value: string }>;
        country: Array<{ value: string }>;
      }>;
    };

    const cur = data.current_condition[0];
    const area = data.nearest_area[0];
    const location = `${area.areaName[0]?.value}, ${area.country[0]?.value}`;

    return [
      `📍 位置：${location}`,
      `🌤 天气：${cur.weatherDesc[0]?.value ?? "未知"}`,
      `🌡 温度：${cur.temp_C}°C（体感 ${cur.FeelsLikeC}°C）`,
      `💧 湿度：${cur.humidity}%`,
      `💨 风速：${cur.windspeedKmph} km/h`,
    ].join("\n");
  },
};

// ==================== 注册所有 Skills ====================
// 新增 skill 只需在这里添加

export const SKILLS: Skill[] = [
  weatherSkill,
];

// ==================== 工具方法 ====================

export const TOOLS = SKILLS.map((s) => s.definition);

export async function executeSkill(
  name: string,
  args: Record<string, unknown>,
  ctx: SkillContext
): Promise<string> {
  const skill = SKILLS.find((s) => s.definition.function.name === name);
  if (!skill) return `未找到技能: ${name}`;
  return skill.execute(args, ctx);
}
