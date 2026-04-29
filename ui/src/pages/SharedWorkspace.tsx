import { useRef, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Upload, Trash2, Download, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { sharedWorkspaceApi, type WorkspaceFile } from "../api/sharedWorkspace";
import { queryKeys } from "../lib/queryKeys";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileRow({ file, companyId, onDelete }: { file: WorkspaceFile; companyId: string; onDelete: (name: string) => void }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await sharedWorkspaceApi.download(companyId, file.name);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silently ignore */ } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-accent/30 transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm text-foreground truncate font-medium">{file.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatBytes(file.sizeBytes)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(file.name)}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SharedWorkspace() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => { setBreadcrumbs([{ label: "Workspace" }]); }, [setBreadcrumbs]);

  const { data: files, isLoading } = useQuery({
    queryKey: queryKeys.sharedWorkspace.files(selectedCompanyId!),
    queryFn: () => sharedWorkspaceApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => sharedWorkspaceApi.upload(selectedCompanyId!, file),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedWorkspace.files(selectedCompanyId!) });
    },
    onError: (err: Error) => {
      setUploadError(err.message ?? "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => sharedWorkspaceApi.remove(selectedCompanyId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedWorkspace.files(selectedCompanyId!) });
    },
  });

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    setUploadError(null);
    Array.from(fileList).forEach((f) => uploadMutation.mutate(f));
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Shared Workspace</h1>
          {files && files.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Error banner */}
      {uploadError && (
        <div className="flex items-center gap-2 mx-6 mt-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Drop zone + file list */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto m-6 rounded-xl border-2 border-dashed transition-colors",
          dragOver
            ? "border-primary/50 bg-primary/5"
            : "border-border/50 bg-card/30",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Loading files…
          </div>
        ) : !files || files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
            <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Drop files here or click Upload</p>
            <p className="text-xs text-muted-foreground/60">
              Files are stored at <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">$CREWSPACE_HOME/instances/default/workspace/</code>
            </p>
            <p className="text-xs text-muted-foreground/60">
              Agents can access them via <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">$CREWSPACE_SHARED_WORKSPACE_DIR</code>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30 rounded-xl overflow-hidden">
            {files.map((file) => (
              <FileRow
                key={file.name}
                file={file}
                companyId={selectedCompanyId!}
                onDelete={(name) => deleteMutation.mutate(name)}
              />
            ))}
          </div>
        )}

        {/* Upload overlay when dragging */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-primary">Drop to upload</span>
            </div>
          </div>
        )}
      </div>

      {/* Agent access hint */}
      <div className="px-6 pb-4 shrink-0">
        <p className="text-xs text-muted-foreground/50">
          Files in this workspace are accessible to agents via the terminal as{" "}
          <code className="font-mono">$CREWSPACE_SHARED_WORKSPACE_DIR</code>. Max file size: 100 MB.
        </p>
      </div>
    </div>
  );
}
