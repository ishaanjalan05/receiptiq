"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Group = { id: string; name: string };

export default function UploadReceipt() {
  const router = useRouter();

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [ocrSummary, setOcrSummary] = useState<any>(null);

  // Load groups the user belongs to
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/groups");
        if (r.ok) setGroups(await r.json());
      } catch {
        // ignore network errors in MVP
      }
    })();
  }, []);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function openFilePicker() {
    const el = document.getElementById("file-input") as HTMLInputElement | null;
    el?.click();
  }

  async function onUpload() {
    if (!file) return;

    setStatus("Requesting signed URL...");
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileType: file.type }),
    });
    if (!res.ok) {
      setStatus(`Failed to get signed URL: ${await res.text().catch(() => "")}`);
      return;
    }
    const { url, key } = await res.json();

    setStatus("Uploading to S3...");
    // S3 presigned PUTs often require the Content-Type header to match what was signed.
    const put = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) {
      const text = await put.text().catch(() => "");
      setStatus(`Upload failed: ${put.status} ${text}`);
      return;
    }

    setStatus("Creating receipt...");
    const make = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ensure auth cookie is sent
      body: JSON.stringify({
        key,
        originalName: file.name,
        groupId: groupId || null, // <-- attach to selected group
      }),
    });
    if (!make.ok) {
      setStatus(`Failed to create receipt: ${await make.text().catch(() => "")}`);
      return;
    }
    const { receiptId } = await make.json();

    setStatus("Running OCR (Textract)...");
    const ocr = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId, debug: true}),
    });
    if (!ocr.ok) {
      setStatus(`OCR failed: ${await ocr.text().catch(() => "")}`);
      return;
    }
    const data = await ocr.json();

    setOcrSummary(data.parsed);
    setStatus(`OCR complete ✔ Items: ${data.items}`);

    // Navigate to the editor
    router.push(`/receipts/${receiptId}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Upload a receipt</h1>

      {/* Group selector */}
      <label className="text-sm block">
        Group (optional)
        <select
          className="mt-1 w-full border rounded p-2"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">— Personal —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {/* File picker + preview */}
      <div className="space-y-2">
        <input id="file-input" type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" onChange={onSelect} className="hidden" />
        <div className="flex items-center gap-3">
          <button onClick={openFilePicker} type="button" className="rounded border px-4 py-2 bg-white text-sm text-gray-800 hover:bg-gray-50">Choose file to upload…</button>
          <div className="text-sm text-gray-700">{file ? file.name : "No file chosen"}</div>
        </div>
        <div className="text-sm text-gray-500">Accepted: JPG, PNG, PDF. After choosing a file press <span className="font-medium">Upload → Create → OCR</span>.</div>
      </div>
      {previewUrl && (
        <img src={previewUrl} alt="preview" className="mt-2 rounded border max-h-72" />
      )}

      <div className="flex gap-3">
        <button
          onClick={onUpload}
          disabled={!file}
          className="rounded bg-gray-900 text-white px-3 py-2 disabled:opacity-50"
        >
          Upload → Create → OCR
        </button>
      </div>

      <p className="text-sm text-gray-600">{status}</p>

      {ocrSummary && (
        <pre className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded p-3 overflow-auto text-sm leading-relaxed whitespace-pre-wrap">
{JSON.stringify(ocrSummary, null, 2)}
        </pre>
      )}
    </div>
  );
}
