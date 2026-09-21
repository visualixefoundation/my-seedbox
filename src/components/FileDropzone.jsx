// FileDropzone.jsx
//
// Lets the user pick a single file, multiple files, or a whole folder
// (via the non-standard but widely-supported `webkitdirectory` attribute),
// plus drag-and-drop. Reports the resulting File[] up via onFilesSelected.

import { useCallback, useRef, useState } from "react";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function FileDropzone({ onFilesSelected }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [warning, setWarning] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFiles = useCallback(
    (fileList) => {
      const arr = Array.from(fileList);
      setWarning(null);

      if (arr.length === 0) {
        setWarning("No files found in that selection.");
        return;
      }

      const totalSize = arr.reduce((sum, f) => sum + f.size, 0);
      if (totalSize === 0) {
        setWarning("Selected file(s) appear to be empty (0 bytes).");
        return;
      }

      const LARGE_WARN_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB
      if (totalSize > LARGE_WARN_THRESHOLD) {
        setWarning(
          `Heads up: this selection is ${formatBytes(totalSize)}. In-browser hashing may take a while.`
        );
      }

      setFiles(arr);
      onFilesSelected(arr, totalSize);
    },
    [onFilesSelected]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  return (
    <div>
      <div
        className={`dropzone${isDragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="dropzone-icon">📁</div>
        <p className="dropzone-label">Drag and drop file(s) here, or</p>

        <div className="dropzone-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file(s)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => folderInputRef.current?.click()}
          >
            Choose folder
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {warning && <div className="alert alert-warning">{warning}</div>}

      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </div>
          <ul>
            {files.map((f, i) => (
              <li key={i}>
                <span className="file-name">{f.webkitRelativePath || f.name}</span>
                <span className="file-size">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
