import "./ConfirmDialog.css";

export interface ConfirmRequest {
  id: string;
  tool: string;
  path?: string;
}

const TOOL_LABELS: Record<string, string> = {
  write_file:       "写入文件",
  edit_file:        "编辑文件",
  create_directory: "创建目录",
  move_file:        "移动文件",
  delete_file:      "删除文件",
};

interface Props {
  request: ConfirmRequest;
  onResult: (approved: boolean) => void;
}

export default function ConfirmDialog({ request, onResult }: Props) {
  const label = TOOL_LABELS[request.tool] ?? request.tool;

  async function handle(approved: boolean) {
    onResult(approved);
    await fetch(`/api/confirm/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
  }

  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <div className="confirm-title">⚠️ 文件操作确认</div>
        <div className="confirm-body">
          <div className="confirm-row">
            <span className="confirm-label">操作</span>
            <span className="confirm-value">{label}</span>
          </div>
          {request.path && (
            <div className="confirm-row">
              <span className="confirm-label">路径</span>
              <span className="confirm-value confirm-path">{request.path}</span>
            </div>
          )}
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn deny"  onClick={() => handle(false)}>拒绝</button>
          <button className="confirm-btn allow" onClick={() => handle(true)}>允许</button>
        </div>
      </div>
    </div>
  );
}
