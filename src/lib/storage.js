// storage.js
//
// Persists the user's list of created torrents in the browser's
// localStorage. No backend involved — everything lives on-device.
//
// Each saved entry looks like:
// {
//   id: string,            // stable unique id (uuid)
//   name: string,
//   infoHash: string,
//   magnetLink: string,
//   tags: string[],        // e.g. ["gospel", "instrumental"]
//   sizeBytes: number,
//   createdAt: string,     // ISO timestamp
// }

const STORAGE_KEY = "torrent-creator:saved-torrents";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read saved torrents from storage:", err);
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    // Most likely a quota error (localStorage is typically capped ~5-10MB).
    console.error("Failed to write saved torrents to storage:", err);
    return false;
  }
}

/**
 * Get the full saved list, optionally filtered/sorted.
 *
 * @param {Object} [opts]
 * @param {string} [opts.search] - Case-insensitive match against name/tags.
 * @param {"date"|"name"|"size"} [opts.sortBy]
 * @param {"asc"|"desc"} [opts.sortDir]
 */
export function getSavedTorrents(opts = {}) {
  let list = readAll();

  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }

  const sortBy = opts.sortBy || "date";
  const sortDir = opts.sortDir === "asc" ? 1 : -1;

  list.sort((a, b) => {
    if (sortBy === "name") return sortDir * a.name.localeCompare(b.name);
    if (sortBy === "size") return sortDir * (a.sizeBytes - b.sizeBytes);
    // default: date
    return sortDir * (new Date(a.createdAt) - new Date(b.createdAt));
  });

  return list;
}

/**
 * Add a newly created torrent to the saved list.
 * Returns the saved entry (with generated id/timestamp).
 */
export function addSavedTorrent({ name, infoHash, magnetLink, sizeBytes, tags = [] }) {
  const list = readAll();

  const entry = {
    id: crypto.randomUUID(),
    name,
    infoHash,
    magnetLink,
    sizeBytes,
    tags,
    createdAt: new Date().toISOString(),
  };

  list.push(entry);
  writeAll(list);
  return entry;
}

export function updateSavedTorrentTags(id, tags) {
  const list = readAll();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  list[idx].tags = tags;
  return writeAll(list);
}

export function deleteSavedTorrent(id) {
  const list = readAll().filter((t) => t.id !== id);
  return writeAll(list);
}

/**
 * Check whether a file selection looks like a duplicate of something
 * already saved, based on name + total size (a cheap, pre-hash check).
 * If the info hash is already known (rare pre-hash), that's an exact match.
 *
 * @param {string} name
 * @param {number} sizeBytes
 * @param {string} [infoHash]
 * @returns {Object|null} the matching saved entry, or null
 */
export function findLikelyDuplicate(name, sizeBytes, infoHash) {
  const list = readAll();
  if (infoHash) {
    const exact = list.find((t) => t.infoHash === infoHash);
    if (exact) return exact;
  }
  return (
    list.find(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.sizeBytes === sizeBytes
    ) || null
  );
}

/**
 * Export the whole saved list as a JSON string, ready to save as a file
 * or copy elsewhere.
 */
export function exportToJSON() {
  return JSON.stringify(readAll(), null, 2);
}

/**
 * Import a previously exported JSON list. By default this merges with
 * the existing list (skipping exact id duplicates); pass replace: true
 * to overwrite the existing list entirely.
 *
 * @param {string} jsonString
 * @param {Object} [opts]
 * @param {boolean} [opts.replace]
 * @returns {{ imported: number, skipped: number }}
 */
export function importFromJSON(jsonString, opts = {}) {
  let incoming;
  try {
    incoming = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Invalid JSON file.");
  }
  if (!Array.isArray(incoming)) {
    throw new Error("Expected a JSON array of saved torrents.");
  }

  if (opts.replace) {
    writeAll(incoming);
    return { imported: incoming.length, skipped: 0 };
  }

  const existing = readAll();
  const existingIds = new Set(existing.map((t) => t.id));
  let imported = 0;
  let skipped = 0;

  for (const entry of incoming) {
    if (existingIds.has(entry.id)) {
      skipped++;
      continue;
    }
    existing.push(entry);
    imported++;
  }

  writeAll(existing);
  return { imported, skipped };
}

/**
 * Trigger a browser download of the exported JSON list.
 */
export function downloadExportFile() {
  const json = exportToJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `torrent-list-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
