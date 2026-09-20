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

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [torrentName, setTorrentName] = useState("");
  const [comment, setComment] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [progress, setProgress] = useState(null); // 0-100 or null when idle
  const [result, setResult] = useState(null); // { magnetLink, name, ... }
  const [error, setError] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [savedList, setSavedList] = useState(() => getSavedTorrents());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");

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
        alert(`Imported ${imported} entr${imported === 1 ? "y" : "ies"}, skipped ${skipped} duplicate(s).`);
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Torrent Creator</h1>
      <p>Turn your own downloaded songs into .torrent files, entirely in your browser.</p>

      <FileDropzone onFilesSelected={handleFilesSelected} />

      {duplicateWarning && (
        <p style={{ color: "#a15c00" }}>{duplicateWarning}</p>
      )}

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label>
            Torrent name:{" "}
            <input
              type="text"
              value={torrentName}
              onChange={(e) => setTorrentName(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block", marginTop: 8 }}>
            Comment (optional):{" "}
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block", marginTop: 8 }}>
            Tags (comma-separated, e.g. gospel, instrumental):{" "}
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          <button type="button" onClick={handleGenerate} style={{ marginTop: 12 }}>
            Generate .torrent
          </button>
        </div>
      )}

      {progress !== null && progress < 100 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ background: "#eee", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                background: "#4a90d9",
                height: 8,
                transition: "width 0.1s",
              }}
            />
          </div>
          <p>Hashing… {progress}%</p>
        </div>
      )}

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, padding: 16, background: "#f6f6f6", borderRadius: 8 }}>
          <p>
            <strong>Done:</strong> {result.name}
          </p>
          <p style={{ wordBreak: "break-all" }}>{result.magnetLink}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => downloadTorrentFile(result.torrentBlob, result.name)}>
              Download .torrent
            </button>
            <button type="button" onClick={handleCopyMagnet}>
              Copy magnet link
            </button>
          </div>
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>Saved torrents</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search by name or tag…"
          value={search}
          onChange={(e) => handleSearchOrSort(e.target.value, sortBy)}
        />
        <select value={sortBy} onChange={(e) => handleSearchOrSort(search, e.target.value)}>
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
        <button type="button" onClick={downloadExportFile}>
          Export JSON
        </button>
        <label style={{ cursor: "pointer" }}>
          Import JSON
          <input type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
        </label>
      </div>

      <ul>
        {savedList.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong> — {t.tags.join(", ") || "no tags"} —{" "}
            {new Date(t.createdAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
