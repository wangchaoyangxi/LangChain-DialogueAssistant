import fs from "fs";
import path from "path";
import os from "os";

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

// ==================== 删除文件 ====================

// 需要走确认流程的 Skill（在 chatbot.ts 中检查）
export const SKILL_CONFIRM_SET = new Set(["delete_file"]);

const deleteFileSkill: Skill = {
  definition: {
    type: "function",
    function: {
      name: "delete_file",
      description: "删除指定路径的文件或空目录。需要用户确认后才会执行。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "要删除的文件或目录的完整路径" },
        },
        required: ["path"],
      },
    },
  },
  async execute(args) {
    const target = args.path as string;
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
    return `已删除：${target}`;
  },
};

// ==================== 自动扫描搜索文件 ====================

// 跳过这些目录（太大或无意义）
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".cache",
  "Windows", "Program Files", "Program Files (x86)",
  "$Recycle.Bin", "System Volume Information",
]);

function scanFiles(
  dir: string,
  keyword: string,
  ext: string,
  maxDepth: number,
  results: string[],
  maxResults: number,
  depth = 0
): void {
  if (depth > maxDepth || results.length >= maxResults) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // 无权限则跳过
  }
  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        scanFiles(path.join(dir, entry.name), keyword, ext, maxDepth, results, maxResults, depth + 1);
      }
    } else {
      const name = entry.name.toLowerCase();
      const matchKeyword = !keyword || name.includes(keyword.toLowerCase());
      const matchExt = !ext || name.endsWith(ext.toLowerCase());
      if (matchKeyword && matchExt) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
}

const searchFilesAutoSkill: Skill = {
  definition: {
    type: "function",
    function: {
      name: "search_files_auto",
      description: "在电脑常用目录（桌面、文档、下载、D盘等）中自动扫描搜索文件，无需用户指定目录。",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "文件名关键词，留空则匹配所有文件" },
          ext:     { type: "string", description: "文件扩展名过滤，如 .txt、.pdf，留空则不过滤" },
        },
        required: [],
      },
    },
  },
  async execute(args) {
    const keyword = (args.keyword as string) ?? "";
    const ext     = (args.ext     as string) ?? "";
    const home = os.homedir();

    // 优先搜索常用目录，再兜底搜 D:\
    const searchRoots = [
      path.join(home, "Desktop"),
      path.join(home, "Documents"),
      path.join(home, "Downloads"),
      home,
      "D:\\",
      "C:\\Users",
    ];

    const results: string[] = [];
    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      // 根目录层级限浅，用户目录可以稍深
      const depth = root === "D:\\" || root === "C:\\Users" ? 3 : 5;
      scanFiles(root, keyword, ext, depth, results, 50);
      if (results.length >= 50) break;
    }

    if (results.length === 0) return "未找到匹配的文件。";
    return `找到 ${results.length} 个文件：\n` + results.join("\n");
  },
};

// ==================== 注册所有 Skills ====================
// 新增 skill 只需在这里添加

export const SKILLS: Skill[] = [
  weatherSkill,
  deleteFileSkill,
  searchFilesAutoSkill,
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
