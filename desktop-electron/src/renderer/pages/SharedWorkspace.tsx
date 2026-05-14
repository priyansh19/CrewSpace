import { useRef, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Upload, Trash2, Download, FileText, AlertCircle, ChevronRight, Folder, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { sharedWorkspaceApi } from "../api/sharedWorkspace";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { WorkspaceAccessPanel } from "../components/WorkspaceAccessPanel";
import type { SharedWorkspaceFile } from "@crewspaceai/shared";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileRow({ file, companyId, onDelete }: { file: SharedWorkspaceFile; companyId: string; onDelete: (id: string) => void }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await sharedWorkspaceApi.download(companyId, file.id);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silently ignore */ } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-accent/30 transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm text-foreground truncate font-medium">{file.filename}</span>
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
          onClick={() => onDelete(file.id)}
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => { setBreadcrumbs([{ label: "Workspace" }]); }, [setBreadcrumbs]);

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: files, isLoading } = useQuery({
    queryKey: queryKeys.sharedWorkspace.files(selectedCompanyId!, selectedProjectId ?? undefined),
    queryFn: () => sharedWorkspaceApi.list(selectedCompanyId!, selectedProjectId ?? undefined),
    enabled: !!selectedCompanyId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => sharedWorkspaceApi.upload(selectedCompanyId!, file, selectedProjectId ?? undefined),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedWorkspace.files(selectedCompanyId!) });
    },
    onError: (err: Error) => {
      setUploadError(err.message ?? "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sharedWorkspaceApi.remove(selectedCompanyId!, id),
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

  // Group files by project for the "All" view
  const projectFilesMap = new Map<string | null, SharedWorkspaceFile[]>();
  if (files) {
    for (const file of files) {
      const key = file.projectId;
      if (!projectFilesMap.has(key)) projectFilesMap.set(key, []);
      projectFilesMap.get(key)!.push(file);
    }
  }

  const projectMap = new Map(projects?.map((p) => [p.id, p]) ?? []);

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

      {/* Main content */}
      <div className="flex-1 min-h-0 grid xl:grid-cols-[280px_1fr_320px] gap-4 p-4">
        {/* Left sidebar — Project directories */}
        <div className="hidden xl:flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Projects</h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-border/50">
              {/* All Projects */}
              <button
                onClick={() => setSelectedProjectId(null)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  selectedProjectId === null
                    ? "bg-primary/5 border-l-3 border-l-primary"
                    : "hover:bg-accent/30 border-l-3 border-l-transparent"
                )}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium truncate">All Projects</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {files?.length ?? 0}
                </span>
              </button>

              {/* Project directories */}
              {projects?.map((project) => {
                const count = projectFilesMap.get(project.id)?.length ?? 0;
                const isSelected = selectedProjectId === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-primary/5 border-l-3 border-l-primary"
                        : "hover:bg-accent/30 border-l-3 border-l-transparent"
                    )}
                  >
                    <Folder className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>{project.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center — File list */}
        <div
          className={cn(
            "flex-1 min-h-0 rounded-xl border-2 border-dashed transition-colors overflow-hidden flex flex-col",
            dragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border/50 bg-card/30"
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
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {selectedProjectId
                  ? `No files in ${projectMap.get(selectedProjectId)?.name ?? "this project"}`
                  : "Drop files here or click Upload"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {selectedProjectId
                  ? "Upload files to this project directory"
                  : "Select a project to organize files"}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-border/30">
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    companyId={selectedCompanyId!}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upload overlay when dragging */}
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-primary/5 z-10">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Drop to upload{selectedProjectId ? ` to ${projectMap.get(selectedProjectId)?.name ?? "project"}` : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — Access panel */}
        {selectedProjectId && agents && (
          <div className="hidden xl:block h-full">
            <WorkspaceAccessPanel
              companyId={selectedCompanyId!}
              projectId={selectedProjectId}
              agents={agents}
            />
          </div>
        )}
      </div>
    </div>
  );
}
