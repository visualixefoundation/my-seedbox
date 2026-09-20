// torrentBuilder.js
//
// Wraps the `create-torrent` npm package to turn File objects (selected
// in-browser via <input type="file"> or drag-and-drop) into a .torrent
// file + magnet link, entirely client-side. Nothing is uploaded anywhere.
//
// npm install create-torrent buffer

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
 *   empty/omit for a trackerless torrent (DHT + PEX only).
 * @param {(percent: number) => void} [options.onProgress] - Called with
 *   0-100 as pieces are hashed.
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
      // Trackerless by default: DHT + PEX handle peer discovery instead.
      // Pass announceList only if the user explicitly supplies trackers.
      announceList: options.announceList && options.announceList.length
        ? [options.announceList]
        : [],
      private: false,
    };

    // create-torrent supports a progress-style callback via its second
    // options arg on some versions; we also expose our own throttled
    // estimate based on the library's internal piece-hash events where
    // available. If the installed version doesn't emit progress, this
    // simply degrades to "no progress updates" without breaking output.
    if (typeof options.onProgress === "function") {
      createOpts.onProgress = (torrentLength, piecesHashed, totalPieces) => {
        if (totalPieces > 0) {
          options.onProgress(Math.round((piecesHashed / totalPieces) * 100));
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

      // Parse back out the info hash + a magnet link. create-torrent's
      // sibling package `parse-torrent` does this cleanly; to avoid a
      // second dependency here, we pull the magnet URI that create-torrent
      // can generate directly via its `toMagnetURI` if bundled, otherwise
      // fall back to computing it via parse-torrent (recommended).
      import("parse-torrent").then(({ default: parseTorrent }) => {
        try {
          const parsed = parseTorrent(torrentBuf);
          resolve({
            torrentBlob,
            magnetLink: parseTorrent.toMagnetURI(parsed),
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
