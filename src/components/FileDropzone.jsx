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

      // Soft warning, not a hard block — some folders of lossless audio
      // legitimately run large. Just make sure the user knows before
      // in-browser hashing potentially takes a while.
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
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? "#4a90d9" : "#999"}`,
          borderRadius: 8,
          padding: 32,
          textAlign: "center",
          background: isDragging ? "#eef6ff" : "transparent",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <p>Drag and drop file(s) here, or:</p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Choose file(s)
          </button>
          <button type="button" onClick={() => folderInputRef.current?.click()}>
            Choose folder
          </button>
        </div>

        {/* Multi-file picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Folder picker. webkitdirectory is non-standard but supported in
            all major browsers (Chrome, Edge, Firefox, Safari 15+). */}
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

      {warning && (
        <p style={{ color: "#a15c00", marginTop: 8 }}>{warning}</p>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>{files.length} file(s) selected</strong>
          <ul style={{ maxHeight: 200, overflowY: "auto" }}>
            {files.map((f, i) => (
              <li key={i}>
                {f.webkitRelativePath || f.name} — {formatBytes(f.size)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
