import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Save, AlertCircle } from "lucide-react";
import FieldPlacer from "../components/FieldPlacer.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "https://backend.sigined.com";

export default function AddFieldsPage({ docId, onBack, ctx }) {
  const { lang, showToast } = ctx;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selfSigning, setSelfSigning] = useState(false);
  const [document, setDocument] = useState(null);
  const [fields, setFields] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const token = localStorage.getItem("sigined_token");
        const [docRes, fieldsRes, downloadRes] = await Promise.all([
          fetch(`${API_BASE}/documents/${docId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/documents/${docId}/fields`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/documents/${docId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const docData = await docRes.json();
        const fieldsData = await fieldsRes.json();
        const downloadData = await downloadRes.json();

        if (!docRes.ok) {
          throw new Error(docData.error || "Failed to load document");
        }

        setDocument({
          ...docData,
          file_url: downloadData?.download_url || docData.file_url
        });
        setFields(fieldsData.fields || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (docId) {
      fetchDoc();
    }
  }, [docId]);

  const handleSave = useCallback(async (newFields) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("sigined_token");
      const res = await fetch(`${API_BASE}/documents/${docId}/fields`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields: newFields }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save fields");
      }

      setFields(newFields);
      showToast(lang === "he" ? "השדות נשמרו" : "Fields saved");

      setSelfSigning(true);
      const selfSignRes = await fetch(`${API_BASE}/documents/${docId}/self-sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const selfSignData = await selfSignRes.json();

      if (!selfSignRes.ok) {
        throw new Error(selfSignData.error || "Self-sign failed");
      }

      window.location.href = `/sign/${selfSignData.signing_token}`;
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
      setSelfSigning(false);
    }
  }, [docId, lang, showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-amber-100/60">Error: {error}</p>
        <p className="text-amber-100/40 text-sm">Doc ID: {docId}</p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-200 rounded-md"
        >
          <ArrowLeft className="w-4 h-4" />
          {lang === "he" ? "חזרה" : "Go Back"}
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-amber-900/20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-md hover:bg-white/5 text-amber-100/60"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg text-amber-50">{document?.name || "Loading..."}</h1>
            <p className="text-xs text-amber-100/50">
              {document?.file_url ? "Document loaded" : "No document URL"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-100/50">
            {fields.length} {lang === "he" ? "שדות" : "fields"}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <FieldPlacer
          documentUrl={document?.file_url}
          existingFields={fields}
          onSave={handleSave}
          disabled={saving || selfSigning}
        />
      </div>
    </div>
  );
}