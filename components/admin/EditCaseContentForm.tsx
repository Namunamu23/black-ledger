// DEPRECATED — replaced by tabbed editor in app/bureau/admin/cases/[caseId]/edit/_components/. Remove after Week 3 QA.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import CaseReadinessPanel from "@/components/admin/CaseReadinessPanel";

type PersonItem = {
  id?: number;
  globalPersonId: number | null;
  name: string;
  role: string;
  summary: string;
  unlockStage: number;
  sortOrder: number;
};

type RecordItem = {
  id?: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  unlockStage: number;
  sortOrder: number;
};

type HintItem = {
  id?: number;
  level: number;
  title: string;
  content: string;
  unlockStage: number;
  sortOrder: number;
};

type CheckpointItem = {
  id?: number;
  stage: number;
  prompt: string;
  acceptedAnswers: string;
  successMessage: string;
};

type EditCaseContentFormProps = {
  caseId: number;
  initialData: {
    title: string;
    slug: string;
    summary: string;
    players: string;
    duration: string;
    difficulty: string;
    maxStage: number;
    solutionSuspect: string;
    solutionMotive: string;
    solutionEvidence: string;
    debriefOverview: string;
    debriefWhatHappened: string;
    debriefWhyItWorked: string;
    debriefClosing: string;
    debriefSectionTitle: string | null;
    debriefIntro: string | null;
    isActive: boolean;
    people: PersonItem[];
    records: RecordItem[];
    hints: HintItem[];
    checkpoints: CheckpointItem[];
  };
};

