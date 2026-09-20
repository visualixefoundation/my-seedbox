// torrentBuilder.js
//
// Wraps the `create-torrent` npm package (v6.x) to turn File objects
// (selected in-browser via <input type="file"> or drag-and-drop) into a
// .torrent file + magnet link, entirely client-side. Nothing is uploaded
// anywhere.
//
// npm install create-torrent parse-torrent buffer

import createTorrent from "create-torrent";
import { Buffer } from "buffer";

// Vite/webpack don't polyfill Node's Buffer by default, and create-torrent
// expects it to exist globally.
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

/**
 * Build a .torrent file from one or more browser File objects.
 *
 * @param {File[]} files - Files selected by the user (single file or a
 *   whole folder's worth, e.g. from a <input webkitdirectory> picker).
 * @param {Object} options
 * @param {string} [options.name] - Torrent display name (defaults to the
 *   single file's name, or a generic "bundle" name for multi-file torrents).
 * @param {string} [options.comment] - Free-text comment/note.
 * @param {string[]} [options.announceList] - Optional tracker URLs. Leave
 *   empty/omit for a trackerless torrent (DHT + PEX only) — note that
 *   create-torrent normally adds public trackers automatically unless you
 *   explicitly pass an empty array, which is what we do below.
 * @param {(percent: number) => void} [options.onProgress] - Called with
 *   0-100 as bytes are hashed.
 *
 * @returns {Promise<{ torrentBlob: Blob, magnetLink: string, infoHash: string, name: string, sizeBytes: number }>}
 */
export function buildTorrent(files, options = {}) {
  return new Promise((resolve, reject) => {
    if (!files || files.length === 0) {
      reject(new Error("No files provided."));
      return;
    }

    const sizeBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (sizeBytes === 0) {
      reject(new Error("Selected file(s) are empty (0 bytes)."));
      return;
    }

    const createOpts = {
      name: options.name || (files.length === 1 ? files[0].name : "torrent-bundle"),
      comment: options.comment || "",
      // Trackerless by default: pass an explicit empty array, otherwise
      // create-torrent adds its own public trackers automatically.
      announceList:
        options.announceList && options.announceList.length
          ? [options.announceList]
          : [[]],
      private: false,
    };

    if (typeof options.onProgress === "function") {
      // Real signature: onProgress(bytesHashed, estimatedTotalSize)
      createOpts.onProgress = (bytesHashed, estimatedTotalSize) => {
        const total = estimatedTotalSize || sizeBytes;
        if (total > 0) {
          options.onProgress(Math.min(100, Math.round((bytesHashed / total) * 100)));
        }
      };
    }

    createTorrent(files, createOpts, (err, torrentBuf) => {
      if (err) {
        reject(err);
        return;
      }

      const torrentBlob = new Blob([torrentBuf], {
        type: "application/x-bittorrent",
      });

      import("parse-torrent").then(({ default: parseTorrent, toMagnetURI }) => {
        try {
          const parsed = parseTorrent(torrentBuf);
          resolve({
            torrentBlob,
            magnetLink: toMagnetURI(parsed),
            infoHash: parsed.infoHash,
            name: createOpts.name,
            sizeBytes,
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  });
}

/**
 * Trigger a browser download of the generated .torrent file.
 */
export function downloadTorrentFile(torrentBlob, name) {
  const url = URL.createObjectURL(torrentBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[/\\?%*:|"<>]/g, "-")}.torrent`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
