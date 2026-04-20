"use client";

import { useRef, useState } from "react";

type Context = "hero" | "portrait" | "record";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label: string;
  context: Context;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

type Status = "idle" | "signing" | "uploading" | "done" | "error";

export default function ImageUploader({
  value,
  onChange,
  label,
  context,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("File must be an image.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File is larger than 5 MB.");
      setStatus("error");
      return;
    }

    try {
      setStatus("signing");
      setProgress(0);
      const signResponse = await fetch("/api/admin/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          context,
        }),
      });
      if (!signResponse.ok) {
        const data = (await signResponse.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? "Could not get upload URL.");
        setStatus("error");
        return;
      }
      const { uploadUrl, publicUrl } = (await signResponse.json()) as {
        uploadUrl: string;
        publicUrl: string;
        key: string;
      };

      setStatus("uploading");

      // Use XHR so we can drive the progress bar; fetch() doesn't expose
      // upload progress events.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Upload network error."));
        xhr.send(file);
      });

      onChange(publicUrl);
      setStatus("done");
      setProgress(100);

      // Best-effort blurhash — never block UX.
      void fetch("/api/admin/uploads/blurhash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl }),
      }).catch(() => {
        /* ignored */
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    } finally {
      // Allow re-uploading the same file by clearing the input.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>

      <div className="flex items-start gap-4">
        <div className="h-20 w-32 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={status === "signing" || status === "uploading"}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "signing"
              ? "Preparing..."
              : status === "uploading"
                ? `Uploading ${progress}%`
                : "Choose image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChoose}
          />

          {status === "uploading" ? (
            <div className="h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          {status === "done" ? (
            <span className="text-xs text-emerald-400">Uploaded ✓</span>
          ) : null}
          {status === "error" ? (
            <span className="text-xs text-red-400">
              {error || "Upload failed."}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