export default function EditCaseContentForm({
  caseId,
  initialData,
}: EditCaseContentFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updateField(name: keyof typeof form, value: unknown) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateArrayItem<T>(
    key: "people" | "records" | "hints" | "checkpoints",
    index: number,
    field: keyof T,
    value: unknown
  ) {
    setForm((prev) => {
      const next = [...(prev[key] as T[])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [key]: next };
    });
  }

  function addPerson() {
    setForm((prev) => ({
      ...prev,
      people: [
        ...prev.people,
        {
          globalPersonId: null,
          name: "",
          role: "",
          summary: "",
          unlockStage: 1,
          sortOrder: prev.people.length + 1,
        },
      ],
    }));
  }

  function addRecord() {
    setForm((prev) => ({
      ...prev,
      records: [
        ...prev.records,
        {
          title: "",
          category: "",
          summary: "",
          body: "",
          unlockStage: 1,
          sortOrder: prev.records.length + 1,
        },
      ],
    }));
  }

  function addHint() {
    setForm((prev) => ({
      ...prev,
      hints: [
        ...prev.hints,
        {
          level: prev.hints.length + 1,
          title: "",
          content: "",
          unlockStage: 1,
          sortOrder: prev.hints.length + 1,
        },
      ],
    }));
  }

  function addCheckpoint() {
    setForm((prev) => ({
      ...prev,
      checkpoints: [
        ...prev.checkpoints,
        {
          stage: prev.checkpoints.length + 1,
          prompt: "",
          acceptedAnswers: "",
          successMessage: "",
        },
      ],
    }));
  }

  function removeArrayItem(
    key: "people" | "records" | "hints" | "checkpoints",
    index: number
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cases/${caseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not save case.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Case updated.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong while saving.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8">


<div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
  <CaseReadinessPanel data={form} />

  <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
      Preview
    </div>
    <h2 className="mt-4 text-2xl font-semibold text-white">
      Public case preview
    </h2>
    <p className="mt-4 text-sm leading-7 text-zinc-300">
      Review how this case will appear publicly before you publish it.
    </p>

    <Link
      href={`/bureau/admin/cases/${caseId}/preview`}
      className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
    >
      Open Preview
    </Link>
  </div>
</div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-2xl font-semibold text-white">Core Metadata</h2>



        <div className="mt-6 grid gap-4">
          <input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Case title"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <input
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            placeholder="case-slug"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.summary}
            onChange={(e) => updateField("summary", e.target.value)}
            placeholder="Summary"
            className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <div className="grid gap-4 md:grid-cols-4">
            <input
              value={form.players}
              onChange={(e) => updateField("players", e.target.value)}
              placeholder="Players"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
            <input
              value={form.duration}
              onChange={(e) => updateField("duration", e.target.value)}
              placeholder="Duration"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
            <input
              value={form.difficulty}
              onChange={(e) => updateField("difficulty", e.target.value)}
              placeholder="Difficulty"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
            <input
              type="number"
              value={form.maxStage}
              onChange={(e) => updateField("maxStage", Number(e.target.value))}
              placeholder="Max stages"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
            />
            Case is active
          </label>
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-2xl font-semibold text-white">Solution + Debrief</h2>

        <div className="mt-6 grid gap-4">
          <input
            value={form.solutionSuspect}
            onChange={(e) => updateField("solutionSuspect", e.target.value)}
            placeholder="Solution suspect"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.solutionMotive}
            onChange={(e) => updateField("solutionMotive", e.target.value)}
            placeholder="Solution motive"
            className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.solutionEvidence}
            onChange={(e) => updateField("solutionEvidence", e.target.value)}
            placeholder="Solution evidence"
            className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.debriefOverview}
            onChange={(e) => updateField("debriefOverview", e.target.value)}
            placeholder="Debrief overview"
            className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.debriefWhatHappened}
            onChange={(e) => updateField("debriefWhatHappened", e.target.value)}
            placeholder="Debrief: what happened"
            className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.debriefWhyItWorked}
            onChange={(e) => updateField("debriefWhyItWorked", e.target.value)}
            placeholder="Debrief: why it worked"
            className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <input
            value={form.debriefSectionTitle ?? ""}
            onChange={(e) =>
              updateField("debriefSectionTitle", e.target.value || null)
            }
            placeholder='Debrief section title (defaults to "Why your theory was incomplete" if blank)'
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.debriefIntro ?? ""}
            onChange={(e) =>
              updateField("debriefIntro", e.target.value || null)
            }
            placeholder="Debrief intro paragraph (optional, appears above the breakdown)"
            className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />

          <textarea
            value={form.debriefClosing}
            onChange={(e) => updateField("debriefClosing", e.target.value)}
            placeholder="Debrief closing"
            className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">People</h2>
          <button
            type="button"
            onClick={addPerson}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Person
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {form.people.map((person, index) => (
            <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-4">
                <input value={person.name} onChange={(e) => updateArrayItem<PersonItem>("people", index, "name", e.target.value)} placeholder="Name" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <input value={person.role} onChange={(e) => updateArrayItem<PersonItem>("people", index, "role", e.target.value)} placeholder="Role" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={person.summary} onChange={(e) => updateArrayItem<PersonItem>("people", index, "summary", e.target.value)} placeholder="Summary" className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <div className="grid gap-4 md:grid-cols-2">
                  <input type="number" value={person.unlockStage} onChange={(e) => updateArrayItem<PersonItem>("people", index, "unlockStage", Number(e.target.value))} placeholder="Unlock stage" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                  <input type="number" value={person.sortOrder} onChange={(e) => updateArrayItem<PersonItem>("people", index, "sortOrder", Number(e.target.value))} placeholder="Sort order" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                </div>
                <button type="button" onClick={() => removeArrayItem("people", index)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400">
                  Remove Person
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Records</h2>
          <button
            type="button"
            onClick={addRecord}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Record
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {form.records.map((record, index) => (
            <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-4">
                <input value={record.title} onChange={(e) => updateArrayItem<RecordItem>("records", index, "title", e.target.value)} placeholder="Title" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <input value={record.category} onChange={(e) => updateArrayItem<RecordItem>("records", index, "category", e.target.value)} placeholder="Category" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={record.summary} onChange={(e) => updateArrayItem<RecordItem>("records", index, "summary", e.target.value)} placeholder="Summary" className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={record.body} onChange={(e) => updateArrayItem<RecordItem>("records", index, "body", e.target.value)} placeholder="Body" className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <div className="grid gap-4 md:grid-cols-2">
                  <input type="number" value={record.unlockStage} onChange={(e) => updateArrayItem<RecordItem>("records", index, "unlockStage", Number(e.target.value))} placeholder="Unlock stage" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                  <input type="number" value={record.sortOrder} onChange={(e) => updateArrayItem<RecordItem>("records", index, "sortOrder", Number(e.target.value))} placeholder="Sort order" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                </div>
                <button type="button" onClick={() => removeArrayItem("records", index)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400">
                  Remove Record
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Hints</h2>
          <button
            type="button"
            onClick={addHint}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Hint
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {form.hints.map((hint, index) => (
            <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-4">
                <input type="number" value={hint.level} onChange={(e) => updateArrayItem<HintItem>("hints", index, "level", Number(e.target.value))} placeholder="Level" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <input value={hint.title} onChange={(e) => updateArrayItem<HintItem>("hints", index, "title", e.target.value)} placeholder="Title" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={hint.content} onChange={(e) => updateArrayItem<HintItem>("hints", index, "content", e.target.value)} placeholder="Content" className="min-h-[120px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <div className="grid gap-4 md:grid-cols-2">
                  <input type="number" value={hint.unlockStage} onChange={(e) => updateArrayItem<HintItem>("hints", index, "unlockStage", Number(e.target.value))} placeholder="Unlock stage" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                  <input type="number" value={hint.sortOrder} onChange={(e) => updateArrayItem<HintItem>("hints", index, "sortOrder", Number(e.target.value))} placeholder="Sort order" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                </div>
                <button type="button" onClick={() => removeArrayItem("hints", index)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400">
                  Remove Hint
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Checkpoints</h2>
          <button
            type="button"
            onClick={addCheckpoint}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Checkpoint
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {form.checkpoints.map((checkpoint, index) => (
            <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-4">
                <input type="number" value={checkpoint.stage} onChange={(e) => updateArrayItem<CheckpointItem>("checkpoints", index, "stage", Number(e.target.value))} placeholder="Stage" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={checkpoint.prompt} onChange={(e) => updateArrayItem<CheckpointItem>("checkpoints", index, "prompt", e.target.value)} placeholder="Prompt" className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <input value={checkpoint.acceptedAnswers} onChange={(e) => updateArrayItem<CheckpointItem>("checkpoints", index, "acceptedAnswers", e.target.value)} placeholder="Accepted answers (pipe-separated)" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <textarea value={checkpoint.successMessage} onChange={(e) => updateArrayItem<CheckpointItem>("checkpoints", index, "successMessage", e.target.value)} placeholder="Success message" className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none" />
                <button type="button" onClick={() => removeArrayItem("checkpoints", index)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400">
                  Remove Checkpoint
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Saving..." : "Save Case Content"}
      </button>

      {message ? (
        <p
          className={`text-sm ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}