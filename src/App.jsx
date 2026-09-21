// App.jsx
//
// Ties together: file selection -> torrent building -> saved list.
// This is intentionally a single top-level component for v1; split further
// once the saved-list UI (search/sort/tags) grows.

import { useState } from "react";
import FileDropzone from "./components/FileDropzone";
import { buildTorrent, downloadTorrentFile } from "./lib/torrentBuilder";
import {
  addSavedTorrent,
  getSavedTorrents,
  findLikelyDuplicate,
  downloadExportFile,
  importFromJSON,
} from "./lib/storage";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [torrentName, setTorrentName] = useState("");
  const [comment, setComment] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [savedList, setSavedList] = useState(() => getSavedTorrents());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [copied, setCopied] = useState(false);

  function handleFilesSelected(files, totalSize) {
    setSelectedFiles(files);
    setResult(null);
    setError(null);

    const defaultName = files.length === 1 ? files[0].name : "torrent-bundle";
    setTorrentName((prev) => prev || defaultName);

    const dup = findLikelyDuplicate(defaultName, totalSize);
    setDuplicateWarning(
      dup
        ? `This looks like a duplicate of "${dup.name}" you already created on ${new Date(
            dup.createdAt
          ).toLocaleDateString()}.`
        : null
    );
  }

  async function handleGenerate() {
    setError(null);
    setProgress(0);
    setResult(null);
    setCopied(false);

    try {
      const built = await buildTorrent(selectedFiles, {
        name: torrentName,
        comment,
        onProgress: setProgress,
      });

      setResult(built);
      setProgress(100);

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      addSavedTorrent({
        name: built.name,
        infoHash: built.infoHash,
        magnetLink: built.magnetLink,
        sizeBytes: built.sizeBytes,
        tags,
      });
      setSavedList(getSavedTorrents({ search, sortBy }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong building the torrent.");
      setProgress(null);
    }
  }

  function handleCopyMagnet() {
    if (result?.magnetLink) {
      navigator.clipboard.writeText(result.magnetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleSearchOrSort(nextSearch, nextSortBy) {
    setSearch(nextSearch);
    setSortBy(nextSortBy);
    setSavedList(getSavedTorrents({ search: nextSearch, sortBy: nextSortBy }));
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { imported, skipped } = importFromJSON(reader.result);
        setSavedList(getSavedTorrents({ search, sortBy }));
        alert(
          `Imported ${imported} entr${imported === 1 ? "y" : "ies"}, skipped ${skipped} duplicate(s).`
        );
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Torrent Creator</h1>
        <p>Turn your own downloaded songs into .torrent files, entirely in your browser.</p>
      </header>

      <FileDropzone onFilesSelected={handleFilesSelected} />

      {duplicateWarning && (
        <div className="alert alert-warning">{duplicateWarning}</div>
      )}

      {selectedFiles.length > 0 && (
        <div className="form-card">
          <div className="field">
            <label htmlFor="torrent-name">Torrent name</label>
            <input
              id="torrent-name"
              type="text"
              value={torrentName}
              onChange={(e) => setTorrentName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="comment">Comment (optional)</label>
            <input
              id="comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Album name, year…"
            />
          </div>

          <div className="field">
            <label htmlFor="tags">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="gospel, instrumental, live…"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={progress !== null && progress < 100}
            >
              {progress !== null && progress < 100 ? "Hashing…" : "Generate .torrent"}
            </button>
          </div>
        </div>
      )}

      {progress !== null && progress < 100 && (
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-label">Hashing… {progress}%</p>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="result-card">
          <p>
            <strong>✓ Done:</strong> {result.name}
            {result.sizeBytes != null && (
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                {" "}· {formatBytes(result.sizeBytes)}
              </span>
            )}
          </p>
          <p className="magnet-link">{result.magnetLink}</p>
          <div className="result-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadTorrentFile(result.torrentBlob, result.name)}
            >
              Download .torrent
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCopyMagnet}>
              {copied ? "Copied!" : "Copy magnet link"}
            </button>
          </div>
        </div>
      )}

      <section className="section">
        <h2>Saved torrents</h2>

        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name or tag…"
            value={search}
            onChange={(e) => handleSearchOrSort(e.target.value, sortBy)}
          />
          <select
            value={sortBy}
            onChange={(e) => handleSearchOrSort(search, e.target.value)}
            aria-label="Sort by"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={downloadExportFile}>
            Export JSON
          </button>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            Import JSON
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </label>
        </div>

        {savedList.length === 0 ? (
          <div className="empty-state">
            No saved torrents yet. Generate one above to get started.
          </div>
        ) : (
          <ul className="saved-list">
            {savedList.map((t) => (
              <li key={t.id} className="saved-item">
                <div className="saved-item-top">
                  <span className="saved-item-name">{t.name}</span>
                  <span className="saved-item-date">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="saved-item-meta">
                  {t.sizeBytes != null && (
                    <span className="tag-empty">{formatBytes(t.sizeBytes)}</span>
                  )}
                  {t.tags && t.tags.length > 0 ? (
                    t.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="tag-empty">no tags</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
