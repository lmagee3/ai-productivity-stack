import React from 'react';

type Props = {
  open: boolean;
  onScanDesktop: () => void;
  onPickFolders: () => void;
  onPickFiles: () => void;
  onClose: () => void;
};

export function ScanModal({ open, onScanDesktop, onPickFolders, onPickFiles, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="scan-modal-backdrop">
      <div className="scan-modal">
        <h3>Scan Options</h3>
        <p className="meta">Choose what to scan. Desktop is fast, custom lets you pick folders or files (including external drives).</p>
        <div className="scan-modal-actions">
          <button onClick={onScanDesktop}>Scan Desktop</button>
          <button className="ghost" onClick={onPickFolders}>Choose Folders</button>
          <button className="ghost" onClick={onPickFiles}>Choose Files</button>
        </div>
        <button className="scan-modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
